const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const BankTransaction = require('../models/bankTransactionModel');

const buildFilters = (req) => {
  const filters = {
    user: req.user?._id
  };

  if (req.query.type) {
    filters.type = req.query.type;
  }

  if (req.query.startDate && req.query.endDate) {
    filters.createdAt = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate)
    };
  }

  if (req.query.search) {
    filters.label = { $regex: req.query.search, $options: 'i' };
  }

  return filters;
};

const getBalanceForUser = async (userId) => {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;

  if (!userObjectId) return 0;

  const totals = await BankTransaction.aggregate([
    { $match: { user: userObjectId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]);

  const totalsByType = totals.reduce((acc, entry) => {
    acc[entry._id] = entry.total || 0;
    return acc;
  }, {});

  const deposits = totalsByType.deposit || 0;
  const withdrawals = totalsByType.withdraw || 0;
  return deposits - withdrawals;
};

// @desc    Get bank transactions for current user
// @route   GET /api/bank
// @access  Private
const getBankTransactions = asyncHandler(async (req, res) => {
  const filters = buildFilters(req);
  const transactions = await BankTransaction.find(filters)
    .sort({ createdAt: -1 })
    .lean();

  res.json(transactions);
});

// @desc    Create bank transaction
// @route   POST /api/bank
// @access  Private
const createBankTransaction = asyncHandler(async (req, res) => {
  const { type, amount, label } = req.body;
  const numericAmount = Number(amount);

  if (!type || !['deposit', 'withdraw'].includes(type)) {
    res.status(400);
    throw new Error('Type de transaction invalide');
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    res.status(400);
    throw new Error('Le montant doit etre superieur a 0');
  }

  const trimmedLabel = (label || '').trim();
  if (!trimmedLabel) {
    res.status(400);
    throw new Error('Le libelle est requis');
  }

  if (type === 'withdraw') {
    const balance = await getBalanceForUser(req.user?._id);
    if (numericAmount > balance) {
      res.status(400);
      throw new Error('Solde insuffisant pour ce retrait');
    }
  }

  const transaction = await BankTransaction.create({
    user: req.user?._id,
    type,
    amount: numericAmount,
    label: trimmedLabel
  });

  res.status(201).json(transaction);
});

module.exports = {
  getBankTransactions,
  createBankTransaction
};
