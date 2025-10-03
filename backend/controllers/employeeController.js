const Employee = require('../models/employeeModel');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private/Admin
const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({});
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private/Admin
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an employee
// @route   POST /api/employees
// @access  Private/Admin
// const createEmployee = async (req, res) => {
//   try {
//     const employee = new Employee(req.body);
//     const createdEmployee = await employee.save();
//     res.status(201).json(createdEmployee);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };
const createEmployee = async (req, res) => {
  try {
    const employee = new Employee({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      position: req.body.position,
      salary: req.body.salary,
      hireDate: req.body.hireDate,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      postalCode: req.body.postalCode,
      department: req.body.department || ''
    });

    await employee.save();
    res.status(201).json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
// @desc    Update an employee
// @route   PUT /api/employees/:id
// @access  Private/Admin
const updateEmployee = async (req, res) => {
  try {
    const { name, email, phone, position, salary, hireDate, address, city, country, postalCode, department } = req.body;
    const employee = await Employee.findById(req.params.id);

    if (employee) {
      employee.name = req.body.name || employee.name;
      employee.email = req.body.email || employee.email;
      employee.phone = req.body.phone || employee.phone;
      employee.position = req.body.position || employee.position;
      employee.salary = req.body.salary || employee.salary;
      employee.hireDate = req.body.hireDate || employee.hireDate;
      employee.address = req.body.address || employee.address;
      employee.city = req.body.city || employee.city;
      employee.country = req.body.country || employee.country;
      employee.postalCode = req.body.postalCode || employee.postalCode;
      employee.department = req.body.department || employee.department;

      const updatedEmployee = await employee.save();
      res.json(updatedEmployee);
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private/Admin
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (employee) {
      await employee.deleteOne();
      res.json({ message: 'Employee removed' });
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request salary advance
// @route   POST /api/employees/:id/advances
// @access  Private
const requestAdvance = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (amount > employee.baseSalary * 0.3) {
      return res.status(400).json({
        message: 'Advance cannot exceed 30% of base salary'
      });
    }

    employee.advanceRequests.push({
      amount,
      reason,
      status: 'pending'
    });

    await employee.save();
    res.status(201).json(employee.advanceRequests[employee.advanceRequests.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Process advance request
// @route   PUT /api/employees/:id/advances/:advanceId
// @access  Private/Admin
const processAdvance = async (req, res) => {
  try {
    const { status } = req.body;
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const advance = employee.advanceRequests.id(req.params.advanceId);
    if (!advance) {
      return res.status(404).json({ message: 'Advance request not found' });
    }

    advance.status = status;
    advance.responseDate = new Date();

    if (status === 'approved') {
      employee.totalAdvances += advance.amount;
    }

    await employee.save();
    res.json(advance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate payslip
// @route   POST /api/employees/:id/payslips
// @access  Private/Admin
const generatePayslip = async (req, res) => {
  try {
    const { month, year, bonuses, deductions } = req.body;
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if payslip already exists for this month/year
    const existingPayslip = employee.payslips.find(
      p => p.month === month && p.year === year
    );
    if (existingPayslip) {
      return res.status(400).json({
        message: 'Payslip already exists for this period'
      });
    }

    const netSalary = employee.baseSalary + bonuses - deductions - employee.totalAdvances;

    const payslip = {
      month,
      year,
      baseSalary: employee.baseSalary,
      bonuses,
      deductions,
      advances: employee.totalAdvances,
      netSalary,
      paymentDate: new Date(),
      status: 'generated'
    };

    employee.payslips.push(payslip);
    employee.totalAdvances = 0; // Reset advances after payslip generation
    await employee.save();

    res.status(201).json(employee.payslips[employee.payslips.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee payslips
// @route   GET /api/employees/:id/payslips
// @access  Private
const getEmployeePayslips = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('payslips name');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      employee: employee.name,
      payslips: employee.payslips
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payslips
// @route   GET /api/employees/payslips
// @access  Private/Admin
const getAllPayslips = async (req, res) => {
  try {
    const employees = await Employee.find({}).select('payslips name position');

    // Créer un tableau plat de toutes les fiches de paie avec les infos employé
    const allPayslips = employees.reduce((acc, employee) => {
      const employeePayslips = employee.payslips.map(payslip => ({
        ...payslip.toObject(),
        employeeId: employee._id,
        employeeName: employee.name,
        employeePosition: employee.position
      }));
      return [...acc, ...employeePayslips];
    }, []);

    res.json(allPayslips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  requestAdvance,
  processAdvance,
  generatePayslip,
  getEmployeePayslips,
  getAllPayslips
};


