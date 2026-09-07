// models/visaModel.js
//
// Assumes a `pool` export from '../config/db', consistent with your other models
// (see paymentModel.js). Adjust the import if your db config module differs.

const pool = require('../config/db');

async function createVisaApplication({
  userId,
  destinationCountry,
  visaType,
  passportNumber,
  passportExpiry,
  travelDate,
  returnDate,
}) {
  const result = await pool.query(
    `INSERT INTO visa_applications
       (user_id, destination_country, visa_type, passport_number, passport_expiry, travel_date, return_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      destinationCountry,
      visaType || 'tourist',
      passportNumber,
      passportExpiry,
      travelDate,
      returnDate || null,
    ]
  );
  return result.rows[0];
}

async function getVisaApplicationsForUser(userId) {
  const result = await pool.query(
    `SELECT * FROM visa_applications WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getVisaApplicationById(applicationId, userId) {
  const result = await pool.query(
    `SELECT * FROM visa_applications WHERE id = $1 AND user_id = $2`,
    [applicationId, userId]
  );
  return result.rows[0];
}

async function updateVisaApplicationStatus(applicationId, status, notes) {
  const result = await pool.query(
    `UPDATE visa_applications
     SET status = $1, notes = COALESCE($2, notes), updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, notes || null, applicationId]
  );
  return result.rows[0];
}

async function createVisaDocument({
  applicationId,
  userId,
  documentType,
  s3Key,
  fileName,
  fileSize,
  mimeType,
}) {
  const result = await pool.query(
    `INSERT INTO visa_documents
       (application_id, user_id, document_type, s3_key, file_name, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [applicationId, userId, documentType, s3Key, fileName, fileSize, mimeType]
  );
  return result.rows[0];
}

async function getDocumentsForApplication(applicationId, userId) {
  const result = await pool.query(
    `SELECT * FROM visa_documents WHERE application_id = $1 AND user_id = $2 ORDER BY uploaded_at DESC`,
    [applicationId, userId]
  );
  return result.rows;
}

async function getVisaDocumentById(documentId, userId) {
  const result = await pool.query(
    `SELECT * FROM visa_documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );
  return result.rows[0];
}

async function deleteVisaDocument(documentId, userId) {
  const result = await pool.query(
    `DELETE FROM visa_documents WHERE id = $1 AND user_id = $2 RETURNING *`,
    [documentId, userId]
  );
  return result.rows[0];
}

module.exports = {
  createVisaApplication,
  getVisaApplicationsForUser,
  getVisaApplicationById,
  updateVisaApplicationStatus,
  createVisaDocument,
  getDocumentsForApplication,
  getVisaDocumentById,
  deleteVisaDocument,
};