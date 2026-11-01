const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readText = (value, maxLength = 200) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const readNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const addRange = (filter, field, min, max) => {
  const lower = readNumber(min);
  const upper = readNumber(max);
  if (lower === null && upper === null) return;
  filter[field] = {};
  if (lower !== null) filter[field].$gte = lower;
  if (upper !== null) filter[field].$lte = upper;
};

const createDateRange = (startDate, endDate) => {
  const start = readText(startDate, 30);
  const end = readText(endDate, 30);
  const startTime = start ? Date.parse(`${start}T00:00:00.000Z`) : NaN;
  const endTime = end ? Date.parse(`${end}T23:59:59.999Z`) : NaN;
  if ((start && !Number.isFinite(startTime)) || (end && !Number.isFinite(endTime))) return null;
  if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime > endTime) return null;
  if (!Number.isFinite(startTime) && !Number.isFinite(endTime)) return null;
  const range = {};
  if (Number.isFinite(startTime)) range.$gte = new Date(startTime);
  if (Number.isFinite(endTime)) range.$lte = new Date(endTime);
  return range;
};

const buildSaleFilter = (query = {}) => {
  const filter = {};
  const saleDate = createDateRange(query.startDate, query.endDate);
  if (saleDate) filter.saleDate = saleDate;

  const exactFields = {
    status: ['pending', 'partially_paid', 'completed', 'cancelled', 'partially_returned', 'returned'],
    paymentMethod: ['cash', 'MobileMoney', 'credit'],
    saleType: ['normal', 'wholesale'],
    deliveryStatus: ['pending', 'delivered', 'not_delivered'],
    profitCategory: ['faible', 'moyen', 'élevé', 'excellent'],
  };
  Object.entries(exactFields).forEach(([field, allowed]) => {
    const value = readText(query[field], 64);
    if (allowed.includes(value)) filter[field] = value;
  });

  const sellerId = readText(query.sellerId, 64);
  if (/^[a-f\d]{24}$/i.test(sellerId)) filter.user = sellerId;
  const locationId = readText(query.locationId, 64);
  if (/^[a-f\d]{24}$/i.test(locationId)) filter.locationId = locationId;

  const saleSearch = readText(query.saleSearch, 100);
  if (saleSearch) {
    const regex = { $regex: escapeRegex(saleSearch), $options: 'i' };
    filter.$or = [{ reference: regex }, { note: regex }, { promotionCode: regex }];
  }
  const taxLabel = readText(query.taxLabel, 40);
  if (taxLabel) filter.taxLabel = { $regex: escapeRegex(taxLabel), $options: 'i' };
  const deliveryNote = readText(query.deliveryNote, 200);
  if (deliveryNote) filter.deliveryNote = { $regex: escapeRegex(deliveryNote), $options: 'i' };
  if (query.taxInclusive === 'true') filter.taxInclusive = true;
  if (query.taxInclusive === 'false') filter.taxInclusive = false;
  if (query.hasProforma === 'true') filter.sourceProforma = { $ne: null };
  if (query.hasProforma === 'false') filter.sourceProforma = null;
  const deliveryDate = createDateRange(query.deliveryStart, query.deliveryEnd);
  if (deliveryDate) filter.deliveryDate = deliveryDate;
  const recordedDate = createDateRange(query.recordedStart, query.recordedEnd);
  if (recordedDate) filter.createdAt = recordedDate;
  const reminderDate = createDateRange(query.reminderStart, query.reminderEnd);
  if (reminderDate) filter['paymentReminder.reminderDate'] = reminderDate;
  const lastReminderDate = createDateRange(query.lastReminderStart, query.lastReminderEnd);
  if (lastReminderDate) filter.lastRemindedAt = lastReminderDate;
  const reminderStatus = readText(query.reminderStatus, 32);
  if (['pending', 'sent', 'cancelled'].includes(reminderStatus)) {
    filter['paymentReminder.status'] = reminderStatus;
  }
  if (query.hasReminder === 'true') filter['paymentReminder.isSet'] = true;
  if (query.hasReminder === 'false') filter['paymentReminder.isSet'] = false;
  const reminderChannel = readText(query.reminderChannel, 32);
  if (['whatsapp', 'call', 'sms', 'email', 'manual'].includes(reminderChannel)) {
    filter['reminderLog.channel'] = reminderChannel;
  }
  const reminderSearch = readText(query.reminderSearch, 200);
  if (reminderSearch) {
    const regex = { $regex: escapeRegex(reminderSearch), $options: 'i' };
    filter.$and = [...(filter.$and || []), { $or: [{ 'paymentReminder.reminderNote': regex }, { 'reminderLog.note': regex }] }];
  }
  if (query.stockDeducted === 'true') filter.stockDeducted = true;
  if (query.stockDeducted === 'false') filter.stockDeducted = false;

  const paymentFilter = {};
  const paymentMethod = readText(query.paymentDetailMethod, 32);
  if (['cash', 'MobileMoney', 'credit'].includes(paymentMethod)) paymentFilter.method = paymentMethod;
  const paymentAmount = {};
  const minPaidAmount = readNumber(query.minPaidAmount);
  const maxPaidAmount = readNumber(query.maxPaidAmount);
  if (minPaidAmount !== null) paymentAmount.$gte = minPaidAmount;
  if (maxPaidAmount !== null) paymentAmount.$lte = maxPaidAmount;
  if (Object.keys(paymentAmount).length) paymentFilter.amount = paymentAmount;
  const paymentDate = createDateRange(query.paymentStart, query.paymentEnd);
  if (paymentDate) paymentFilter.paymentDate = paymentDate;
  if (Object.keys(paymentFilter).length) filter.payments = { $elemMatch: paymentFilter };

  addRange(filter, 'totalAmount', query.minAmount, query.maxAmount);
  addRange(filter, 'discountAmount', query.minDiscount, query.maxDiscount);
  addRange(filter, 'taxAmount', query.minTax, query.maxTax);
  addRange(filter, 'profitData.totalProfit', query.minProfit, query.maxProfit);
  addRange(filter, 'profitData.profitMargin', query.minProfitMargin, query.maxProfitMargin);
  return filter;
};

