/**
 * ReplenishmentService — suggestions de réapprovisionnement (Phase 6.7).
 *
 * Purement consultatif : calcule, pour chaque produit sous son stock minimum
 * (à la boutique), la quantité suggérée = max(minStockLevel - disponible -
 * commandes ouvertes, 0), arrondie à la quantité minimum fournisseur, avec
 * fournisseur préféré, dernier coût, délai et ventes récentes (30 jours).
 */
const InventoryBalance = require('../models/inventoryBalanceModel');
const PurchaseOrder = require('../models/purchaseOrderModel');
const Product = require('../models/productModel');
const SupplierProduct = require('../models/supplierProductModel');
const Supplier = require('../models/supplierModel');
const Sale = require('../models/saleModel');

async function getSuggestions({ tenantId, locationId }) {
  const balances = await InventoryBalance.find({ tenantId, locationId }).lean();
  if (balances.length === 0) return [];

  const productIds = balances.map((balance) => balance.productId);
  const products = await Product.find({ tenantId, _id: { $in: productIds } })
    .select('name sku minStockLevel')
    .lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  // Quantités en commande ouverte (non reçues), scoped à la boutique.
  const openOrders = await PurchaseOrder.find({
    tenantId, locationId, status: { $in: ['approved', 'partially_received'] },
  }).select('lines').lean();
  const onOrder = new Map();
  for (const order of openOrders) {
    for (const line of order.lines) {
      const outstanding = Math.max(
        0, line.orderedQuantity - line.receivedQuantity - line.rejectedQuantity
      );
      if (outstanding > 0) {
        const key = String(line.product);
        onOrder.set(key, (onOrder.get(key) || 0) + outstanding);
      }
    }
  }

  // Ventes récentes (30 jours).
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const salesRows = await Sale.aggregate([
    { $match: { tenantId, saleDate: { $gte: since }, 'products.0': { $exists: true } } },
    { $unwind: '$products' },
    { $group: { _id: '$products.product', quantity: { $sum: '$products.quantity' } } },
  ]);
  const recentSales = new Map(salesRows.map((row) => [String(row._id), row.quantity]));

  // Fournisseurs préférés et références d'achat.
  const links = await SupplierProduct.find({
    tenantId, productId: { $in: productIds }, active: true,
  }).sort({ preferred: -1, updatedAt: -1 }).lean();
  const linkByProduct = new Map();
  for (const link of links) {
    if (!linkByProduct.has(String(link.productId))) linkByProduct.set(String(link.productId), link);
  }
  const supplierIds = [...new Set([...linkByProduct.values()].map((link) => link.supplierId))];
  const suppliers = await Supplier.find({ tenantId, _id: { $in: supplierIds } }).select('name').lean();
  const supplierMap = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));

  const suggestions = [];
  for (const balance of balances) {
    const product = productMap.get(String(balance.productId));
    if (!product) continue;
    const available = balance.onHand - (balance.reserved || 0);
    const minimum = Number(product.minStockLevel) || 0;
    if (available >= minimum) continue;

    const ordered = onOrder.get(String(balance.productId)) || 0;
    const link = linkByProduct.get(String(balance.productId));
    const supplier = link ? supplierMap.get(String(link.supplierId)) : null;
    const moq = link ? Math.max(1, link.minimumOrderQuantity || 1) : 1;

    const rawQuantity = Math.max(0, minimum - available - ordered);
    const suggestedQuantity = rawQuantity > 0 ? Math.ceil(rawQuantity / moq) * moq : 0;
    if (suggestedQuantity <= 0) continue;

    suggestions.push({
      productId: balance.productId,
      name: product.name,
      sku: product.sku,
      available,
      onOrder: ordered,
      minStockLevel: minimum,
      recentSales: recentSales.get(String(balance.productId)) || 0,
      suggestedQuantity,
      supplierId: link ? link.supplierId : null,
      supplierName: supplier ? supplier.name : null,
      lastCost: link ? link.lastCost : 0,
      currency: link ? link.currency : 'XOF',
      leadTimeDays: link ? link.leadTimeDays : 0,
      minimumOrderQuantity: moq,
    });
  }

  suggestions.sort((a, b) => (a.available - a.minStockLevel) - (b.available - b.minStockLevel));
  return suggestions;
}

module.exports = { getSuggestions };
