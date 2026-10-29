// Track writes only: refreshing a pending read is safe, interrupting a save is not.
let nextWriteId = 0;
const pendingWrites = new Set();
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());
export const subscribeToWrites = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const hasPendingWrites = () => pendingWrites.size > 0;
export function startRequest(config) {
  if (!config || ['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) return;
  if (!config.__writeActivityId) config.__writeActivityId = 'write-' + (++nextWriteId);
  pendingWrites.add(config.__writeActivityId);
  notify();
}
export function finishRequest(config) {
  if (config?.__writeActivityId && pendingWrites.delete(config.__writeActivityId)) notify();
}
