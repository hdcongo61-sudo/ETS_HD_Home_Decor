const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const {
  createPaySlip,
  updatePaySlip,
  deletePaySlip,
  getPaySlip,
  getEmployeePaySlips,
  getFinancialSummary,
} = require('../controllers/payrollController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

router.route('/')
  .get(protect, admin, getEmployees)
  .post(protect, admin, imageUpload.single('photoFile'), createEmployee);

router.route('/:id')
  .get(protect, admin, getEmployeeById)
  .put(protect, admin, imageUpload.single('photoFile'), updateEmployee)
  .delete(protect, admin, deleteEmployee);

// Routes pour la gestion des fiches de paie
router.route('/:id/payroll')
  .post(protect, admin, createPaySlip)
  .get(protect, admin, getEmployeePaySlips);

// Route spécifique pour une fiche de paie individuelle (AJOUTÉE)
router.route('/:id/payroll/:payslipId')
  .get(protect, admin, getPaySlip) // Route GET pour une fiche spécifique
  .put(protect, admin, updatePaySlip)
  .delete(protect, admin, deletePaySlip);

// Route pour le résumé financier
router.route('/:id/financial-summary')
  .get(protect, admin, getFinancialSummary);

module.exports = router;
