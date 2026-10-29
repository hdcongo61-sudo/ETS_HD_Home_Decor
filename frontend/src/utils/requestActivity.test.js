import { startRequest, finishRequest, hasPendingWrites, subscribeToWrites } from './requestActivity';
test('reads do not block refresh, concurrent writes finish independently', () => {
  const listener = jest.fn(); const unsubscribe = subscribeToWrites(listener);
  startRequest({ method: 'get' }); expect(hasPendingWrites()).toBe(false);
  const first = { method: 'post' }, second = { method: 'delete' };
  startRequest(first); startRequest(second); expect(hasPendingWrites()).toBe(true);
  finishRequest({ ...first }); expect(hasPendingWrites()).toBe(true);
  finishRequest(second); expect(hasPendingWrites()).toBe(false);
  expect(listener).toHaveBeenCalledTimes(4); unsubscribe();
});
