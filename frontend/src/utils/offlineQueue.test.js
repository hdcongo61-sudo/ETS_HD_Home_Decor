import {
  enqueueMutation,
  drainMutations,
  pendingMutationCount,
  listPendingMutations,
  staleMutationCount,
  createClientRequestId,
} from './offlineQueue';

const memoryStorage = () => {
  const map = new Map();
  return {
    async all() {
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(op) {
      map.set(op.clientRequestId, op);
    },
    async remove(clientRequestId) {
      map.delete(clientRequestId);
    },
  };
};

describe('offlineQueue (spike PoC)', () => {
  it('rejoue les opérations dans l’ordre FIFO avec leur clientRequestId', async () => {
    const storage = memoryStorage();
    const sent = [];
    await enqueueMutation({ method: 'post', url: '/sales', data: { amount: 10 } }, storage);
    await enqueueMutation({ method: 'post', url: '/sales', data: { amount: 20 } }, storage);

    const result = await drainMutations({
      storage,
      send: async (op) => {
        sent.push(op);
        return { status: 201 };
      },
    });

    expect(result).toEqual({ sent: 2, remaining: 0 });
    expect(sent.map((op) => op.data.amount)).toEqual([10, 20]);
    expect(sent.every((op) => op.clientRequestId)).toBe(true);
    expect(await pendingMutationCount(storage)).toBe(0);
  });

  it('retire une opération déjà appliquée (déduplication serveur)', async () => {
    const storage = memoryStorage();
    const op = await enqueueMutation({ method: 'post', url: '/sales' }, storage);

    const result = await drainMutations({
      storage,
      send: async () => ({ status: 200, data: { deduplicated: true } }),
    });

    expect(result.sent).toBe(0); // pas une nouvelle vente
    expect(await pendingMutationCount(storage)).toBe(0);
    expect(op.clientRequestId).toBeTruthy();
  });

  it('conserve les opérations quand le réseau est indisponible', async () => {
    const storage = memoryStorage();
    await enqueueMutation({ method: 'post', url: '/sales', data: { amount: 30 } }, storage);

    const result = await drainMutations({
      storage,
      send: async () => {
        throw new Error('Network Error');
      },
      isOfflineError: () => true,
    });

    expect(result.sent).toBe(0);
    expect(await pendingMutationCount(storage)).toBe(1);
  });

  it('expose les opérations en attente avec leurs détails', async () => {
    const storage = memoryStorage();
    const operation = await enqueueMutation({
      method: 'post',
      url: '/expenses',
      data: { description: 'Transport', amount: 2500 },
    }, storage);

    expect(await listPendingMutations(storage)).toEqual([operation]);
  });

  it('marque une opération en conflit (409) comme stale sans la supprimer', async () => {
    const storage = memoryStorage();
    await enqueueMutation({ method: 'post', url: '/sales', data: { amount: 40 } }, storage);

    const result = await drainMutations({
      storage,
      send: async () => {
        const err = new Error('Stock insuffisant');
        err.response = { status: 409 };
        throw err;
      },
    });

    expect(result.sent).toBe(0);
    expect(await staleMutationCount(storage)).toBe(1);
    expect(await pendingMutationCount(storage)).toBe(1);
  });

  it('ne rejoue pas automatiquement une opération stale (sauf includeStale)', async () => {
    const storage = memoryStorage();
    await enqueueMutation({ method: 'post', url: '/sales', data: { amount: 50 } }, storage);
    // Premier passage : conflit → stale.
    await drainMutations({
      storage,
      send: async () => {
        const err = new Error('Stock insuffisant');
        err.response = { status: 409 };
        throw err;
      },
    });

    let attempts = 0;
    const auto = await drainMutations({
      storage,
      send: async () => {
        attempts += 1;
        return { status: 201 };
      },
    });
    expect(attempts).toBe(0); // stale non rejoué par défaut
    expect(auto.sent).toBe(0);

    const manual = await drainMutations({
      storage,
      includeStale: true,
      send: async () => ({ status: 201 }),
    });
    expect(manual.sent).toBe(1);
    expect(await pendingMutationCount(storage)).toBe(0);
  });

  it('génère des clientRequestId uniques', () => {
    expect(createClientRequestId()).not.toBe(createClientRequestId());
  });
});
