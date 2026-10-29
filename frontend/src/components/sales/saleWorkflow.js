export const getSaleWorkflow = sale => {
  const total = Number(sale.totalAmount) || 0;
  const paid = Array.isArray(sale.payments)
    ? sale.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    : Number(sale.totalPaid) || 0;
  const balance = Math.max(total - paid, 0);
  if (sale.status === 'cancelled') return { total, paid, balance, action: null, title: 'Vente annulée', description: 'Consultez les paiements et les modifications dans le suivi ci-dessous.' };
  if (sale.status === 'completed' && balance > 0) return { total, paid, balance, action: null, title: 'Statut à vérifier', description: 'Le solde et le statut payé ne correspondent pas. Actualisez la fiche avant de poursuivre.' };
  if (balance > 0) return { total, paid, balance, action: 'payment', title: 'Encaisser le solde', description: 'Enregistrez le montant reçu pour mettre à jour le solde de cette vente.' };
  if (sale.status !== 'completed') return { total, paid, balance, action: null, title: 'Statut à vérifier', description: 'Le solde est réglé mais la vente n’est pas marquée payée. Actualisez la fiche avant de poursuivre.' };
  if (sale.deliveryStatus !== 'delivered') return { total, paid, balance, action: 'delivery', title: 'Organiser la livraison', description: 'La vente est payée. Vérifiez la livraison et confirmez son statut.' };
  return { total, paid, balance, action: 'receipt', title: 'Vente payée et livrée', description: 'Téléchargez la facture à remettre au client.' };
};

export const getSaleActivity = sale => {
  const events = [];
  const add = (id, date, label, detail) => {
    if (!date || Number.isNaN(new Date(date).getTime())) return;
    events.push({ id, date, label, detail });
  };
  add('created', sale.saleDate || sale.createdAt, 'Vente enregistrée');
  (sale.payments || []).forEach((payment, index) => add('payment-' + (payment._id || index), payment.paymentDate || payment.createdAt, 'Paiement reçu', (Number(payment.amount) || 0).toLocaleString('fr-FR') + ' CFA'));
  if (sale.deliveryStatus === 'delivered') add('delivered', sale.deliveryDate, 'Livraison effectuée', sale.deliveryNote);
  (sale.modificationHistory || []).forEach((entry, index) => add('edit-' + (entry._id || index), entry.modifiedAt || entry.date || entry.createdAt, 'Vente modifiée', entry.note || entry.reason));
  (sale.reminderLog || []).forEach((entry, index) => add('reminder-' + index, entry.createdAt, 'Relance client', entry.channel));
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
};
