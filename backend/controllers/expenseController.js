const Expense = require('../models/expenseModel');
const asyncHandler = require('express-async-handler');
// @desc    Get all expenses with search
// @route   GET /api/expenses
// @access  Private/Admin
const getExpenses = asyncHandler(async (req, res) => {
  const { search, ...filters } = req.query;
  
  const query = {};
  
  // Filtrage
  if (filters.startDate && filters.endDate) {
    query.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
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
    const expense = new Expense({
      ...req.body,
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
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate);

  let expenseQuery = Expense.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort('date');

  if (req.user && req.user.isAdmin) {
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

  const updatedExpense = await Expense.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
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
