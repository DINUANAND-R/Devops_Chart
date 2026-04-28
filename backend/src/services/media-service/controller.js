const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// Ensure upload dir exists relative to root app directory
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

/**
 * POST /api/media/upload
 */
exports.uploadFile = [
  upload.single('file'),
  (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

      logger.info(`File uploaded: ${req.file.filename} by user ${req.user.id}`);

      res.json({
        success: true,
        file: {
          url: fileUrl,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: req.file.mimetype.startsWith('image') ? 'image' :
                req.file.mimetype.startsWith('video') ? 'video' :
                req.file.mimetype.startsWith('audio') ? 'audio' : 'file',
        },
      });
    } catch (err) {
      next(err);
    }
  },
];
