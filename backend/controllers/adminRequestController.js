const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const AdminRequest = require('../models/adminRequestModel');
const Sale = require('../models/saleModel');
const Product = require('../models/productModel');
const Client = require('../models/clientModel');
const DeletedSale = require('../models/deletedSaleModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const recalculateClientPurchaseMetrics = async (clientId, session) => {
  const normalizedClientId = normalizeObjectId(clientId);

  if (!normalizedClientId || !mongoose.Types.ObjectId.isValid(normalizedClientId)) {
    return null;
  }

  const aggregateQuery = Sale.aggregate([
    { $match: { client: new mongoose.Types.ObjectId(normalizedClientId) } },
    {
      $group: {
        _id: '$client',
        totalPurchases: { $sum: '$totalAmount' },
        purchaseCount: { $sum: 1 },
        lastPurchaseDate: { $max: '$saleDate' },
      },
    },
  ]);

  if (session) aggregateQuery.session(session);

  const [summary] = await aggregateQuery;

  await Client.findByIdAndUpdate(
    normalizedClientId,
    {
      $set: {
        totalPurchases: Number(summary?.totalPurchases) || 0,
        purchaseCount: Number(summary?.purchaseCount) || 0,
        lastPurchaseDate: summary?.lastPurchaseDate || null,
      },
    },
    { session }
  );

  return summary || null;
};

const executeSaleDelete = async (request, user) => {
  const saleId = request.targetId;
  if (!saleId) {
    return { executionStatus: 'failed', executionMessage: 'Aucune vente liée à cette demande' };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const sale = await Sale.findById(saleId)
      .populate('client', 'name email')
      .populate({ path: 'products.product', select: 'name costPrice' })
      .populate('user', 'name email')
      .session(session);

    if (!sale) {
      await session.abortTransaction();
      return { executionStatus: 'failed', executionMessage: 'Vente introuvable ou déjà supprimée' };
    }

    await DeletedSale.create([{
      saleId: sale._id,
      saleSnapshot: sale.toObject(),
      deletionReason: request.reason,
      deletedBy: user._id,
      deletedAt: new Date(),
    }], { session });

    if (sale.stockDeducted) {
      for (const item of sale.products) {
        const productId = item.product?._id || item.product;
        if (!productId) continue;
        await Product.findByIdAndUpdate(productId, { $inc: { stock: item.quantity } }, { session });
      }
    }

    if (sale.client) {
      const clientId = sale.client?._id || sale.client;
      await Client.findByIdAndUpdate(clientId, { $pull: { purchases: sale._id } }, { session });
      await recalculateClientPurchaseMetrics(clientId, session);
    }

    await Sale.deleteOne({ _id: saleId }, { session });
    await session.commitTransaction();
    return { executionStatus: 'executed', executionMessage: 'Vente supprimée automatiquement après approbation' };
  } catch (error) {
    await session.abortTransaction();
    return { executionStatus: 'failed', executionMessage: error.message || 'Échec de suppression de la vente' };
  } finally {
    session.endSession();
  }
};

