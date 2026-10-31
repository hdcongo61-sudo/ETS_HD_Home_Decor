const express = require('express');
const {
  getAccounts,
  createAccount,
  updateAccount,
  seedAccounts,
  getJournalEntries,
  createJournalEntry,
  deleteJournalEntry,
  getTrialBalance,
  getAccountLedger,
} = require('../controllers/ledgerController');
const { protect, requireTenant, admin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Comptes (plan comptable)
router.route('/accounts')
  .get(protect, requireTenant, getAccounts)
  .post(protect, requireTenant, admin, createAccount);
router.post('/accounts/seed', protect, requireTenant, admin, seedAccounts);
router.put('/accounts/:id', protect, requireTenant, admin, updateAccount);
router.get('/accounts/:id/ledger', protect, requireTenant, getAccountLedger);

// Écritures (journal)
router.route('/entries')
  .get(protect, requireTenant, getJournalEntries)
  .post(protect, requireTenant, admin, createJournalEntry);
router.delete('/entries/:id', protect, requireTenant, admin, deleteJournalEntry);

// Balance comptable
router.get('/trial-balance', protect, requireTenant, getTrialBalance);

module.exports = router;