const buildProductFilter = (query = {}) => {
  const filter = {};
  const productSearch = readText(query.productSearch, 100);
  if (productSearch) {
    const regex = { $regex: escapeRegex(productSearch), $options: 'i' };
    filter.$or = [
      { name: regex },
      { description: regex },
      { sku: regex },
      { barcode: regex },
      { batchNumber: regex },
      { supplierName: regex },
      { supplierPhone: regex },
      { category: regex },
      { container: regex },
      { warehouse: regex },
      { slug: regex },
    ];
  }

  const exactFields = {
    category: 100,
    supplierName: 120,
    container: 120,
    warehouse: 120,
    sku: 100,
    barcode: 100,
    batchNumber: 100,
    supplierPhone: 40,
    slug: 120,
  };
  Object.entries(exactFields).forEach(([field, maxLength]) => {
    const value = readText(query[field], maxLength);
    if (value) filter[field] = value;
  });

  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;
  if (query.hasImage === 'true') filter.image = { $type: 'string', $ne: '' };
  if (query.hasImage === 'false') {
    filter.$and = [...(filter.$and || []), { $or: [{ image: null }, { image: '' }] }];
  }
  if (query.lowStock === 'true') filter.$expr = { $lte: ['$stock', '$minStockLevel'] };
  if (query.lowStock === 'false') filter.$expr = { $gt: ['$stock', '$minStockLevel'] };
  const creatorId = readText(query.createdBy, 64);
  if (/^[a-f\d]{24}$/i.test(creatorId)) filter.createdBy = creatorId;
  const updaterId = readText(query.updatedBy, 64);
  if (/^[a-f\d]{24}$/i.test(updaterId)) filter.updatedBy = updaterId;
  const activityType = readText(query.activityType, 32);
  if (['creation', 'stock_update', 'price_update', 'sale', 'return', 'view', 'adjustment'].includes(activityType)) {
    filter['activities.type'] = activityType;
  }
  const expiryDate = createDateRange(query.expiryStart, query.expiryEnd);
  if (expiryDate) filter.expiryDate = expiryDate;
  const createdDate = createDateRange(query.productCreatedStart, query.productCreatedEnd);
  if (createdDate) filter.createdAt = createdDate;
  const updatedDate = createDateRange(query.productUpdatedStart, query.productUpdatedEnd);
  if (updatedDate) filter.updatedAt = updatedDate;

  addRange(filter, 'price', query.minPrice, query.maxPrice);
  addRange(filter, 'costPrice', query.minCostPrice, query.maxCostPrice);
  addRange(filter, 'stock', query.minStock, query.maxStock);
  addRange(filter, 'minStockLevel', query.minThreshold, query.maxThreshold);
  addRange(filter, 'viewsCount', query.minViews, query.maxViews);
  addRange(filter, 'returnsCount', query.minReturns, query.maxReturns);
  addRange(filter, 'conversionRate', query.minConversionRate, query.maxConversionRate);
  return filter;
};

module.exports = { buildProductFilter, buildSaleFilter, createDateRange };
