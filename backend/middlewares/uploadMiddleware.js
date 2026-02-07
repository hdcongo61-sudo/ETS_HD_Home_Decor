const path = require('path');
const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype.startsWith('image/') && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Extensions permises: ${ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }
};

const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Documents: PDF and common office formats, max 5MB (will compress images to stay under)
const MAX_DOC_SIZE = 5 * 1024 * 1024;
const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
const docFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = DOC_EXTENSIONS.includes(ext) || file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('image/') ||
    file.mimetype.includes('document') ||
    file.mimetype.includes('sheet');
  if (allowed) {
    cb(null, true);
  } else {
    cb(new Error(`Format non autorisé. Autorisés: ${DOC_EXTENSIONS.join(', ')}`), false);
  }
};

const documentUpload = multer({
  storage,
  limits: { fileSize: MAX_DOC_SIZE },
  fileFilter: docFileFilter,
});

module.exports = { imageUpload, documentUpload };
