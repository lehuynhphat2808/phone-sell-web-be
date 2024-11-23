const { db } = require('../config/firebaseConfig');
const { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter } = require('firebase/firestore');
const Comment = require('../models/CommentModel');
const { getCountFromServer } = require('firebase/firestore');

class CommentDAO {
    constructor() {
        this.collectionName = 'comments';
    }

    async add(comment) {
        try {
            const docRef = await addDoc(collection(db, this.collectionName), comment.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm bình luận: ", error);
            throw error;
        }
    }

    async update(id, commentData) {
        try {
            const commentRef = doc(db, this.collectionName, id);
            await updateDoc(commentRef, commentData);
            return this.getById(id);
        } catch (error) {
            console.error("Lỗi khi cập nhật bình luận: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa bình luận: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));
            if (docSnap.exists()) {
                return Comment.fromJSON({ ...docSnap.data(), id: docSnap.id });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy thông tin bình luận: ", error);
            throw error;
        }
    }

    async getAll() {
        try {
            const querySnapshot = await getDocs(collection(db, this.collectionName));
            return querySnapshot.docs.map(doc => Comment.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy tất cả bình luận: ", error);
            throw error;
        }
    }

    async getByProductId(productId) {
        try {
            const q = query(collection(db, this.collectionName), where("productId", "==", productId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Comment.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy bình luận theo productId: ", error);
            throw error;
        }
    }

    async getByUserId(userId) {
        try {
            const q = query(collection(db, this.collectionName), where("userId", "==", userId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Comment.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy bình luận theo userId: ", error);
            throw error;
        }
    }

    async search(searchParams, page = 1, pageSize = 10) {
        const collectionRef = collection(db, this.collectionName);
        try {
            let comments = [];
            let lastDoc = null;
            let totalFetched = 0;
            const requiredResults = page * pageSize;

            while (comments.length < requiredResults) {
                const batchSize = Math.min(500, requiredResults - comments.length);

                let q = query(collectionRef, orderBy('createdAt', 'desc'), limit(batchSize));

                if (lastDoc) {
                    q = query(q, startAfter(lastDoc));
                }

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    break;
                }

                const batch = querySnapshot.docs
                    .filter(doc => this.matchesSearchCriteria(doc.data(), searchParams))
                    .map(doc => Comment.fromJSON({ ...doc.data(), id: doc.id }));

                comments = comments.concat(batch);
                lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                totalFetched += querySnapshot.docs.length;

                if (querySnapshot.docs.length < batchSize) {
                    break;
                }
            }

            const startIndex = (page - 1) * pageSize;
            const paginatedComments = comments.slice(startIndex, startIndex + pageSize);

            const hasMore = comments.length > page * pageSize;

            return {
                comments: paginatedComments,
                currentPage: page,
                hasMore
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm bình luận:', error);
            throw error;
        }
    }

    matchesSearchCriteria(commentData, searchParams) {
        const {
            content,
            userId,
            productId,
            minRating,
            maxRating,
            startDate,
            endDate
        } = searchParams;

        if (content && !commentData.content.toLowerCase().includes(content.toLowerCase())) {
            return false;
        }

        if (userId && commentData.userId !== userId) {
            return false;
        }

        if (productId && commentData.productId !== productId) {
            return false;
        }

        if (minRating !== undefined && commentData.rating < minRating) {
            return false;
        }

        if (maxRating !== undefined && commentData.rating > maxRating) {
            return false;
        }

        if (startDate && new Date(commentData.createdAt) < new Date(startDate)) {
            return false;
        }

        if (endDate && new Date(commentData.createdAt) > new Date(endDate)) {
            return false;
        }

        return true;
    }

    async getByProductId(productId, page = 1, pageSize = 10) {
        try {
            const commentsRef = collection(db, this.collectionName);
            let q = query(
                commentsRef,
                where("productId", "==", productId),
                orderBy("createdAt", "desc"),
                limit(pageSize)
            );

            if (page > 1) {
                const lastVisible = await this.getLastVisibleComment(productId, page, pageSize);
                if (lastVisible) {
                    q = query(q, startAfter(lastVisible));
                }
            }

            const querySnapshot = await getDocs(q);
            const comments = querySnapshot.docs.map(doc => Comment.fromJSON({ ...doc.data(), id: doc.id }));

            const totalQuery = query(commentsRef, where("productId", "==", productId));
            const totalSnapshot = await getCountFromServer(totalQuery);
            const totalComments = totalSnapshot.data().count;

            const totalPages = Math.ceil(totalComments / pageSize);

            return {
                comments,
                currentPage: page,
                totalPages,
                hasMore: comments.length === pageSize
            };
        } catch (error) {
            console.error("Lỗi khi lấy bình luận theo productId: ", error);
            throw error;
        }
    }

    async getLastVisibleComment(productId, page, pageSize) {
        const commentsRef = collection(db, this.collectionName);
        const q = query(
            commentsRef,
            where("productId", "==", productId),
            orderBy("createdAt", "desc"),
            limit((page - 1) * pageSize)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    async addReply(parentId, replyData) {
        try {
            const parentComment = await this.getById(parentId);
            if (!parentComment) {
                throw new Error('Không tìm thấy bình luận gốc');
            }

            const reply = new Comment(
                replyData.userId,
                parentComment.productId,
                replyData.content,
                0, // Rating không áp dụng cho reply
                [],
                null,
                parentId
            );

            const replyId = await this.add(reply);
            
            // Cập nhật bình luận gốc với ID của reply mới
            parentComment.replies.push(replyId);
            await this.update(parentId, { replies: parentComment.replies });

            return replyId;
        } catch (error) {
            console.error("Lỗi khi thêm reply: ", error);
            throw error;
        }
    }

    async getCommentWithReplies(commentId) {
        try {
            const comment = await this.getById(commentId);
            if (!comment) {
                return null;
            }

            const replies = await Promise.all(comment.replies.map(replyId => this.getById(replyId)));
            comment.replies = replies.filter(reply => reply !== null);

            return comment;
        } catch (error) {
            console.error("Lỗi khi lấy bình luận và các reply: ", error);
            throw error;
        }
    }
}

module.exports = new CommentDAO();
