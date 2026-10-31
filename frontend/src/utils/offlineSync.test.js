import { sendQueuedWith, flushOfflineQueue } from './offlineSync';
import { enqueueMutation } from './offlineQueue';

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

describe('offlineSync glue', () => {
  it('rejoue les opérations en file via le client injecté', async () => {
    const storage = memoryStorage();
    const requests = [];
    const fakeClient = {
      request: async (config) => {
        requests.push(config);
        return { status: 201, data: { ok: true } };
      },
    };

    await enqueueMutation(
      { method: 'post', url: '/expenses', data: { amount: 50, clientRequestId: 'req-1' } },
      storage
    );

    const result = await flushOfflineQueue(fakeClient, storage);

    expect(result.sent).toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      method: 'post',
      url: '/expenses',
      data: { amount: 50, clientRequestId: 'req-1' },
    });
  });

  it('expose un rejoueur qui transmet method/url/data', async () => {
    const seen = [];
    const send = sendQueuedWith({
      request: async (config) => {
        seen.push(config);
        return {};
      },
    });
    await send({ method: 'post', url: '/sales', data: { clientRequestId: 'x' } });
    expect(seen[0]).toEqual({ method: 'post', url: '/sales', data: { clientRequestId: 'x' } });
  });
});
