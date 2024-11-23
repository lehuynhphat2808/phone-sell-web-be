var express = require('express');
var router = express.Router();
var orderDAO = require('../dao/OrderDAO');
const { authenticateToken, isAdmin, isEmployee } = require('../middleware/auth');

// Lấy tất cả đơn hàng (chỉ admin)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await orderDAO.getAll(page, pageSize);

    res.json({
      orders: result.orders,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đơn hàng', error: error.message });
  }
});

// Tìm kiếm đơn hàng (chỉ admin)
router.get('/search', authenticateToken, isEmployee, async (req, res) => {
  try {
    const {
      query,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      status,
      page = 1,
      pageSize = 10
    } = req.query;

    const searchParams = {
      query,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      startDate,
      endDate,
      status
    };

    const result = await orderDAO.search(searchParams, parseInt(page), parseInt(pageSize));

    res.json({
      orders: result.orders,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm đơn hàng', error: error.message });
  }
});

// Lấy tổng doanh thu (chỉ admin)
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { totalRevenue, totalOrder, totalProduct, orders, profit } = await orderDAO.getTotalRevenue(startDate, endDate);
    if (req.user.role === 'admin') {
      res.json({ totalRevenue, totalOrder, totalProduct, orders, profit });
    } else {
      res.json({ totalRevenue, totalOrder, totalProduct, orders });
    }
  } catch (error) {
    console.error('Lỗi khi lấy tổng doanh thu:', error);
    res.status(500).json({ message: 'Lỗi khi lấy tổng doanh thu', error: error.message });
  }
});

// Lấy doanh thu theo tháng (chỉ admin)
router.get('/revenue-by-month', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const revenueData = await orderDAO.getRevenueByMonth(currentYear);
    res.json(revenueData);
  } catch (error) {
    console.error('Lỗi khi lấy doanh thu theo tháng:', error);
    res.status(500).json({ message: 'Lỗi khi lấy doanh thu theo tháng', error: error.message });
  }
});

// Thêm route mới để lấy thống kê trạng thái đơn hàng theo năm
router.get('/status-stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const stats = await orderDAO.getOrderStatusStats(year);
    res.json(stats);
  } catch (error) {
    console.error('Lỗi khi lấy thống kê trạng thái đơn hàng:', error);
    res.status(500).json({ message: 'Lỗi khi lấy thống kê trạng thái đơn hàng', error: error.message });
  }
});

router.get('/top-products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const topProducts = await orderDAO.getTopProducts(year);
    res.json(topProducts);
  } catch (error) {
    console.error('Lỗi khi lấy top sản phẩm:', error);
    res.status(500).json({ message: 'Lỗi khi lấy top sản phẩm', error: error.message });
  }
});

// Lấy dữ liệu so sánh doanh thu
router.get('/revenue-comparison', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const currentYearRevenue = await orderDAO.getRevenueByMonth(year);
    const previousYearRevenue = await orderDAO.getRevenueByMonth(year - 1);
    res.json({ currentYear: currentYearRevenue, previousYear: previousYearRevenue });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu so sánh doanh thu:', error);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu so sánh doanh thu', error: error.message });
  }
});

// Lấy đơn hàng theo ID (yêu cầu xác thực)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await orderDAO.getById(req.params.id);
    if (order) {
      // Kiểm tra xem người dùng có quyền xem đơn hàng này không
      if (req.user.id === order.userId || req.user.role === 'admin' || req.user.role === 'employee') {
        res.json(order);
      } else {
        res.status(403).json({ message: 'Không có quyền xem đơn hàng này' });
      }
    } else {
      res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin đơn hàng', error: error.message });
  }
});

// Thêm đơn hàng mới (yêu cầu xác thực)
router.post('/', authenticateToken, async (req, res) => {
  let newOrderId;
  try {
    const { items, totalAmount, shippingAddress, customerPhone, customerName, customerAddress, amountGiven, paymentMethod } = req.body;

    if (!customerPhone) {
      return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });
    }

    newOrderId = await orderDAO.add({
      items,
      totalAmount,
      status: 'completed',
      paymentMethod: paymentMethod || 'cash',
      shippingAddress,
      customerPhone,
      customerName,
      customerAddress,
      amountGiven,
      changeAmount: amountGiven - totalAmount // Tính số tiền trả lại
    });

    res.status(201).json({ id: newOrderId, message: 'Đã thêm đơn hàng mới' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm đơn hàng', error: error.message });
  }
});

// Cập nhật đơn hàng (chỉ admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await orderDAO.update(req.params.id, req.body);
    res.json({ message: 'Đã cập nhật đơn hàng' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật đơn hàng', error: error.message });
  }
});

// Xóa đơn hàng (chỉ admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await orderDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa đơn hàng' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa đơn hàng', error: error.message });
  }
});

// Lấy đơn hàng theo user ID
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    // Kiểm tra xem người dùng có quyền xem đơn hàng này không
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập đơn hàng của người dùng này' });
    }

    const result = await orderDAO.getByUserId(userId, page, pageSize);

    res.json({
      orders: result.orders,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng của người dùng', error: error.message });
  }
});








module.exports = router;
