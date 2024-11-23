var express = require('express');
var router = express.Router();
var categoryDAO = require('../dao/CategoryDAO');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Lấy tất cả danh mục với phân trang (công khai)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await categoryDAO.getAll(page, pageSize);

    res.json({
      categories: result.categories,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách danh mục', error: error.message });
  }
});

// Tìm kiếm danh mục (công khai)
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, pageSize = 10 } = req.query;
    const result = await categoryDAO.search(query, parseInt(page), parseInt(pageSize));

    res.json({
      categories: result.categories,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Lỗi khi tìm kiếm danh mục:', error);
    res.status(500).json({ message: 'Lỗi khi tìm kiếm danh mục', error: error.message });
  }
});

// Lấy danh mục theo ID (công khai)
router.get('/:id', async (req, res) => {
  try {
    const category = await categoryDAO.getById(req.params.id);
    if (category) {
      res.json(category);
    } else {
      res.status(404).json({ message: 'Không tìm thấy danh mục' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin danh mục', error: error.message });
  }
});

// Thêm danh mục mới (chỉ admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, imageUrl } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name) {
      return res.status(400).json({ message: 'Tên danh mục là bắt buộc' });
    }

    // Nếu description không được cung cấp, sử dụng một giá trị mặc định
    const categoryData = {
      name,
      description: description || '',
      imageUrl: imageUrl || ''
    };

    const newCategoryId = await categoryDAO.add(categoryData);
    res.status(201).json({ id: newCategoryId, message: 'Đã thêm danh mục mới' });
  } catch (error) {
    console.error('Lỗi khi thêm danh mục:', error);
    res.status(500).json({ message: 'Lỗi khi thêm danh mục', error: error.message });
  }
});

// Cập nhật danh mục (chỉ admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await categoryDAO.update(req.params.id, req.body);
    res.json({ message: 'Đã cập nhật danh mục' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật danh mục', error: error.message });
  }
});

// Xóa danh mục (chỉ admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await categoryDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa danh mục' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa danh mục', error: error.message });
  }
});



module.exports = router;
