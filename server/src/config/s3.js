// config/s3.js
//
// Requires: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//
// Expected env vars (add to your .env):
//   AWS_REGION=ap-south-1
//   AWS_ACCESS_KEY_ID=...
//   AWS_SECRET_ACCESS_KEY=...
//   AWS_S3_BUCKET=travelsphere-visa-documents

const { S3Client } = require('@aws-sdk/client-s3');

if (!process.env.AWS_S3_BUCKET) {
  console.warn('AWS_S3_BUCKET is not set — visa document uploads will fail.');
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = {
  s3Client,
  bucketName: process.env.AWS_S3_BUCKET,
};