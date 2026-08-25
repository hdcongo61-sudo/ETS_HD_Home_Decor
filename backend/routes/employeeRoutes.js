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
const { protect, admin, requireTenant } = require('../middlewares/authMiddleware');
const { imageUpload } = require('../middlewares/uploadMiddleware');

router.route('/')
  .get(protect, requireTenant, admin, getEmployees)
  .post(protect, requireTenant, admin, imageUpload.single('photoFile'), createEmployee);

router.route('/:id')
  .get(protect, requireTenant, admin, getEmployeeById)
  .put(protect, requireTenant, admin, imageUpload.single('photoFile'), updateEmployee)
  .delete(protect, requireTenant, admin, deleteEmployee);

// Routes pour la gestion des fiches de paie
router.route('/:id/payroll')
  .post(protect, requireTenant, admin, createPaySlip)
  .get(protect, requireTenant, admin, getEmployeePaySlips);

// Route spécifique pour une fiche de paie individuelle (AJOUTÉE)
router.route('/:id/payroll/:payslipId')
  .get(protect, requireTenant, admin, getPaySlip) // Route GET pour une fiche spécifique
  .put(protect, requireTenant, admin, updatePaySlip)
  .delete(protect, requireTenant, admin, deletePaySlip);

// Route pour le résumé financier
router.route('/:id/financial-summary')
  .get(protect, requireTenant, admin, getFinancialSummary);

module.exports = router;
