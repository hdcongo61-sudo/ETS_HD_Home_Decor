/**
 * ExportJobService — exports asynchrones (Phase 7.7).
 *
 * - `createAndRun` crée le job puis exécute la génération en tâche de fond ;
 * - le fichier est stocké sur disque (backend/exports/{tenant}/{job}.csv) ;
 * - le téléchargement exige le jeton signé et expire (défaut 24 h) ;
 * - `download` revérifie l'appartenance du tenant (jamais de mélange).
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ExportJob = require('../models/exportJobModel');
const Sale = require('../models/saleModel');
const InventoryBalance = require('../models/inventoryBalanceModel');
const { getUserPermissions } = require('./authorization');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');
const TTL_MS = 24 * 3600 * 1000; // 24 h

const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const notFound = (message) => {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function createAndRun({ tenantId, type, filters = {}, requesterId = null }) {
  if (!['sales', 'inventory'].includes(type)) throw badRequest('Type d\'export inconnu (sales|inventory).');
  const { permissions } = await getUserPermissions(tenantId, requesterId);
  const job = await ExportJob.create({
    tenantId,
    type,
    filters: filters || {},
    permissionsSnapshot: permissions,
    requester: requesterId,
    status: 'queued',
  });

  // Tâche de fond : n'exécute jamais le travail dans la requête HTTP.
  setImmediate(async () => {
    try {
      await runJob(job);
    } catch (error) {
      await ExportJob.updateOne(
        { _id: job._id, status: { $ne: 'completed' } },
        { $set: { status: 'failed', error: String(error.message || error), completedAt: new Date() } }
      );
    }
  });
  return job;
}

async function runJob(job) {
  await ExportJob.updateOne(
    { _id: job._id },
    { $set: { status: 'running', progress: 10, startedAt: new Date() } }
  );
  const jobDir = path.join(EXPORT_DIR, String(job.tenantId));
  await fs.mkdir(jobDir, { recursive: true });
  const fileName = `${job.type}-${job._id}.csv`;
  const filePath = path.join(jobDir, fileName);

  let rows = [];
  if (job.type === 'sales') {
    const filter = { tenantId: job.tenantId, status: { $ne: 'cancelled' } };
    const { from, to, locationId } = job.filters || {};
    if (from || to) {
      filter.saleDate = {};
      if (from) filter.saleDate.$gte = new Date(from);
      if (to) filter.saleDate.$lte = new Date(to);
    }
    if (locationId) filter.locationId = locationId;
    const sales = await Sale.find(filter).select('saleDate totalAmount payments status locationId').sort({ saleDate: 1 }).lean();
    const lines = [
      ['id', 'date', 'total', 'collected', 'outstanding', 'status'].join(','),
      ...sales.map((sale) => {
        const collected = (sale.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return [String(sale._id), sale.saleDate ? new Date(sale.saleDate).toISOString() : '', sale.totalAmount, collected, sale.totalAmount - collected, sale.status]
          .map(csvEscape).join(',');
      }),
    ];
    rows = lines;
  } else {
    const balances = await InventoryBalance.find({ tenantId: job.tenantId })
      .select('productId locationId onHand reserved available')
      .sort({ productId: 1 }).lean();
    const lines = [
      ['productId', 'locationId', 'onHand', 'reserved', 'available'].join(','),
      ...balances.map((balance) =>
        [String(balance.productId), String(balance.locationId || ''), balance.onHand, balance.reserved, balance.available]
          .map(csvEscape).join(',')),
    ];
    rows = lines;
  }

  await fs.writeFile(filePath, `${rows.join('\n')}\n`, 'utf8');
  const downloadToken = crypto.randomBytes(24).toString('hex');
  await ExportJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: 'completed',
        progress: 100,
        result: { fileName, contentType: 'text/csv', downloadToken, rows: Math.max(0, rows.length - 1) },
        expiresAt: new Date(Date.now() + TTL_MS),
        completedAt: new Date(),
      },
    }
  );
  return job._id;
}

async function listJobs({ tenantId, page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const jobs = await ExportJob.find({ tenantId })
    .select('-result.downloadToken')
    .sort({ createdAt: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .lean();
  const total = await ExportJob.countDocuments({ tenantId });
  return { page: safePage, limit: safeLimit, total, jobs };
}

async function getJob({ tenantId, jobId }) {
  // Le jeton de téléchargement est inclus ici : l'appelant est authentifié
  // et tenant-scopé (la liste reste, elle, sans jeton).
  const job = await ExportJob.findOne({ tenantId, _id: jobId }).lean();
  if (!job) throw notFound('Export introuvable dans cette organisation.');
  return job;
}

async function download({ jobId, token }) {
  // Accès par jeton aléatoire (48 hex) uniquement : le lien peut être ouvert
  // dans un nouvel onglet sans en-tête d'authentification.
  const job = await ExportJob.findOne({ _id: jobId }).lean();
  if (!job) throw notFound('Export introuvable dans cette organisation.');
  if (job.status !== 'completed' || !job.result || !job.result.downloadToken) {
    throw notFound('Export non disponible au téléchargement.');
  }
  if (!token || token !== job.result.downloadToken) {
    const err = new Error('Jeton de téléchargement invalide.');
    err.statusCode = 403;
    throw err;
  }
  if (job.expiresAt && new Date(job.expiresAt) < new Date()) {
    const err = new Error('Ce téléchargement a expiré.');
    err.statusCode = 410;
    throw err;
  }
  const filePath = path.join(EXPORT_DIR, String(job.tenantId), job.result.fileName);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { fileName: job.result.fileName, contentType: job.result.contentType, content };
  } catch (error) {
    throw notFound('Fichier d\'export introuvable.');
  }
}

module.exports = { createAndRun, listJobs, getJob, download };
