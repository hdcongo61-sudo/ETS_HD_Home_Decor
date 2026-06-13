const Document = require('../models/documentModel');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const asyncHandler = require('express-async-handler');
const sharp = require('sharp');
const { tenantFilter, applyTenant } = require('../utils/tenantQuery');

const DOCUMENT_FOLDER = 'business_documents';
const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Compress image buffer to stay under MAX_DOC_BYTES (WebP). Returns compressed buffer or original if not image. */
async function compressImageIfNeeded(buffer, mimetype) {
  if (!buffer || !mimetype || !mimetype.startsWith('image/')) return buffer;
  if (buffer.length <= MAX_DOC_BYTES) {
    try {
      const compressed = await sharp(buffer)
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      return compressed.length < buffer.length ? compressed : buffer;
    } catch {
      return buffer;
    }
  }
  let quality = 80;
  let lastBuffer = buffer;
  while (quality >= 20) {
    const out = await sharp(buffer)
      .webp({ quality, effort: 5 })
      .toBuffer();
    if (out.length <= MAX_DOC_BYTES) return out;
    lastBuffer = out;
    quality -= 15;
  }
  const resized = await sharp(buffer)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 50, effort: 6 })
    .toBuffer();
  return resized.length <= MAX_DOC_BYTES ? resized : lastBuffer;
}

const uploadDocumentToCloudinary = (buffer, mimetype) => new Promise((resolve, reject) => {
  const isImage = mimetype && mimetype.startsWith('image/');
  const resourceType = isImage ? 'image' : 'raw';
  const options = {
    folder: DOCUMENT_FOLDER,
    resource_type: resourceType,
  };
  if (isImage) {
    options.format = 'webp';
    options.quality = 'auto:good';
  }
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) return reject(error);
    return resolve(result.secure_url);
  });
  streamifier.createReadStream(buffer).pipe(stream);
});

// @desc    Get all documents (optional filter by year)
// @route   GET /api/documents?year=2024
// @access  Private / Admin
const getDocuments = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const filter = {};
  if (year) {
    const y = parseInt(year, 10);
    if (!Number.isNaN(y)) {
      filter.date = {
        $gte: new Date(y, 0, 1),
        $lt: new Date(y + 1, 0, 1),
      };
    }
  }
  const docs = await Document.find({ ...tenantFilter(req), ...filter }).sort({ date: -1 });
  res.json(docs);
});

// @desc    Get distinct years for filter dropdown
// @route   GET /api/documents/years
// @access  Private / Admin
const getDocumentYears = asyncHandler(async (req, res) => {
  const matchStage = req.tenantId ? { $match: { tenantId: req.tenantId } } : { $match: {} };
  const years = await Document.aggregate([
    matchStage,
    { $project: { year: { $year: '$date' } } },
    { $group: { _id: '$year' } },
    { $sort: { _id: -1 } },
  ]);
  res.json(years.map((y) => y._id));
});

// @desc    Upload a document
// @route   POST /api/documents
// @access  Private / Admin
const createDocument = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    res.status(400);
    throw new Error('Fichier requis.');
  }
  const { type, note, date } = req.body;
  if (!type || !date) {
    res.status(400);
    throw new Error('Type et date sont requis.');
  }
  let buffer = req.file.buffer;
  if (req.file.mimetype && req.file.mimetype.startsWith('image/')) {
    buffer = await compressImageIfNeeded(buffer, req.file.mimetype);
  }
  if (buffer.length > MAX_DOC_BYTES) {
    res.status(400);
    throw new Error('Le fichier dépasse 5 Mo après compression. Réduisez la taille ou la résolution.');
  }
  const fileUrl = await uploadDocumentToCloudinary(buffer, req.file.mimetype);
  const doc = await Document.create({
    type,
    fileName: req.file.originalname || 'document',
    fileUrl,
    note: note || '',
    date: new Date(date),
    createdBy: req.user._id,
  });
  res.status(201).json(doc);
});

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private / Admin
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Document introuvable.');
  }
  await doc.deleteOne();
  res.json({ message: 'Document supprimé.' });
});

module.exports = {
  getDocuments,
  getDocumentYears,
  createDocument,
  deleteDocument,
};
