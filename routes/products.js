const express = require('express');
const router = express.Router();
const productDAO = require('../dao/ProductDAO');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Lấy tất cả sản phẩm (công khai)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await productDAO.getAll(page, pageSize);

    res.json({
      products: result.products,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách sản phẩm', error: error.message });
  }
});

// Thêm route tìm kiếm sản phẩm
router.get('/search', async (req, res) => {
  try {
    const { query, minPrice, maxPrice, page = 1, pageSize = 10 } = req.query;
    const result = await productDAO.search(query, minPrice, maxPrice, parseInt(page), parseInt(pageSize));

    res.json({
      products: result.products,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm sản phẩm', error: error.message });
  }
});



// Lấy sản phẩm theo ID
router.get('/:id', async (req, res) => {
  try {
    const product = await productDAO.getById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin sản phẩm', error: error.message });
  }
});

// Thêm sản phẩm mới (chỉ admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, costPrice, quantity, images, categoryId } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !price || !costPrice || !quantity || !categoryId) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const newProductData = {
      name,
      description: description || '',
      price: parseFloat(price),
      costPrice: parseFloat(costPrice),
      quantity: parseInt(quantity),
      images: images || [],
      categoryId
    };

    const newProductId = await productDAO.add(newProductData);
    res.status(201).json({ id: newProductId, message: 'Đã thêm sản phẩm mới' });
  } catch (error) {
    console.error('Lỗi khi thêm sản phẩm:', error);
    if (error.message === 'Danh mục không tồn tại') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi khi thêm sản phẩm', error: error.message });
  }
});

// Cập nhật sản phẩm (chỉ admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, costPrice, quantity, type, images, unit, categoryId } = req.body;
    const productId = req.params.id;

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (costPrice) updateData.costPrice = parseFloat(costPrice);
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (type) updateData.type = type;
    if (images) updateData.images = images;
    if (unit) updateData.unit = unit;
    if (categoryId) updateData.categoryId = categoryId;

    // Cập nhật sản phẩm
    await productDAO.update(productId, updateData);
    res.json({ message: 'Đã cập nhật sản phẩm' });
  } catch (error) {
    console.error('Lỗi khi cập nhật sản phẩm:', error);
    if (error.message === 'Sản phẩm không tồn tại' || error.message === 'Danh mục không tồn tại') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm', error: error.message });
  }
});

// Xóa sản phẩm (chỉ admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await productDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa sản phẩm' });
  } catch (error) {
    if (error.message === 'Không thể xóa sản phẩm vì nó đã nằm trong đơn hàng.') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: error.message });
  }
});

// Lấy sản phẩm theo ID danh mục (công khai)
router.get('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await productDAO.getByCategoryId(categoryId, page, pageSize);

    res.json({
      products: result.products,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy sản phẩm theo danh mục', error: error.message });
  }
});

module.exports = router;
