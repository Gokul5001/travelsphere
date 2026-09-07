// routes/visaRoutes.js
//
// Requires: npm install multer
//
// Assumes an auth middleware module exists at '../middleware/authMiddleware' that
// populates req.user, consistent with req.user.id usage in paymentController.js.
// Adjust the import path/name if yours differs (e.g. verifyToken, requireAuth).

const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');const {
  submitApplication,
  getMyApplications,
  getApplicationDocuments,
  uploadDocument,
  getDocumentDownloadUrl,
  deleteDocument,
} = require('../controllers/visaController');

const router = express.Router();

// Memory storage: files are buffered in memory then streamed straight to S3
// (see visaController.uploadDocument), never written to local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, kept in sync with MAX_FILE_SIZE in visaController.js
});

router.use(protect);

router.post('/applications', submitApplication);
router.get('/applications', getMyApplications);
router.get('/applications/:id/documents', getApplicationDocuments);
router.post('/applications/:id/documents', upload.single('file'), uploadDocument);
router.get('/documents/:id/download', getDocumentDownloadUrl);
router.delete('/documents/:id', deleteDocument);

module.exports = router;