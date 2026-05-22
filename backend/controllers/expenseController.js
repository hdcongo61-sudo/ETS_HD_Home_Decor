const Expense = require('../models/expenseModel');
const asyncHandler = require('express-async-handler');

const parseOptionalExpenseDate = (value) => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return { value: null };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'Format de date de dépense invalide' };
  }

  return { value: parsed };
};

const buildDateRangeFilter = (startDate, endDate) => {
  const dateFilter = {};

  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return { error: 'Date de début invalide' };
    }
    start.setHours(0, 0, 0, 0);
    dateFilter.$gte = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return { error: 'Date de fin invalide' };
    }
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  return { value: Object.keys(dateFilter).length > 0 ? dateFilter : null };
};
// @desc    Get all expenses with search
// @route   GET /api/expenses
// @access  Private/Admin
const getExpenses = asyncHandler(async (req, res) => {
  const { search, ...filters } = req.query;
  
  const query = {};
  
  // Filtrage
  const dateRange = buildDateRangeFilter(filters.startDate, filters.endDate);
  if (dateRange.error) {
    return res.status(400).json({ message: dateRange.error });
  }
  if (dateRange.value) {
    query.date = dateRange.value;
  }
  if (filters.category) query.category = filters.category;
  
  // Recherche
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { 'paymentMethod': { $regex: search, $options: 'i' } }
    ];
  }

  let expenseQuery = Expense.find(query).sort('-date');

  if (req.user && req.user.isAdmin) {
    expenseQuery = expenseQuery
      .select('+createdBy +updatedBy')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  const expenses = await expenseQuery.lean();
  res.json(expenses);
});
// @desc    Create an expense
// @route   POST /api/expenses
// @access  Private/Admin
const createExpense = async (req, res) => {
  try {
    const parsedExpenseDate = parseOptionalExpenseDate(req.body.date);
    if (parsedExpenseDate.error) {
      return res.status(400).json({ message: parsedExpenseDate.error });
    }

    const expense = new Expense({
      ...req.body,
      date: parsedExpenseDate.value || new Date(),
      createdBy: req.user ? req.user._id : undefined,
      updatedBy: req.user ? req.user._id : undefined
    });
    const createdExpense = await expense.save();
    res.status(201).json(createdExpense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get expenses by date range
// @route   GET /api/expenses/date-range
// @access  Private
const getExpensesByDateRange = asyncHandler(async (req, res) => {
  const dateRange = buildDateRangeFilter(req.query.startDate, req.query.endDate);
  const summaryMode = String(req.query.summary || '').trim().toLowerCase();

  if (dateRange.error) {
    return res.status(400).json({ message: dateRange.error });
  }

  let expenseQuery = Expense.find(dateRange.value ? { date: dateRange.value } : {}).sort('date');

  if (summaryMode === 'dashboard') {
    expenseQuery = expenseQuery.select('_id description amount category supplier date createdAt');
  } else if (req.user && req.user.isAdmin) {
    expenseQuery = expenseQuery
      .select('+createdBy +updatedBy')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  const expenses = await expenseQuery.lean();

  res.json(expenses);
});

// @desc    Delete an expense
// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private/Admin
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  
  if (!expense) {
    res.status(404);
    throw new Error('Dépense non trouvée');
  }

  await expense.deleteOne();
  res.json({ message: 'Dépense supprimée' });
});

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private/Admin
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  
  if (!expense) {
    res.status(404);
    throw new Error('Dépense non trouvée');
  }

  const parsedExpenseDate = parseOptionalExpenseDate(req.body.date);
  if (parsedExpenseDate.error) {
    return res.status(400).json({ message: parsedExpenseDate.error });
  }

  const updatedExpense = await Expense.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      date: parsedExpenseDate.value || expense.date,
      updatedBy: req.user ? req.user._id : undefined
    },
    { new: true, runValidators: true }
  )
    .select(req.user && req.user.isAdmin ? '+createdBy +updatedBy' : '')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  res.json(updatedExpense);
});

module.exports = {
  getExpenses,
  createExpense,
  getExpensesByDateRange,
  deleteExpense,
  updateExpense
};
