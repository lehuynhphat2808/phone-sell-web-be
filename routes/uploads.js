const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Service } = require('../services/S3Service');
const { authenticateToken } = require('../middleware/auth');
const cryptoRandomString = require('crypto-random-string');

// Cấu hình multer để xử lý file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // giới hạn kích thước file 5MB
    },
});

// Route để upload một ảnh
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Không có file nào được upload' });
        }

        const file = req.file;
        const filename = `${Date.now()}-${file.originalname}`;

        const { presignedUrl, path } = await S3Service.createPutObjectPresignedUrl(filename.replace(/\s/g, ''), file.mimetype);

        // Upload file to S3 using the presigned URL
        const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: file.buffer,
            headers: {
                'Content-Type': file.mimetype,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to upload file to S3: ${response.statusText}`);
        }

        res.status(201).json({
            message: 'Đã upload ảnh thành công',
            imageUrl: path
        });
    } catch (error) {
        console.error('Lỗi khi upload ảnh:', error);
        res.status(500).json({ message: 'Lỗi khi upload ảnh', error: error.message });
    }
});

// Route để upload nhiều ảnh
router.post('/images', authenticateToken, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Không có file nào được upload' });
        }

        const uploadPromises = req.files.map(async (file) => {
            const filename = `${Date.now()}-${file.originalname}`;
            const { presignedUrl, path } = await S3Service.createPutObjectPresignedUrl(filename.replace(/\s/g, ''), file.mimetype);

            // Upload file to S3 using the presigned URL
            const response = await fetch(presignedUrl, {
                method: 'PUT',
                body: file.buffer,
                headers: {
                    'Content-Type': file.mimetype,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to upload file to S3: ${response.statusText}`);
            }

            return path;
        });

        const uploadedPaths = await Promise.all(uploadPromises);

        res.status(201).json({
            message: 'Đã upload các ảnh thành công',
            imageUrls: uploadedPaths
        });
    } catch (error) {
        console.error('Lỗi khi upload ảnh:', error);
        res.status(500).json({ message: 'Lỗi khi upload ảnh', error: error.message });
    }
});

// Route để lấy presigned URL cho việc upload ảnh
router.get('/presigned-url', authenticateToken, async (req, res) => {
    try {
        const contentType = req.query.contentType || 'image/jpeg'; // Mặc định là JPEG nếu không có contentType
        const filename = `${Date.now()}-${cryptoRandomString({length: 10, type: 'alphanumeric'})}.${contentType.split('/')[1]}`;

        const { presignedUrl, path } = await S3Service.createPutObjectPresignedUrl(filename, contentType);

        res.status(200).json({
            message: 'Đã tạo presigned URL thành công',
            presignedUrl: presignedUrl,
            imageUrl: path
        });
    } catch (error) {
        console.error('Lỗi khi tạo presigned URL:', error);
        res.status(500).json({ message: 'Lỗi khi tạo presigned URL', error: error.message });
    }
});

module.exports = router;
