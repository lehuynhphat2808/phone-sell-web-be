var express = require('express');
var router = express.Router();
var voucherDAO = require('../dao/VoucherDAO');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Lấy tất cả voucher (công khai)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await voucherDAO.getAll(page, pageSize);

    res.json({
      vouchers: result.vouchers,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách voucher', error: error.message });
  }
});

// Tìm kiếm voucher (công khai)
router.get('/search', async (req, res) => {
  try {
    const { 
      code,
      discountType,
      minDiscountValue,
      maxDiscountValue,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      minUsageLimit,
      maxUsageCount,
      page = 1, 
      pageSize = 10 
    } = req.query;

    const searchParams = {
      code,
      discountType,
      minDiscountValue,
      maxDiscountValue,
      minPurchase,
      maxDiscount,
      startDate,
      endDate,
      minUsageLimit,
      maxUsageCount
    };

    const result = await voucherDAO.search(searchParams, parseInt(page), parseInt(pageSize));

    res.json({
      vouchers: result.vouchers,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm voucher', error: error.message });
  }
});

// Lấy voucher theo ID (yêu cầu xác thực)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const voucher = await voucherDAO.getById(req.params.id);
    if (voucher) {
      res.json(voucher);
    } else {
      res.status(404).json({ message: 'Không tìm thấy voucher' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin voucher', error: error.message });
  }
});

// Thêm voucher mới (chỉ admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const newVoucherId = await voucherDAO.add(req.body);
    res.status(201).json({ id: newVoucherId, message: 'Đã thêm voucher mới' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi thêm voucher', error: error.message });
  }
});

// Cập nhật voucher (chỉ admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await voucherDAO.update(req.params.id, req.body);
    res.json({ message: 'Đã cập nhật voucher' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật voucher', error: error.message });
  }
});

// Xóa voucher (chỉ admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await voucherDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa voucher' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa voucher', error: error.message });
  }
});



module.exports = router;
