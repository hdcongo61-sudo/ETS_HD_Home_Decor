/**
 * reportController — reporting paginé côté serveur (Phase 7.6).
 */
const asyncHandler = require('express-async-handler');
const reportService = require('../services/reportService');
const Sale = require('../models/saleModel');
const Employee = require('../models/employeeModel');
const { tenantFilter } = require('../utils/tenantQuery');

const csvEscape = (value) => {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

const toCsv = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(csvEscape).join(';')).join('\n');

const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
};

// @route   GET /api/v2/reports/sales
const salesReport = asyncHandler(async (req, res) => {
  const report = await reportService.salesReport({
    tenantId: req.tenantId,
    locationId: req.query.locationId || null,
    from: req.query.from || null,
    to: req.query.to || null,
    groupBy: req.query.groupBy || 'day',
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ report, generatedAt: new Date() });
});

// @route   GET /api/v2/reports/inventory
const inventoryReport = asyncHandler(async (req, res) => {
  const report = await reportService.inventoryReport({
    tenantId: req.tenantId,
    locationId: req.locationId || req.query.locationId || null,
    page: req.query.page,
    limit: req.query.limit,
    minStockOnly: req.query.minStockOnly === 'true',
  });
  res.json({ report, generatedAt: new Date() });
});

// @route   GET /api/v2/reports/vat-declaration?from&to
// Déclaration de TVA : ventes taxées de la période + total collecté (CSV).
const vatDeclarationCsv = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;

  const filter = { ...tenantFilter(req), taxAmount: { $gt: 0 } };
  if (from || to) {
    filter.saleDate = {};
    if (from) filter.saleDate.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.saleDate.$lte = end;
    }
  }

  const sales = await Sale.find(filter)
    .select('reference saleDate clientName totalAmount taxRate taxAmount taxLabel')
    .sort({ saleDate: 1 })
    .lean();

  const headers = ['Reference', 'Date', 'Client', 'Total TTC', 'Taux (%)', 'Libellé', 'TVA'];
  const rows = sales.map((sale) => [
    sale.reference || '',
    sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('fr-FR') : '',
    sale.clientName || '',
    Number(sale.totalAmount) || 0,
    Number(sale.taxRate) || 0,
    sale.taxLabel || 'TVA',
    Number(sale.taxAmount) || 0,
  ]);
  const totalVat = sales.reduce((sum, sale) => sum + (Number(sale.taxAmount) || 0), 0);
  rows.push(['', '', 'TOTAL COLLECTÉ', '', '', '', totalVat]);

  sendCsv(res, `declaration-tva-${Date.now()}.csv`, toCsv(headers, rows));
});

// @route   GET /api/v2/reports/payroll-summary
// Récapitulatif de paie (tous bulletins) — CSV.
const payrollSummaryCsv = asyncHandler(async (req, res) => {
  const employees = await Employee.find(tenantFilter(req)).select('name paySlips').lean();

  const headers = ['Employé', 'Mois', 'Année', 'Salaire de base', 'Primes', 'Retenues', 'Net à payer', 'Statut'];
  const rows = [];
  for (const employee of employees) {
    for (const slip of employee.paySlips || []) {
      rows.push([
        employee.name || '',
        slip.month || '',
        slip.year || '',
        Number(slip.baseSalary) || 0,
        Number(slip.bonuses) || 0,
        Number(slip.deductions) || 0,
        Number(slip.netSalary) || 0,
        slip.status || '',
      ]);
    }
  }

  sendCsv(res, `recapitulatif-paie-${Date.now()}.csv`, toCsv(headers, rows));
});

module.exports = { salesReport, inventoryReport, vatDeclarationCsv, payrollSummaryCsv };
