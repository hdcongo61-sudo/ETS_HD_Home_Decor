const asyncHandler = require('express-async-handler');
const Sale = require('../models/saleModel');
const Product = require('../models/productModel');
const ProductVariant = require('../models/productVariantModel');
const AttributeDefinition = require('../models/attributeDefinitionModel');
const Client = require('../models/clientModel');
const User = require('../models/userModel');
const Location = require('../models/locationModel');
const { buildProductFilter, buildSaleFilter } = require('../utils/ultimateFilter');

const MAX_MATCHED_PRODUCTS = 10000;
const MAX_PAGE_SIZE = 100;

const getCombinedSalesProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const saleFilter = buildSaleFilter(req.query);
  const productFilter = buildProductFilter(req.query);
  const definitions = await AttributeDefinition.find({
    tenantId,
    isActive: true,
    filterable: true,
    variantAxis: true,
  }).select('key label').lean();
  const variantConditions = [];

  definitions.forEach(({ key }) => {
    const rawValue = req.query[`variant_${key}`];
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .flatMap((value) => typeof value === 'string' ? value.split(',') : [])
      .map((value) => value.trim().slice(0, 100))
      .filter(Boolean);
    if (!values.length) return;
    const patterns = values.map((value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    variantConditions.push({ [`optionValues.${key}`]: { $in: patterns } });
  });

  const productIds = await Product.find({ tenantId, ...productFilter })
    .select('_id')
    .sort({ _id: 1 })
    .limit(MAX_MATCHED_PRODUCTS + 1)
    .lean();

  if (productIds.length > MAX_MATCHED_PRODUCTS) {
    res.status(422);
    throw new Error('Trop de produits correspondent. Ajoutez un filtre produit ou un attribut de variante.');
  }

  let matchedProductIds = productIds.map((product) => product._id);
  if (variantConditions.length) {
    const variants = await ProductVariant.find({
      tenantId,
      status: 'active',
      productId: { $in: matchedProductIds },
      $and: variantConditions,
    }).select('productId').lean();
    const variantProductIds = new Set(variants.map((variant) => variant.productId.toString()));
    matchedProductIds = matchedProductIds.filter((id) => variantProductIds.has(id.toString()));
  }

  const requestedPage = Number.parseInt(req.query.page, 10);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, requestedLimit))
    : MAX_PAGE_SIZE;
  const lineFilter = {};
  const quantityRange = {};
  const minimumQuantity = Number(req.query.minQuantity);
  const maximumQuantity = Number(req.query.maxQuantity);
  if (req.query.minQuantity !== undefined && Number.isFinite(minimumQuantity)) quantityRange.$gte = minimumQuantity;
  if (req.query.maxQuantity !== undefined && Number.isFinite(maximumQuantity)) quantityRange.$lte = maximumQuantity;
  if (Object.keys(quantityRange).length) lineFilter['products.quantity'] = quantityRange;
  const linePriceRange = {};
  const minimumLinePrice = Number(req.query.minLinePrice);
  const maximumLinePrice = Number(req.query.maxLinePrice);
  if (req.query.minLinePrice !== undefined && Number.isFinite(minimumLinePrice)) linePriceRange.$gte = minimumLinePrice;
  if (req.query.maxLinePrice !== undefined && Number.isFinite(maximumLinePrice)) linePriceRange.$lte = maximumLinePrice;
  if (Object.keys(linePriceRange).length) lineFilter['products.priceAtSale'] = linePriceRange;
  const clientSearch = typeof req.query.clientSearch === 'string' ? req.query.clientSearch.trim().slice(0, 100) : '';
  const clientSearchRegex = clientSearch
    ? new RegExp(clientSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : null;
  const pipeline = [
    { $match: { tenantId, ...saleFilter, 'products.product': { $in: matchedProductIds } } },
    { $unwind: { path: '$products', includeArrayIndex: 'lineIndex' } },
    { $match: { 'products.product': { $in: matchedProductIds }, ...lineFilter } },
    {
      $lookup: {
        from: Product.collection.name,
        let: { productId: '$products.product' },
        pipeline: [{
          $match: {
            $expr: { $and: [{ $eq: ['$_id', '$$productId'] }, { $eq: ['$tenantId', tenantId] }] },
          },
        }],
        as: 'productRecord',
      },
    },
    { $unwind: '$productRecord' },
    {
      $lookup: {
        from: Client.collection.name,
        let: { clientId: '$client' },
        pipeline: [{
          $match: {
            $expr: { $and: [{ $eq: ['$_id', '$$clientId'] }, { $eq: ['$tenantId', tenantId] }] },
          },
        }],
        as: 'clientRecord',
      },
    },
    { $unwind: { path: '$clientRecord', preserveNullAndEmptyArrays: true } },
    ...(clientSearchRegex ? [{ $match: { 'clientRecord.name': clientSearchRegex } }] : []),
    {
      $lookup: {
        from: Location.collection.name,
        let: { locationId: '$locationId' },
        pipeline: [{
          $match: {
            $expr: { $and: [{ $eq: ['$_id', '$$locationId'] }, { $eq: ['$tenantId', tenantId] }] },
          },
        }],
        as: 'locationRecord',
      },
    },
    { $unwind: { path: '$locationRecord', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: User.collection.name,
        let: { sellerId: '$user' },
        pipeline: [{
          $match: {
            $expr: { $and: [{ $eq: ['$_id', '$$sellerId'] }, { $eq: ['$tenantId', tenantId] }] },
          },
        }],
        as: 'sellerRecord',
      },
    },
    { $unwind: { path: '$sellerRecord', preserveNullAndEmptyArrays: true } },
    {
      $facet: {
        results: [
          { $sort: { saleDate: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: { $concat: [{ $toString: '$_id' }, ':', { $toString: '$lineIndex' }] },
              lineId: { $concat: [{ $toString: '$_id' }, ':', { $toString: '$lineIndex' }] },
              saleId: '$_id',
              name: '$productRecord.name',
              reference: 1,
              saleDate: 1,
              status: 1,
              paymentMethod: 1,
              saleType: 1,
              deliveryStatus: 1,
              totalAmount: { $multiply: ['$products.quantity', '$products.priceAtSale'] },
              saleTotalAmount: '$totalAmount',
              discountAmount: 1,
              taxAmount: 1,
              taxRate: 1,
              taxInclusive: 1,
              taxLabel: 1,
              promotionCode: 1,
              profitCategory: 1,
              totalProfit: '$profitData.totalProfit',
              profitMargin: '$profitData.profitMargin',
              deliveryDate: 1,
              deliveryNote: 1,
              stockDeducted: 1,
              createdAt: 1,
              lastRemindedAt: 1,
              hasProforma: { $ne: ['$sourceProforma', null] },
              quantity: '$products.quantity',
              priceAtSale: '$products.priceAtSale',
              lineAmount: { $multiply: ['$products.quantity', '$products.priceAtSale'] },
              client: { _id: '$clientRecord._id', name: '$clientRecord.name' },
              seller: { _id: '$sellerRecord._id', name: '$sellerRecord.name' },
              location: { _id: '$locationRecord._id', name: '$locationRecord.name' },
              payments: {
                $map: {
                  input: { $ifNull: ['$payments', []] },
                  as: 'payment',
                  in: { amount: '$$payment.amount', method: '$$payment.method', paymentDate: '$$payment.paymentDate' },
                },
              },
              paymentReminder: {
                isSet: '$paymentReminder.isSet',
                reminderDate: '$paymentReminder.reminderDate',
                status: '$paymentReminder.status',
              },
              product: {
                _id: '$productRecord._id',
                name: '$productRecord.name',
                description: '$productRecord.description',
                category: '$productRecord.category',
                slug: '$productRecord.slug',
                sku: '$productRecord.sku',
                barcode: '$productRecord.barcode',
                batchNumber: '$productRecord.batchNumber',
                supplierName: '$productRecord.supplierName',
                supplierPhone: '$productRecord.supplierPhone',
                container: '$productRecord.container',
                warehouse: '$productRecord.warehouse',
                image: '$productRecord.image',
                price: '$productRecord.price',
                costPrice: '$productRecord.costPrice',
                stock: '$productRecord.stock',
                minStockLevel: '$productRecord.minStockLevel',
                expiryDate: '$productRecord.expiryDate',
                isActive: '$productRecord.isActive',
                viewsCount: '$productRecord.viewsCount',
                conversionRate: '$productRecord.conversionRate',
                returnsCount: '$productRecord.returnsCount',
                createdAt: '$productRecord.createdAt',
                updatedAt: '$productRecord.updatedAt',
              },
            },
          },
        ],
        summary: [
          {
            $group: {
              _id: '$_id',
              saleAmount: { $first: '$totalAmount' },
              lineAmount: { $sum: { $multiply: ['$products.quantity', '$products.priceAtSale'] } },
              quantity: { $sum: '$products.quantity' },
              lines: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              lines: { $sum: '$lines' },
              saleAmount: { $sum: '$saleAmount' },
              lineAmount: { $sum: '$lineAmount' },
              quantity: { $sum: '$quantity' },
              averageSaleAmount: { $avg: '$saleAmount' },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Sale.aggregate(pipeline).allowDiskUse(true);
  const summary = result?.summary?.[0] || { sales: 0, lines: 0, lineAmount: 0, saleAmount: 0, quantity: 0, averageSaleAmount: 0 };
  res.json({
    data: result?.results || [],
    pagination: {
      page,
      limit,
      total: summary.lines,
      pages: Math.ceil(summary.lines / limit),
    },
    summary: {
      sales: summary.sales || 0,
      matchedProducts: matchedProductIds.length,
      lineAmount: summary.lineAmount || 0,
      saleAmount: summary.saleAmount || 0,
      averageSaleAmount: summary.averageSaleAmount || 0,
      quantity: summary.quantity || 0,
    },
    variantAttributeFilters: definitions
      .map(({ key, label }) => ({ key, label })),
  });
});

module.exports = { getCombinedSalesProducts };
