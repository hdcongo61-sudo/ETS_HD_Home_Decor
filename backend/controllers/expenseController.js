const Expense = require('../models/expenseModel');
const Employee = require('../models/employeeModel');
const asyncHandler = require('express-async-handler');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isSalaryCategory = (category) => {
  const normalized = normalizeText(category);
  return normalized === 'salaries' || normalized === 'salary' || normalized.includes('salaire');
};

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

// A full ISO timestamp (e.g. "2026-06-28T23:00:00.000Z") already carries a
// precise instant — typically a client-side period boundary like startOfWeek().
// A date-only string (e.g. "2026-06-28", from an <input type="date">) needs to
// be expanded to cover the whole day. Re-flooring an ISO instant with setHours()
// would shift it by the server/UTC offset, leaking a neighbouring day's data.
const hasTimeComponent = (value) => typeof value === 'string' && /T\d/.test(value);

const buildDateRangeFilter = (startDate, endDate) => {
  const dateFilter = {};

  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return { error: 'Date de début invalide' };
    }
    if (!hasTimeComponent(startDate)) {
      start.setHours(0, 0, 0, 0);
    }
    dateFilter.$gte = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return { error: 'Date de fin invalide' };
    }
    if (!hasTimeComponent(endDate)) {
      end.setHours(23, 59, 59, 999);
    }
    dateFilter.$lte = end;
  }

  return { value: Object.keys(dateFilter).length > 0 ? dateFilter : null };
};

const resolveSalaryPeriod = (body, fallbackDate) => {
  const month = Number(body.salaryMonth);
  const year = Number(body.salaryYear);

  if (Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 2000 && year <= 2100) {
    return { salaryMonth: month, salaryYear: year };
  }

  const date = fallbackDate ? new Date(fallbackDate) : new Date();
  return {
    salaryMonth: date.getMonth() + 1,
    salaryYear: date.getFullYear(),
  };
};

const buildExpensePayload = (body, expenseDate, userId) => {
  const category = body.category;
  const salaryExpense = isSalaryCategory(category);
  const salaryPeriod = salaryExpense ? resolveSalaryPeriod(body, expenseDate) : { salaryMonth: null, salaryYear: null };

  return {
    description: body.description,
    amount: Number(body.amount),
    category,
    paymentMethod: body.paymentMethod,
    date: expenseDate,
    employee: salaryExpense ? body.employee || body.employeeId || null : null,
    salaryMonth: salaryPeriod.salaryMonth,
    salaryYear: salaryPeriod.salaryYear,
    updatedBy: userId,
  };
};

const validateSalaryExpense = async (payload, currentExpenseId = null) => {
  if (!isSalaryCategory(payload.category)) {
    return { payload: { ...payload, employee: null, salaryMonth: null, salaryYear: null } };
  }

  if (!payload.employee) {
    return { error: 'Sélectionnez un employé pour une dépense de salaire' };
  }

  const employee = await Employee.findById(payload.employee).select('name salary').lean();
  if (!employee) {
    return { error: 'Employé introuvable pour cette dépense de salaire' };
  }

  if (!payload.salaryMonth || !payload.salaryYear) {
    return { error: 'Sélectionnez le mois du salaire' };
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return { error: 'Montant invalide' };
  }

  const existingQuery = {
    employee: payload.employee,
    salaryMonth: payload.salaryMonth,
    salaryYear: payload.salaryYear,
  };

  if (currentExpenseId) {
    existingQuery._id = { $ne: currentExpenseId };
  }

  const existingExpenses = await Expense.find(existingQuery).select('amount category').lean();
  const alreadyPaid = existingExpenses
    .filter((expense) => isSalaryCategory(expense.category))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const remainingSalary = Number(employee.salary || 0) - alreadyPaid;

  if (payload.amount > remainingSalary) {
    return {
      error: `Montant supérieur au salaire restant de ${employee.name} pour ce mois (${Math.max(remainingSalary, 0).toLocaleString('fr-FR')} CFA restants)`,
    };
  }

  return { payload };
};

const populateExpenseMetadata = (query, req) => {
  let nextQuery = query.populate('employee', 'name position salary slug');

  if (req.user && req.user.isAdmin) {
    nextQuery = nextQuery
      .select('+createdBy +updatedBy')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
  }

  return nextQuery;
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
  if (filters.employee) query.employee = filters.employee;
  if (filters.salaryMonth) query.salaryMonth = Number(filters.salaryMonth);
  if (filters.salaryYear) query.salaryYear = Number(filters.salaryYear);
  
  // Recherche
  if (search) {
    const matchingEmployees = await Employee.find({ ...tenantFilter(req), name: { $regex: search, $options: 'i' } })
      .select('_id')
      .lean();
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
      { 'paymentMethod': { $regex: search, $options: 'i' } },
      ...(matchingEmployees.length ? [{ employee: { $in: matchingEmployees.map((employee) => employee._id) } }] : [])
    ];
  }

  const expenseQuery = populateExpenseMetadata(Expense.find(query).sort('-date'), req);

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

    const expenseDate = parsedExpenseDate.value || new Date();
    const payload = buildExpensePayload(req.body, expenseDate, req.user ? req.user._id : undefined);
    const salaryValidation = await validateSalaryExpense(payload);
    if (salaryValidation.error) {
      return res.status(400).json({ message: salaryValidation.error });
    }

    const expense = new Expense({ tenantId: req.tenantId,
      ...salaryValidation.payload,
      createdBy: req.user ? req.user._id : undefined,
    });
    const savedExpense = await expense.save();
    const createdExpense = await populateExpenseMetadata(Expense.findById(savedExpense._id), req).lean();
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

  let expenseQuery = Expense.find(dateRange.value ? { date: dateRange.value } : {}).sort('date').populate('employee', 'name position salary slug');

  if (summaryMode === 'dashboard') {
    expenseQuery = expenseQuery.select('_id description amount category supplier date createdAt employee salaryMonth salaryYear');
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

  const expenseDate = parsedExpenseDate.value || expense.date;
  const payload = buildExpensePayload(req.body, expenseDate, req.user ? req.user._id : undefined);
  const salaryValidation = await validateSalaryExpense(payload, req.params.id);
  if (salaryValidation.error) {
    return res.status(400).json({ message: salaryValidation.error });
  }

  await Expense.findByIdAndUpdate(
    req.params.id,
    salaryValidation.payload,
    { new: true, runValidators: true }
  );

  const updatedExpense = await populateExpenseMetadata(Expense.findById(req.params.id), req).lean();

  res.json(updatedExpense);
});

module.exports = {
  getExpenses,
  createExpense,
  getExpensesByDateRange,
  deleteExpense,
  updateExpense
};
