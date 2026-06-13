const Employee = require('../models/employeeModel');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

// @desc    Create a pay slip for employee
// @route   POST /api/employees/:id/payroll
// @access  Private/Admin
const createPaySlip = async (req, res) => {
    try {
        const { month, year, deductions, bonuses } = req.body;
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (employee.isActive === false) {
            return res.status(400).json({ message: 'Cannot create a pay slip for an inactive employee' });
        }

        // Vérifier s'il existe déjà une fiche pour ce mois/année
        const existingPaySlip = employee.paySlips.find(
            slip => slip.month === month && slip.year === year
        );

        if (existingPaySlip) {
            return res.status(400).json({
                message: 'A pay slip already exists for this month and year'
            });
        }

        const netSalary = employee.salary + (parseFloat(bonuses) || 0) - (parseFloat(deductions) || 0);

        const paySlip = {
            month: parseInt(month),
            year: parseInt(year),
            baseSalary: employee.salary,
            deductions: parseFloat(deductions) || 0,
            bonuses: parseFloat(bonuses) || 0,
            netSalary,
            status: 'pending',
            paymentDate: new Date()
        };

        employee.paySlips.push(paySlip);
        await employee.save();

        res.status(201).json(paySlip);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
// @desc    Get a specific pay slip
// @route   GET /api/employees/:employeeId/payroll/:payslipId
// @access  Private/Admin
const getPaySlip = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Méthode alternative pour trouver la fiche de paie
        const paySlip = employee.paySlips.find(
            slip => slip._id.toString() === req.params.payslipId
        );

        if (!paySlip) {
            return res.status(404).json({
                message: `Pay slip not found for employee ${req.params.id}`
            });
        }

        res.json(paySlip);
    } catch (error) {
        // Journalisation détaillée de l'erreur
        console.error(`Error fetching pay slip ${req.params.payslipId}:`, error);
        res.status(500).json({
            message: 'Server error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
// @desc    Update a pay slip
// @route   PUT /api/employees/:id/payroll/:payslipId
// @access  Private/Admin
const updatePaySlip = async (req, res) => {
    try {
        const { month, year, deductions, bonuses, status } = req.body;
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const paySlip = employee.paySlips.id(req.params.payslipId);
        if (!paySlip) {
            return res.status(404).json({ message: 'Pay slip not found' });
        }

        // Mise à jour des champs
        if (month) paySlip.month = parseInt(month);
        if (year) paySlip.year = parseInt(year);
        if (deductions !== undefined) paySlip.deductions = parseFloat(deductions);
        if (bonuses !== undefined) paySlip.bonuses = parseFloat(bonuses);
        if (status) paySlip.status = status;

        // Recalculer le salaire net
        paySlip.netSalary = employee.salary + paySlip.bonuses - paySlip.deductions;

        // Si le statut est "paid", mettre à jour la date de paiement
        if (status === 'paid') {
            paySlip.paymentDate = new Date();
        }

        await employee.save();
        res.json(paySlip);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a pay slip
// @route   DELETE /api/employees/:id/payroll/:payslipId
// @access  Private/Admin
const deletePaySlip = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const paySlipIndex = employee.paySlips.findIndex(
            slip => slip._id.toString() === req.params.payslipId
        );

        if (paySlipIndex === -1) {
            return res.status(404).json({ message: 'Pay slip not found' });
        }

        employee.paySlips.splice(paySlipIndex, 1);
        await employee.save();

        res.json({ message: 'Pay slip removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all pay slips for an employee
// @route   GET /api/employees/:id/payroll
// @access  Private/Admin
const getEmployeePaySlips = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee.paySlips);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get financial summary for an employee
// @route   GET /api/employees/:id/financial-summary
// @access  Private/Admin
const getFinancialSummary = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const totalPaid = employee.paySlips.reduce((sum, slip) => sum + slip.netSalary, 0);
        res.json({
            salary: employee.salary,
            totalPaid,
            balance: totalPaid
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard statistics
// @route   GET /api/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        // Récupérer le nombre total d'employés
        const totalEmployees = await Employee.countDocuments();

        // Récupérer les fiches de paie du mois courant
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const employees = await Employee.find();

        let paySlipsThisMonth = 0;
        let totalSalary = 0;

        employees.forEach(employee => {
            employee.paySlips.forEach(slip => {
                if (slip.month === currentMonth && slip.year === currentYear) {
                    paySlipsThisMonth++;
                    totalSalary += slip.netSalary;
                }
            });
        });

        res.json({
            totalEmployees,
            paySlipsThisMonth,
            totalSalary
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createPaySlip,
    updatePaySlip,
    deletePaySlip,
    getPaySlip,
    getEmployeePaySlips,
    getFinancialSummary,
    getDashboardStats,
};
