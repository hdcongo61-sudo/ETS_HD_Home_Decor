/**
 * cashController — caisses, sessions et numérotation (Phases 5.3 + 5.7).
 */
const asyncHandler = require('express-async-handler');
const cashService = require('../services/cashService');

const asyncRoute = (fn) => asyncHandler(fn);

// @route   POST /api/v2/cash-registers
const createRegister = asyncRoute(async (req, res) => {
  const register = await cashService.createRegister({
    tenantId: req.tenantId,
    locationId: req.body.locationId || req.locationId,
    code: req.body.code,
    name: req.body.name,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(register);
});

// @route   POST /api/v2/cash-sessions/open
const openSession = asyncRoute(async (req, res) => {
  const session = await cashService.openSession({
    tenantId: req.tenantId,
    registerId: req.body.registerId,
    openingFloat: req.body.openingFloat || 0,
    userId: req.user ? req.user._id : null,
  });
  res.status(201).json(session);
});

// @route   GET /api/v2/cash-sessions/:id/state
const getSessionState = asyncRoute(async (req, res) => {
  const state = await cashService.getSessionState({
    tenantId: req.tenantId,
    sessionId: req.params.id,
  });
  res.json(state);
});

// @route   POST /api/v2/cash-sessions/:id/close
const closeSession = asyncRoute(async (req, res) => {
  const result = await cashService.closeSession({
    tenantId: req.tenantId,
    sessionId: req.params.id,
    countedClosing: req.body.countedClosing,
    userId: req.user ? req.user._id : null,
  });
  res.json(result);
});

// @route   POST /api/v2/numbering/next
const nextNumber = asyncRoute(async (req, res) => {
  // `locationId` explicite (même null pour une séquence organisation) prime
  // sur le contexte de boutique.
  const hasExplicitLocation = Object.prototype.hasOwnProperty.call(req.body, 'locationId');
  const locationId = hasExplicitLocation
    ? (req.body.locationId || null)
    : (req.locationId || null);
  const result = await cashService.nextNumber({
    tenantId: req.tenantId,
    locationId,
    docType: req.body.docType,
    fiscalPeriod: req.body.fiscalPeriod || null,
  });
  res.json(result);
});

module.exports = { createRegister, openSession, getSessionState, closeSession, nextNumber };
