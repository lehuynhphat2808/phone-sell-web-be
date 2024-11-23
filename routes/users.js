var express = require('express');
var router = express.Router();
var userDAO = require('../dao/UserDAO');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, isAdmin, isEmployee } = require('../middleware/auth');
const passport = require('passport');
const orderDAO = require('../dao/OrderDAO');
const { refreshToken } = require('../controllers/UserController');
const { login } = require('../controllers/UserController');
const { sendNewAccountEmail } = require('../utils/emailService');
const UserController = require('../controllers/UserController');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

const SECRET_KEY = process.env.JWT_SECRET || 'your_jwt_secret';



// Gửi lại email xác nhận cho người dùng cụ thể
router.post("/resend-verification/:email", async (req, res) => {
  try {
    const userEmail = req.params.email;
    const user = await userDAO.getByEmail(userEmail);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (!user.isNewUser) {
      return res.status(400).json({ message: "Tài khoản đã được xác nhận" });
    }

    // Tạo token xác nhận mới
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const verificationExpires = new Date(Date.now() + 60000); // 1 phút

    // Cập nhật token xác nhận và thời gian hết hạn
    await userDAO.update(user.id, {
      tempLoginToken: verificationToken,
      tempLoginExpires: verificationExpires,
    });

    // Gửi email xác nhận
    await emailService.sendNewAccountEmail(
      user.email,
      user.fullName,
      verificationToken
    );

    res.json({ message: "Email xác nhận đã được gửi lại" });
  } catch (error) {
    console.error("Lỗi khi gửi lại email xác nhận:", error);
    res.status(500).json({
      message: "Lỗi khi gửi lại email xác nhận",
      error: error.message,
    });
  }
});

// Thêm route xác nhận tài khoản
router.get("/verify-account/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log(token);
    const user = await userDAO.getByVerificationToken(token);
    console.log(user);
    if (!user) {
      return res.status(400).json({ message: "Token xác nhận không hợp lệ" });
    }

    if (user.verificationExpires < new Date()) {
      return res.status(400).json({ message: "Token xác nhận đã hết hạn" });
    }

    await userDAO.verifyUser(user.id);
    res.json({ message: "Tài khoản đã được xác nhận thành công" });
  } catch (error) {
    console.error("Lỗi khi xác nhận tài khoản:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xác nhận tài khoản", error: error.message });
  }
});



// Lấy tất cả người dùng (chỉ admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await userDAO.getAll(page, pageSize);

    res.json({
      users: result.users,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách người dùng', error: error.message });
  }
});

// Tìm kiếm người dùng (chỉ admin)
router.get('/search', authenticateToken, isEmployee, async (req, res) => {
  try {
    const { query, page = 1, pageSize = 10 } = req.query;
    const result = await userDAO.search(query, parseInt(page), parseInt(pageSize));

    res.json({
      users: result.users,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm người dùng', error: error.message });
  }
});

router.get('/check-admin-permission', authenticateToken, isAdmin, (req, res) => {
  return res.status(200).json({ message: 'Đúng quyền admin' });
});

// Lấy người dùng theo ID (yêu cầu xác thực)
router.get('/:id([^/]+)$', authenticateToken, async (req, res) => {
  try {
    // Kiểm tra xem người dùng có quyền truy cập thông tin này không
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập thông tin người dùng này' });
    }

    const user = await userDAO.getById(req.params.id);
    if (user) {
      // Thêm trường avatarUrl vào đối tượng user trước khi trả về
      const userWithAvatar = {
        ...user,
        avatarUrl: user.avatarUrl || `${process.env.DEFAULT_AVATAR_URL}` // Sử dụng ảnh mặc định nếu không có
      };
      res.json(userWithAvatar);
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin người dùng', error: error.message });
  }
});

// Thêm người dùng mới (đăng ký - công khai)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, fullName, phoneNumber, address, role } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc: fullName hoặc email' });
    }

    const existingUser = await userDAO.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    const userId = await userDAO.add({
      fullName,
      email,
      phoneNumber,
      address,
      role: role || 'staff'
    });

    const user = await userDAO.getById(userId);

    await sendNewAccountEmail(email, fullName, user.tempLoginToken);

    res.status(201).json({ message: 'Người dùng đã được tạo thành công', userId });
  } catch (error) {
    console.error('Lỗi khi tạo người dùng:', error);
    res.status(500).json({ message: 'Lỗi khi tạo người dùng', error: error.message });
  }
});

