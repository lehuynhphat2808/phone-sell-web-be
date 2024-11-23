var express = require('express');
var router = express.Router();
var cartDAO = require('../dao/CartDAO');
const { authenticateToken } = require('../middleware/auth');

// Lấy tất cả giỏ hàng (yêu cầu xác thực)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await cartDAO.getAll(page, pageSize);

    res.json({
      carts: result.carts,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách giỏ hàng', error: error.message });
  }
});

// Tìm kiếm giỏ hàng (yêu cầu xác thực)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, page = 1, pageSize = 10 } = req.query;
    const result = await cartDAO.search(query, page, pageSize);

    res.json({
      carts: result.carts,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm giỏ hàng', error: error.message });
  }
});

// Lấy giỏ hàng theo ID (yêu cầu xác thực)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cart = await cartDAO.getById(req.params.id);
    if (cart) {
      // Kiểm tra xem người dùng có quyền xem giỏ hàng này không
      if (req.user.id === cart.userId || req.user.role === 'admin') {
        res.json(cart);
      } else {
        res.status(403).json({ message: 'Không có quyền xem giỏ hàng này' });
      }
    } else {
      res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin giỏ hàng', error: error.message });
  }
});

// Thêm giỏ hàng mới (yêu cầu xác thực)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const cartData = {
      userId: req.user.id, // Lấy userId từ token xác thực
      items: req.body.items
    };
    const cartId = await cartDAO.add(cartData);
    res.status(201).json({ message: 'Đã thêm giỏ hàng mới', cartId });
  } catch (error) {
    console.error("Lỗi khi thêm giỏ hàng:", error);
    res.status(500).json({ message: 'Lỗi khi thêm giỏ hàng', error: error.message });
  }
});

// Cập nhật giỏ hàng (yêu cầu xác thực)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const cart = await cartDAO.getById(req.params.id);
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }
    if (req.user.id !== cart.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền cập nhật giỏ hàng này' });
    }
    await cartDAO.update(req.params.id, req.body);
    res.json({ message: 'Đã cập nhật giỏ hàng' });
  } catch (error) {
    console.error("Lỗi khi cập nhật giỏ hàng:", error);
    res.status(500).json({ message: 'Lỗi khi cập nhật giỏ hàng', error: error.message });
  }
});

// Xóa giỏ hàng (yêu cầu xác thực)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const cart = await cartDAO.getById(req.params.id);
    if (!cart) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng' });
    }
    if (req.user.id !== cart.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền xóa giỏ hàng này' });
    }
    await cartDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa giỏ hàng' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa giỏ hàng', error: error.message });
  }
});

// Lấy giỏ hàng theo userId (yêu cầu xác thực)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const requestedUserId = req.params.userId;
    const currentUser = req.user;

    // Kiểm tra xem người dùng hiện tại có quyền xem giỏ hàng này không
    if (currentUser.role !== 'admin' && currentUser.id !== requestedUserId) {
      return res.status(403).json({ message: 'Không có quyền truy cập giỏ hàng này' });
    }

    const carts = await cartDAO.getByUserId(requestedUserId);

    if (!carts || carts.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy giỏ hàng cho người dùng này' });
    }

    res.json(carts);
  } catch (error) {
    console.error('Lỗi khi lấy giỏ hàng theo userId:', error);
    res.status(500).json({ message: 'Lỗi khi lấy giỏ hàng theo userId', error: error.message });
  }
});



module.exports = router;
