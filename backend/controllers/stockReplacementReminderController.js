const asyncHandler = require('express-async-handler');
const StockReplacementReminder = require('../models/stockReplacementReminderModel');
const { tenantFilter } = require('../utils/tenantQuery');

const isCompletedSale = (sale) => {
  if (!sale) return false;
  if (sale.status === 'completed') return true;
  const totalAmount = Number(sale.totalAmount) || 0;
  const totalPaid = (sale.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  return totalAmount > 0 && totalPaid >= totalAmount;
};

const getPendingStockReplacementReminders = asyncHandler(async (req, res) => {
  const reminders = await StockReplacementReminder.find({
    ...tenantFilter(req),
    status: 'pending',
  })
    .populate('product', 'name slug image stock category warehouse')
    .populate('sales', 'status totalAmount payments saleDate')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({
    reminders: reminders.filter((reminder) => (reminder.sales || []).some(isCompletedSale)),
  });
});

const confirmStockReplacementReminder = asyncHandler(async (req, res) => {
  const reminder = await StockReplacementReminder.findOne({
    ...tenantFilter(req),
    _id: req.params.id,
    status: 'pending',
  });

  if (!reminder) {
    return res.status(404).json({ message: 'Rappel de transfert dépôt → boutique introuvable' });
  }

  // Operational confirmation only: this does not add, remove, or transfer stock.
  reminder.status = 'confirmed';
  reminder.confirmedBy = req.user?._id || null;
  reminder.confirmedAt = new Date();
  reminder.updatedBy = req.user?._id || null;

  const updatedReminder = await reminder.save();

  res.json({
    message: 'Transfert dépôt → boutique confirmé',
    reminder: updatedReminder,
  });
});

module.exports = {
  getPendingStockReplacementReminders,
  confirmStockReplacementReminder,
};
