const { GetObjectCommand, ObjectCannedACL, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const ENV_CONFIG = require('../config/env');
const { s3Client } = require('../config/s3');
const cryptoRandomString = require('crypto-random-string');

class S3Service {
  static async createPutObjectPresignedUrl(filename, contentType) {
    const randomFilename = cryptoRandomString({ length: 10, type: 'alphanumeric' }).concat('-', filename);
    // const key = ENV_CONFIG.NODE_ENV.concat('/', randomFilename);
    const command = new PutObjectCommand({
      Bucket: ENV_CONFIG.AWS_S3_BUCKET_NAME,
      Key: randomFilename,
      ACL: ObjectCannedACL.public_read,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    const publicS3BucketUrl = 'https://'.concat(ENV_CONFIG.AWS_S3_BUCKET_NAME, '.s3.', ENV_CONFIG.AWS_REGION, '.amazonaws.com');
    const path = publicS3BucketUrl.concat('/', randomFilename);
    return { presignedUrl, path };
  }

  // static async createGetObjectPresignedUrl(key) {
  //   const command = new GetObjectCommand({ Bucket: ENV_CONFIG.AWS_S3_BUCKET_NAME, Key: key });
  //   return getSignedUrl(s3Client, command, { expiresIn: 300 });
  // }
}

module.exports = { S3Service };
