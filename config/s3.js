const ENV_CONFIG = require('./env');
const { S3Client } = require('@aws-sdk/client-s3');

const config = {
  credentials: {
    accessKeyId: ENV_CONFIG.AWS_ACCESS_KEY_ID,
    secretAccessKey: ENV_CONFIG.AWS_SECRET_ACCESS_KEY,
  },
  region: ENV_CONFIG.AWS_REGION,
};

const s3Client = new S3Client(config);

module.exports = { s3Client };
