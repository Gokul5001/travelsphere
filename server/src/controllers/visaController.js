// controllers/visaController.js
//
// Requires: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner uuid
//
// Assumes req.user.id is populated by your auth middleware (same pattern used
// in paymentController.js / bookingController.js).

const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { s3Client, bucketName } = require('../config/s3');
const {
  createVisaApplication,
  getVisaApplicationsForUser,
  getVisaApplicationById,
  createVisaDocument,
  getDocumentsForApplication,
  getVisaDocumentById,
  deleteVisaDocument,
} = require('../models/visaModel');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, must match multer limit in visaRoutes.js

async function submitApplication(req, res) {
  try {
    const {
      destinationCountry,
      visaType,
      passportNumber,
      passportExpiry,
      travelDate,
      returnDate,
    } = req.body;

    if (!destinationCountry || !passportNumber || !passportExpiry || !travelDate) {
      return res.status(400).json({
        error: 'destinationCountry, passportNumber, passportExpiry and travelDate are required',
      });
    }

    const application = await createVisaApplication({
      userId: req.user.id,
      destinationCountry,
      visaType,
      passportNumber,
      passportExpiry,
      travelDate,
      returnDate,
    });

    res.status(201).json({ application });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit visa application' });
  }
}

async function getMyApplications(req, res) {
  try {
    const applications = await getVisaApplicationsForUser(req.user.id);
    res.json({ applications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load visa applications' });
  }
}

async function getApplicationDocuments(req, res) {
  try {
    const { id } = req.params;

    const application = await getVisaApplicationById(id, req.user.id);
    if (!application) {
      return res.status(404).json({ error: 'Visa application not found' });
    }

    const documents = await getDocumentsForApplication(id, req.user.id);
    res.json({ documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load documents' });
  }
}

async function uploadDocument(req, res) {
  try {
    const { id } = req.params;
    const { documentType } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only PDF, JPG, and PNG files are allowed' });
    }
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File must be under 5MB' });
    }

    const application = await getVisaApplicationById(id, req.user.id);
    if (!application) {
      return res.status(404).json({ error: 'Visa application not found' });
    }

    const s3Key = `visa-documents/${req.user.id}/${id}/${uuidv4()}-${req.file.originalname}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        // Bucket is assumed private — access is only ever via presigned URLs (see
        // getDocumentDownloadUrl below). Remove/adjust if your bucket policy differs.
      })
    );

    const document = await createVisaDocument({
      applicationId: id,
      userId: req.user.id,
      documentType,
      s3Key,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({ document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Document upload failed' });
  }
}

async function getDocumentDownloadUrl(req, res) {
  try {
    const { id } = req.params;

    const document = await getVisaDocumentById(id, req.user.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucketName, Key: document.s3_key }),
      { expiresIn: 300 } // link valid for 5 minutes
    );

    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate download link' });
  }
}

async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    const document = await getVisaDocumentById(id, req.user.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: document.s3_key })
    );

    await deleteVisaDocument(id, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete document' });
  }
}

module.exports = {
  submitApplication,
  getMyApplications,
  getApplicationDocuments,
  uploadDocument,
  getDocumentDownloadUrl,
  deleteDocument,
};