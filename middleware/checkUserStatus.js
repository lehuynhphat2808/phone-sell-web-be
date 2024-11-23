const userDAO = require('../dao/UserDAO');

const checkUserStatus = async (req, res, next) => {
    const userId = req.user.id; // Giả sử bạn đã xác thực người dùng và có ID trong req.user
    const user = await userDAO.getById(userId);

    if (user.isLocked) {
        return res.status(423).json({ message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ với quản trị viên.' });
    }

    next();
};

module.exports = checkUserStatus;