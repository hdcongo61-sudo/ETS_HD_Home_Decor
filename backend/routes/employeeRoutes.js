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
  requestAdvance,
  updateAdvance,
  deleteAdvance,
  getPaySlip, // Assurez-vous que cette fonction est importée
  getEmployeeAdvances,
  getEmployeePaySlips,
  getFinancialSummary,
  exportPayListPDF
} = require('../controllers/payrollController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, admin, getEmployees)
  .post(protect, admin, createEmployee);

router.route('/:id')
  .get(protect, admin, getEmployeeById)
  .put(protect, admin, updateEmployee)
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

router.route('/:id/payroll/:payslipId/pdf').get(protect, admin, exportPayListPDF)
// Routes pour les avances
router.route('/:id/advances')
  .post(protect, admin, requestAdvance)
  .get(protect, admin, getEmployeeAdvances);

router.route('/:id/advances/:advanceId')
  .put(protect, admin, updateAdvance)
  .delete(protect, admin, deleteAdvance);

// Route pour le résumé financier
router.route('/:id/financial-summary')
  .get(protect, admin, getFinancialSummary);

module.exports = router;