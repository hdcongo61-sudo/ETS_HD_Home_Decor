import {
  enqueueMutation,
  drainMutations,
  pendingMutationCount,
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

  it('génère des clientRequestId uniques', () => {
    expect(createClientRequestId()).not.toBe(createClientRequestId());
  });
});
