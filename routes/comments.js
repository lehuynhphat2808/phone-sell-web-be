const express = require('express');
const router = express.Router();
const commentDAO = require('../dao/CommentDAO');
const userDAO = require('../dao/UserDAO');
const productDAO = require('../dao/ProductDAO');
const Comment = require('../models/CommentModel');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Lấy tất cả bình luận
router.get('/', async (req, res) => {
  try {
    const comments = await commentDAO.getAll();
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách bình luận', error: error.message });
  }
});

// Tìm kiếm comment (yêu cầu xác thực)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const {
      content,
      userId,
      productId,
      minRating,
      maxRating,
      startDate,
      endDate,
      page = 1,
      pageSize = 10
    } = req.query;

    const searchParams = {
      content,
      userId,
      productId,
      minRating: minRating ? parseInt(minRating) : undefined,
      maxRating: maxRating ? parseInt(maxRating) : undefined,
      startDate,
      endDate
    };

    const result = await commentDAO.search(searchParams, parseInt(page), parseInt(pageSize));

    res.json({
      comments: result.comments,
      currentPage: result.currentPage,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm bình luận', error: error.message });
  }
});

// Lấy bình luận theo ID
router.get('/:id', async (req, res) => {
  try {
    const comment = await commentDAO.getById(req.params.id);
    if (comment) {
      res.json(comment);
    } else {
      res.status(404).json({ message: 'Không tìm thấy bình luận' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin bình luận', error: error.message });
  }
});

// Thêm bình luận mới
router.post('/', async (req, res) => {
  try {
    const { userId, productId, content, rating, images } = req.body;

    if (!userId || !productId || !content || !rating) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra sự tồn tại của userId và productId
    const [userExists, productExists] = await Promise.all([
      userDAO.exists(userId),
      productDAO.exists(productId)
    ]);

    if (!userExists) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (!productExists) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }

    const comment = new Comment(userId, productId, content, Number(rating), images || []);

    const newCommentId = await commentDAO.add(comment);
    res.status(201).json({ id: newCommentId, message: 'Đã thêm bình luận mới' });
  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error);
    res.status(500).json({ message: 'Lỗi khi thêm bình luận', error: error.message });
  }
});

// Cập nhật bình luận
router.put('/:id', async (req, res) => {
  try {
    const { content, rating, images } = req.body;

    // Lấy comment hiện tại
    const currentComment = await commentDAO.getById(req.params.id);
    if (!currentComment) {
      return res.status(404).json({ message: 'Không tìm thấy bình luận' });
    }

    // Kiểm tra sự tồn tại của userId và productId (nếu chúng được cập nhật)
    if (req.body.userId && req.body.userId !== currentComment.userId) {
      const userExists = await userDAO.exists(req.body.userId);
      if (!userExists) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng mới' });
      }
    }

    if (req.body.productId && req.body.productId !== currentComment.productId) {
      const productExists = await productDAO.exists(req.body.productId);
      if (!productExists) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm mới' });
      }
    }

    const updatedComment = await commentDAO.update(req.params.id, {
      content,
      rating,
      images,
      userId: req.body.userId || currentComment.userId,
      productId: req.body.productId || currentComment.productId
    });
    res.json({ message: 'Đã cập nhật bình luận', comment: updatedComment });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật bình luận', error: error.message });
  }
});

// Xóa bình luận
router.delete('/:id', async (req, res) => {
  try {
    await commentDAO.delete(req.params.id);
    res.json({ message: 'Đã xóa bình luận' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa bình luận', error: error.message });
  }
});

// Lấy bình luận theo productId
router.get('/product/:productId', async (req, res) => {
  try {
    let productId = req.params.productId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    const result = await commentDAO.getByProductId(productId, page, pageSize);

    res.json({
      comments: result.comments,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      hasMore: result.hasMore
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy bình luận theo sản phẩm', error: error.message });
  }
});

// Thêm reply cho một bình luận (chỉ dành cho admin)
router.post('/:id/reply', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    const parentId = req.params.id;

    if (!content) {
      return res.status(400).json({ message: 'Nội dung reply không được để trống' });
    }

    const replyData = {
      userId: req.user.id, // ID của admin
      content: content
    };

    const replyId = await commentDAO.addReply(parentId, replyData);
    res.status(201).json({ message: 'Đã thêm reply', replyId: replyId });
  } catch (error) {
    console.error('Lỗi khi thêm reply:', error);
    res.status(500).json({ message: 'Lỗi khi thêm reply', error: error.message });
  }
});

// Lấy bình luận và các reply của nó
router.get('/:id/with-replies', async (req, res) => {
  try {
    const commentWithReplies = await commentDAO.getCommentWithReplies(req.params.id);
    if (commentWithReplies) {
      res.json(commentWithReplies);
    } else {
      res.status(404).json({ message: 'Không tìm thấy bình luận' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy bình luận và các reply', error: error.message });
  }
});

module.exports = router;