// Khóa/mở khóa người dùng
router.put('/:id/lock', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { isLocked } = req.body; // true để khóa, false để mở khóa
    await userDAO.lockUser(req.params.id, isLocked);
    res.json({ message: `Người dùng đã ${isLocked ? 'bị khóa' : 'được mở khóa'}` });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi khóa/mở khóa người dùng', error: error.message });
  }
});

// Cập nhật người dùng (yêu cầu xác thực)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Kiểm tra xem người dùng có quyền cập nhật thông tin này không
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền cập nhật thông tin người dùng này' });
    }

    await userDAO.update(req.params.id, req.body);
    res.json({ message: 'Đã cập nhật người dùng' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật người dùng', error: error.message });
  }
});

// Xóa người dùng (chỉ admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await userDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa người dùng' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa người dùng', error: error.message });
  }
});

// Cập nhật điểm thưởng (chỉ admin)
router.put('/:id/reward-points', authenticateToken, isAdmin, async (req, res) => {
  try {
    const newPoints = await userDAO.updateRewardPoints(req.params.id, req.body.points);
    res.json({ message: 'Đã cập nhật điểm thưởng', newPoints });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật điểm thưởng', error: error.message });
  }
});

// Thêm đơn hàng cho người dùng (yêu cầu xác thực)
router.post('/:id/orders', authenticateToken, async (req, res) => {
  try {
    const updatedOrders = await userDAO.addOrderToUser(req.params.id, req.body.orderId);
    res.json({ message: 'Đã thêm đơn hàng cho người dùng', updatedOrders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm đơn hàng cho người dùng', error: error.message });
  }
});

// Đăng nhập (công khai)
router.post('/login', login);

// Google Login
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Xử lý sau khi đăng nhập thành công
    const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({
      token,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  }
);

// Facebook Login
router.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    // Xử lý sau khi đăng nhập thành công
    const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({
      token,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  }
);

// Yêu cầu xóa dữ liệu người dùng (yêu cầu xác thực)
router.post('/delete-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await userDAO.deleteUserData(userId);
    res.json({ message: 'Dữ liệu của bạn đã được xóa thành công.' });
  } catch (error) {
    console.error('Lỗi khi xử lý yêu cầu xóa dữ liệu:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.' });
  }
});

// Kiểm tra xem người dùng đã mua sản phẩm chưa
router.get('/:userId/has-purchased/:productId', authenticateToken, async (req, res) => {
  try {
    const { userId, productId } = req.params;

    // Kiểm tra xem người dùng có quyền truy cập thông tin này không
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập thông tin này' });
    }

    const hasPurchased = await orderDAO.hasUserPurchasedProduct(userId, productId);
    res.json({ hasPurchased });
  } catch (error) {
    console.error('Lỗi khi kiểm tra lịch sử mua hàng:', error);
    res.status(500).json({ message: 'Lỗi khi kim tra lịch sử mua hàng', error: error.message });
  }
});

router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh Token is required" });
  }

  try {
    const user = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60 // 15 phút
    });
  } catch (error) {
    return res.status(403).json({ message: "Invalid Refresh Token" });
  }
});

router.post('/first-login', async (req, res) => {
  try {
    const { email, token, password } = req.body;
    console.log(email, token, password);

    const user = await userDAO.validateTempToken(email, token);
    if (!user) {
      return res.status(400).json({ message: 'Liên kết không hợp lệ hoặc đã hết hạn' });
    }

    if (!user.isNewUser) {
      return res.status(400).json({ message: 'Tài khoản này đã được kích hoạt' });
    }

    await userDAO.setPassword(user.id, password);

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: "Đăng nhập thành công",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      },
      accessToken
    });
  } catch (error) {
    console.error('Lỗi khi xử lý đăng nhập đầu tiên:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi', error: error.message });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  await UserController.changePassword(req, res);
});



module.exports = router;
