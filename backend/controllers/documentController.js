const Document = require('../models/documentModel');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const asyncHandler = require('express-async-handler');

const DOCUMENT_FOLDER = 'business_documents';

const uploadDocumentToCloudinary = (buffer, mimetype, originalName) => new Promise((resolve, reject) => {
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
  const docs = await Document.find(filter).sort({ date: -1 });
  res.json(docs);
});

// @desc    Get distinct years for filter dropdown
// @route   GET /api/documents/years
// @access  Private / Admin
const getDocumentYears = asyncHandler(async (req, res) => {
  const years = await Document.aggregate([
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
  const fileUrl = await uploadDocumentToCloudinary(
    req.file.buffer,
    req.file.mimetype,
    req.file.originalname
  );
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
