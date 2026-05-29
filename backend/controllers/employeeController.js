const Employee = require('../models/employeeModel');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');

const uploadEmployeePhoto = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'employees',
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:good',
    },
    (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result.secure_url);
    }
  );

  streamifier.createReadStream(buffer).pipe(stream);
});

const parseBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
};

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
const createEmployee = async (req, res) => {
  try {
    let photoUrl = req.body.photo;
    if (req.file?.buffer) {
      photoUrl = await uploadEmployeePhoto(req.file.buffer);
    }

    const employee = new Employee({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      position: req.body.position,
      salary: req.body.salary,
      hireDate: req.body.hireDate,
      department: req.body.department || '',
      photo: photoUrl,
      isActive: parseBoolean(req.body.isActive, true),
      leftDate: parseBoolean(req.body.isActive, true) ? null : req.body.leftDate || null,
      inactiveReason: parseBoolean(req.body.isActive, true) ? '' : req.body.inactiveReason || '',
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
    const employee = await Employee.findById(req.params.id);
    let resolvedPhoto;
    const hasPhotoField = Object.prototype.hasOwnProperty.call(req.body, 'photo');

    if (req.file?.buffer) {
      resolvedPhoto = await uploadEmployeePhoto(req.file.buffer);
    } else if (hasPhotoField) {
      resolvedPhoto = req.body.photo;
    }

    if (employee) {
      employee.name = req.body.name || employee.name;
      employee.email = req.body.email || employee.email;
      employee.phone = req.body.phone || employee.phone;
      employee.position = req.body.position || employee.position;
      employee.salary = req.body.salary || employee.salary;
      employee.hireDate = req.body.hireDate || employee.hireDate;
      employee.department = req.body.department || employee.department;
      if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
        employee.isActive = parseBoolean(req.body.isActive, employee.isActive);
        employee.leftDate = employee.isActive ? null : req.body.leftDate || employee.leftDate || new Date();
        employee.inactiveReason = employee.isActive ? '' : req.body.inactiveReason || '';
      }
      if (resolvedPhoto !== undefined) {
        employee.photo = resolvedPhoto;
      }

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

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
