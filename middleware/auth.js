const jwt = require('jsonwebtoken');
const userDAO = require('../dao/UserDAO');

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('token', token);
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ message: "Token đã hết hạn", expired: true });
            }
            return res.sendStatus(403);
        }
        req.user = user;
        // Kiểm tra trạng thái người dùng
        const dbUser = await userDAO.getById(user.id);
        if (dbUser.isLocked) {
            return res.status(423).json({ message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ với quản trị viên.' });
        }


        next();
    });
};

exports.isAdmin = (req, res, next) => {
    console.log('User role:', req.user.role);
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Yêu cầu quyền admin' });
    }
};

exports.isEmployee = (req, res, next) => {
    if (req.user && req.user.role === 'staff' || req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Yêu cầu quyền nhân viên' });
    }
};
