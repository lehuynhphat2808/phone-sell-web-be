const express = require('express');
const router = express.Router();
const userDAO = require('../dao/UserDAO');

router.post('/', async (req, res) => {
    try {
        const signedRequest = req.body.signed_request;
        const data = parseSignedRequest(signedRequest); // Bạn cần triển khai hàm này
        const userId = data.user_id;

        // Bắt đầu quá trình xóa dữ liệu
        await userDAO.deleteUserData(userId);

        const statusUrl = `localhost:3000/deletion-status?id=${userId}`;
        const confirmationCode = generateConfirmationCode(); // Triển khai hàm này

        res.json({
            url: statusUrl,
            confirmation_code: confirmationCode
        });
    } catch (error) {
        console.error('Lỗi khi xử lý yêu cầu xóa dữ liệu:', error);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.' });
    }
});

module.exports = router;
