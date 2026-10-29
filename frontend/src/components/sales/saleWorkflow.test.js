import { getSaleWorkflow, getSaleActivity } from './saleWorkflow';
const base = { totalAmount: 1000, status: 'partially_paid', payments: [{ amount: 300 }] };
test('uses actual payments for the balance and chooses collection', () => {
  expect(getSaleWorkflow({ ...base, balance: 999, totalPaid: 1 })).toMatchObject({ paid: 300, balance: 700, action: 'payment' });
});
test('moves from collection to delivery and then invoice as the sale progresses', () => {
  const paid = { ...base, payments: [{ amount: 1000 }], status: 'completed', deliveryStatus: 'pending' };
  expect(getSaleWorkflow(paid).action).toBe('delivery');
  expect(getSaleWorkflow({ ...paid, deliveryStatus: 'not_delivered' }).action).toBe('delivery');
  expect(getSaleWorkflow({ ...paid, deliveryStatus: 'delivered' }).action).toBe('receipt');
});
test('cancelled sales have no transactional action', () => {
  expect(getSaleWorkflow({ ...base, status: 'cancelled' }).action).toBeNull();
});
test('does not bypass backend status requirements for inconsistent paid sales', () => {
  expect(getSaleWorkflow({ ...base, status: 'completed' }).action).toBeNull();
  expect(getSaleWorkflow({ ...base, payments: [{ amount: 1000 }] })).toMatchObject({ action: null, title: 'Statut à vérifier' });
});
test('builds a dated chronological activity feed and ignores missing or invalid dates', () => {
  const events = getSaleActivity({ saleDate: '2026-10-20', deliveryStatus: 'delivered', deliveryDate: '2026-10-24', payments: [{ _id: 'one', amount: 300, paymentDate: '2026-10-21' }, { amount: 2, paymentDate: 'bad' }], modificationHistory: [{ date: '2026-10-22', note: 'Quantité corrigée' }], reminderLog: [{ createdAt: '2026-10-23', channel: 'whatsapp' }] });
  expect(events.map(event => event.label)).toEqual(['Livraison effectuée', 'Relance client', 'Vente modifiée', 'Paiement reçu', 'Vente enregistrée']);
  expect(events.find(event => event.label === 'Paiement reçu').detail).toBe('300 CFA');
  expect(getSaleActivity({})).toEqual([]);
});
