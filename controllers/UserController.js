const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userDAO = require('../dao/UserDAO');

// ... các hàm khác ...

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userDAO.getByEmail(email);

        if (!user) {
            return res.status(401).json({ message: 'Tên người dùng hoặc mật khẩu không đúng' });
        }

        if (user.isLocked) {
            return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa' });
        }

        if (user.isNewUser) {
            return res.status(403).json({ message: 'Vui lòng đăng nhập bằng cách nhấp vào liên kết trong email của bạn' });
        }
        else {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Tên người dùng hoặc mật khẩu không đúng' });
            }
        }


        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: "Đăng nhập thành công",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                avatar: user.avatar,
                role: user.role,
                passwordChangeRequired: user.passwordChangeRequired
            },
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).getTime()
        });
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng nhập' });
    }
};

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token không được cung cấp' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await userDAO.getById(decoded.userId);

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const newRefreshToken = jwt.sign(
            { userId: user.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Lỗi khi làm mới token:', error);
        res.status(403).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }
};

exports.changePassword = async (req, res) => {
    console.log('changePassword');
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        await userDAO.changePassword(userId, newPassword);

        res.json({ message: "Mật khẩu đã được thay đổi thành công" });
    } catch (error) {
        console.error('Lỗi khi thay đổi mật khẩu:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi khi thay đổi mật khẩu' });
    }
};