const executePaymentDelete = async (request) => {
  const saleId = request.metadata?.saleId || request.targetId;
  const paymentId = request.metadata?.paymentId;
  if (!saleId || !paymentId) {
    return { executionStatus: 'failed', executionMessage: 'Paiement ou vente manquant dans la demande' };
  }

  const sale = await Sale.findById(saleId);
  if (!sale) {
    return { executionStatus: 'failed', executionMessage: 'Vente introuvable' };
  }

  const paymentIndex = sale.payments.findIndex((payment) => String(payment._id) === String(paymentId));
  if (paymentIndex === -1) {
    return { executionStatus: 'failed', executionMessage: 'Paiement introuvable ou déjà supprimé' };
  }

  sale.payments.splice(paymentIndex, 1);
  sale.totalPaid = (sale.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  sale.balance = (Number(sale.totalAmount) || 0) - sale.totalPaid;
  if (sale.balance <= 0) {
    sale.status = 'completed';
  } else if (sale.totalPaid > 0) {
    sale.status = 'partially_paid';
  } else {
    sale.status = 'pending';
  }
  await sale.save();

  return { executionStatus: 'executed', executionMessage: 'Paiement supprimé automatiquement après approbation' };
};

const executeProductPriceChange = async (request) => {
  const productId = request.metadata?.productId || request.targetId;
  const newPrice = Number(request.metadata?.newPrice);
  if (!productId || Number.isNaN(newPrice) || newPrice < 0) {
    return { executionStatus: 'failed', executionMessage: 'Produit ou nouveau prix invalide' };
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { price: newPrice },
    { new: true }
  );

  if (!product) {
    return { executionStatus: 'failed', executionMessage: 'Produit introuvable' };
  }

  return { executionStatus: 'executed', executionMessage: `Prix mis à jour à ${newPrice.toLocaleString('fr-FR')} CFA` };
};

const executeStockAdjustment = async (request) => {
  const productId = request.metadata?.productId || request.targetId;
  const targetStock = request.metadata?.targetStock;
  const adjustmentQuantity = request.metadata?.adjustmentQuantity;
  if (!productId) {
    return { executionStatus: 'failed', executionMessage: 'Produit manquant' };
  }

  let update;
  if (targetStock !== undefined && targetStock !== null && targetStock !== '') {
    const nextStock = Number(targetStock);
    if (Number.isNaN(nextStock) || nextStock < 0) {
      return { executionStatus: 'failed', executionMessage: 'Stock cible invalide' };
    }
    update = { $set: { stock: nextStock } };
  } else {
    const delta = Number(adjustmentQuantity);
    if (Number.isNaN(delta) || delta === 0) {
      return { executionStatus: 'failed', executionMessage: 'Ajustement de stock invalide' };
    }
    update = { $inc: { stock: delta } };
  }

  const product = await Product.findByIdAndUpdate(productId, update, { new: true });
  if (!product) {
    return { executionStatus: 'failed', executionMessage: 'Produit introuvable' };
  }

  return { executionStatus: 'executed', executionMessage: `Stock mis à jour à ${product.stock}` };
};

const executeApprovedRequest = async (request, user) => {
  switch (request.type) {
    case 'sale.delete':
      return executeSaleDelete(request, user);
    case 'payment.delete':
      return executePaymentDelete(request);
    case 'product.price_change':
      return executeProductPriceChange(request);
    case 'stock.adjustment':
      return executeStockAdjustment(request);
    case 'sale.edit':
    case 'sale.cancel':
    case 'payment.edit':
    case 'discount.request':
    case 'expense.create':
    case 'other':
    default:
      return {
        executionStatus: 'action_required',
        executionMessage: 'Demande approuvée. Action manuelle requise par un administrateur.',
      };
  }
};

const buildRequestQuery = (req) => {
  const canReview = req.user?.isAdmin || (
    Array.isArray(req.user?.permissions) && req.user.permissions.includes('approve_admin_requests')
  );
  const query = {
    ...tenantFilter(req),
    ...(canReview ? {} : { requestedBy: req.user._id }),
  };
  if (req.query.status) {
    query.status = req.query.status;
  }
  return query;
};

const getAdminRequests = asyncHandler(async (req, res) => {
  const requests = await AdminRequest.find(buildRequestQuery(req))
    .populate('requestedBy', 'name email')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  res.json(requests);
});

const createAdminRequest = asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();

  if (!reason) {
    return res.status(400).json({ message: 'Une raison est requise' });
  }

  const request = await AdminRequest.create({
    tenantId: req.tenantId,
    type: req.body.type || 'other',
    reason,
    note: String(req.body.note || '').trim(),
    targetModel: String(req.body.targetModel || '').trim(),
    targetId: req.body.targetId || null,
    targetLabel: String(req.body.targetLabel || '').trim(),
    metadata: req.body.metadata || {},
    requestedBy: req.user._id,
  });

  const populated = await AdminRequest.findById(request._id)
    .populate('requestedBy', 'name email')
    .lean();

  res.status(201).json(populated);
});

const reviewAdminRequest = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').trim();

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  const request = await AdminRequest.findById(req.params.id);
  if (!request) {
    return res.status(404).json({ message: 'Demande introuvable' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ message: 'Cette demande a déjà été traitée' });
  }

  request.status = status;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.adminComment = String(req.body.adminComment || '').trim();

  if (status === 'approved') {
    const executionResult = await executeApprovedRequest(request, req.user);
    request.executionStatus = executionResult.executionStatus;
    request.executionMessage = executionResult.executionMessage;
    request.executedAt = executionResult.executionStatus === 'executed' ? new Date() : null;
  } else {
    request.executionStatus = 'none';
    request.executionMessage = '';
    request.executedAt = null;
  }

  await request.save();

  const populated = await AdminRequest.findById(request._id)
    .populate('requestedBy', 'name email')
    .populate('reviewedBy', 'name email')
    .lean();

  res.json(populated);
});

module.exports = {
  getAdminRequests,
  createAdminRequest,
  reviewAdminRequest,
};
