/**
 * ImportService — imports produits (Phase 7.8).
 *
 * Pipeline : upload (parse + validation par ligne, aperçu consultable)
 *          → confirm → run (lots bornés + points de contrôle + idempotence SKU).
 */
const ImportJob = require('../models/importJobModel');
const Product = require('../models/productModel');

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

const conflict = (message) => {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
};

// Parser CSV minimal (en-tête + lignes, guillemets gérés).
function parseCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw badRequest('CSV vide ou sans en-tête.');
  const parseLine = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else current += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { cells.push(current); current = ''; }
      else current += char;
    }
    cells.push(current);
    return cells;
  };
  const header = parseLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row = {};
    header.forEach((key, index) => { row[key] = (cells[index] || '').trim(); });
    return row;
  });
}

const REQUIRED_FIELDS = ['name', 'description', 'category', 'price'];

function validateRow(data) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!String(data[field] || '').trim()) errors.push({ field, message: `Champ requis : ${field}` });
  }
  const price = Number(data.price);
  if (data.price && (!Number.isFinite(price) || price < 0)) {
    errors.push({ field: 'price', message: 'Prix invalide (nombre ≥ 0 attendu)' });
  }
  for (const numeric of ['costPrice', 'stock', 'minStockLevel']) {
    if (data[numeric] !== undefined && data[numeric] !== '' && (!Number.isFinite(Number(data[numeric])) || Number(data[numeric]) < 0)) {
      errors.push({ field: numeric, message: `Valeur invalide pour ${numeric}` });
    }
  }
  return errors;
}

async function uploadProducts({ tenantId, rows = null, csv = null, fileName = '', requesterId = null }) {
  let rawRows;
  if (rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw badRequest('Aucune ligne à importer.');
    rawRows = rows;
  } else if (csv) {
    rawRows = parseCsv(csv);
  } else {
    throw badRequest('Fournir `rows` (tableau) ou `csv` (texte).');
  }
  if (rawRows.length > 5000) throw badRequest('Trop de lignes (maximum 5000).');

  const previewRows = rawRows.map((data, index) => {
    const errors = validateRow(data);
    return {
      rowNumber: index + 1,
      data,
      errors,
      status: errors.length ? 'invalid' : 'valid',
    };
  });
  const valid = previewRows.filter((row) => row.status === 'valid').length;

  return ImportJob.create({
    tenantId,
    type: 'products',
    fileName,
    status: valid === previewRows.length ? 'validated' : 'uploaded',
    rows: previewRows,
    stats: {
      total: previewRows.length,
      valid,
      invalid: previewRows.length - valid,
      created: 0,
      skipped: 0,
      failed: 0,
    },
    checkpointProcessed: 0,
    requester: requesterId,
  });
}

async function confirmImport({ tenantId, importId, userId = null }) {
  const job = await ImportJob.findOne({ tenantId, _id: importId });
  if (!job) throw notFound('Import introuvable dans cette organisation.');
  if (job.status !== 'validated') {
    throw conflict(`Impossible de confirmer un import « ${job.status} » (seules les lignes sans erreur sont confirmables).`);
  }
  job.status = 'confirmed';
  await job.save();
  return job;
}

async function startImport({ tenantId, importId, userId = null }) {
  const job = await ImportJob.findOne({ tenantId, _id: importId });
  if (!job) throw notFound('Import introuvable dans cette organisation.');
  if (!['confirmed', 'validated'].includes(job.status)) {
    throw conflict(`Impossible d'exécuter un import « ${job.status} ».`);
  }
  // Exécution en tâche de fond : jamais dans la requête HTTP.
  setImmediate(async () => {
    try {
      await runImport(job);
    } catch (error) {
      await ImportJob.updateOne(
        { _id: job._id, status: { $ne: 'completed' } },
        { $set: { status: 'failed', error: String(error.message || error), completedAt: new Date() } }
      );
    }
  });
  return job;
}

async function runImport(job) {
  await ImportJob.updateOne(
    { _id: job._id },
    { $set: { status: 'running', startedAt: new Date() } }
  );

  const batchSize = Math.max(1, job.batchSize || 50);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let offset = 0; offset < job.rows.length; offset += batchSize) {
    const batch = job.rows.slice(offset, offset + batchSize);
    for (const row of batch) {
      if (row.status !== 'valid') continue;
      try {
        const sku = String(row.data.sku || '').trim();
        if (sku) {
          const existing = await Product.findOne({ tenantId: job.tenantId, sku }).select('_id').lean();
          if (existing) {
            row.status = 'skipped';
            skipped += 1;
            continue;
          }
        }
        await Product.create({
          tenantId: job.tenantId,
          name: String(row.data.name).trim(),
          description: String(row.data.description).trim(),
          category: String(row.data.category).trim(),
          price: Number(row.data.price),
          costPrice: row.data.costPrice !== undefined && row.data.costPrice !== '' ? Number(row.data.costPrice) : undefined,
          stock: row.data.stock !== undefined && row.data.stock !== '' ? Number(row.data.stock) : 0,
          minStockLevel: row.data.minStockLevel !== undefined && row.data.minStockLevel !== '' ? Number(row.data.minStockLevel) : 5,
          sku: sku || undefined,
        });
        row.status = 'created';
        created += 1;
      } catch (error) {
        row.status = 'failed';
        failed += 1;
      }
    }
    // Point de contrôle après chaque lot.
    await ImportJob.updateOne(
      { _id: job._id },
      {
        $set: {
          rows: job.rows,
          checkpointProcessed: Math.min(offset + batchSize, job.rows.length),
          'stats.created': created,
          'stats.skipped': skipped,
          'stats.failed': failed,
        },
      }
    );
  }

  await ImportJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: 'completed',
        rows: job.rows,
        checkpointProcessed: job.rows.length,
        'stats.created': created,
        'stats.skipped': skipped,
        'stats.failed': failed,
        completedAt: new Date(),
      },
    }
  );
  return job._id;
}

async function listImports({ tenantId, page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const jobs = await ImportJob.find({ tenantId }).select('-rows').sort({ createdAt: -1 })
    .skip((safePage - 1) * safeLimit).limit(safeLimit).lean();
  const total = await ImportJob.countDocuments({ tenantId });
  return { page: safePage, limit: safeLimit, total, jobs };
}

async function getImport({ tenantId, importId }) {
  const job = await ImportJob.findOne({ tenantId, _id: importId }).lean();
  if (!job) throw notFound('Import introuvable dans cette organisation.');
  return job;
}

module.exports = { uploadProducts, confirmImport, startImport, listImports, getImport };
