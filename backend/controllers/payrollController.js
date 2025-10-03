const Employee = require('../models/employeeModel');

// @desc    Create a pay slip for employee
// @route   POST /api/employees/:id/payroll
// @access  Private/Admin
const createPaySlip = async (req, res) => {
    try {
        const { month, year, deductions, bonuses, notes } = req.body;
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
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
            notes: notes || '',
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
        const { month, year, deductions, bonuses, notes, status } = req.body;
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
        if (notes !== undefined) paySlip.notes = notes;
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

// @desc    Request an advance
// @route   POST /api/employees/:id/advances
// @access  Private/Admin
const requestAdvance = async (req, res) => {
    try {
        const { amount, reason, status } = req.body;
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const maxAdvance = employee.salary * 0.5;
        if (amount > maxAdvance) {
            return res.status(400).json({
                message: `Advance cannot exceed ${maxAdvance} CFA (50% of salary)`
            });
        }

        const advance = {
            amount,
            reason,
            status: status || 'pending',
            date: new Date()
        };

        employee.advances.push(advance);
        await employee.save();

        res.status(201).json(advance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update an advance
// @route   PUT /api/employees/:id/advances/:advanceId
// @access  Private/Admin
const updateAdvance = async (req, res) => {
    try {
        const { amount, reason, status } = req.body;
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const advance = employee.advances.id(req.params.advanceId);
        if (!advance) {
            return res.status(404).json({ message: 'Advance not found' });
        }

        // Vérifier la limite si le montant est modifié
        if (amount !== undefined) {
            const maxAdvance = employee.salary * 0.5;
            if (amount > maxAdvance) {
                return res.status(400).json({
                    message: `Advance cannot exceed ${maxAdvance} CFA (50% of salary)`
                });
            }
            advance.amount = amount;
        }

        if (reason !== undefined) advance.reason = reason;
        if (status !== undefined) advance.status = status;

        await employee.save();
        res.json(advance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete an advance
// @route   DELETE /api/employees/:id/advances/:advanceId
// @access  Private/Admin
const deleteAdvance = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const advanceIndex = employee.advances.findIndex(
            adv => adv._id.toString() === req.params.advanceId
        );

        if (advanceIndex === -1) {
            return res.status(404).json({ message: 'Advance not found' });
        }

        employee.advances.splice(advanceIndex, 1);
        await employee.save();

        res.json({ message: 'Advance removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all advances for an employee
// @route   GET /api/employees/:id/advances
// @access  Private/Admin
const getEmployeeAdvances = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee.advances);
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
        const totalAdvances = employee.advances
            .filter(adv => adv.status === 'approved')
            .reduce((sum, adv) => sum + adv.amount, 0);

        res.json({
            salary: employee.salary,
            totalPaid,
            totalAdvances,
            balance: totalPaid - totalAdvances
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

// routes/payroll.js
const exportPayListPDF = async (req, res) => {
    try {

        const payslip = await Employee.Payslip.findById(req.params.payslipId);
        const employee = await Employee.findById(req.params.id);

        // Utilisez une bibliothèque comme pdfkit ou puppeteer
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=fiche-paie-${employee.name}-${payslip.month}-${payslip.year}.pdf`);
        doc.pipe(res);

        // Génération du contenu PDF...
        doc.text(`Fiche de paie - ${employee.name}`, 100, 100);
        // ...

        doc.end();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createPaySlip,
    updatePaySlip,
    deletePaySlip,
    getPaySlip,
    requestAdvance,
    updateAdvance,
    deleteAdvance,
    getEmployeeAdvances,
    getEmployeePaySlips,
    getFinancialSummary,
    getDashboardStats,
    exportPayListPDF
};