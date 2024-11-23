class Comment {
    constructor(userId, productId, content, rating, images = [], id = null, parentId = null, replies = []) {
        this.id = id;
        this.userId = userId;
        this.productId = productId;
        this.content = content;
        this.rating = rating;
        this.images = images;
        this.parentId = parentId;
        this.replies = replies;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    updateContent(newContent) {
        this.content = newContent;
        this.updatedAt = new Date();
    }

    // Không cần phương thức addImage nữa vì việc xử lý ảnh đã được chuyển lên router

    toJSON() {
        const json = {
            userId: this.userId,
            productId: this.productId,
            content: this.content,
            rating: this.rating,
            images: this.images,
            parentId: this.parentId,
            replies: this.replies,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }

    updateRating(newRating) {
        this.rating = newRating;
        this.updatedAt = new Date();
    }


    static fromJSON(json, id = null) {
        const comment = new Comment(
            json.userId,
            json.productId,
            json.content,
            json.rating,
            json.images,
            id || json.id,
            json.parentId,
            json.replies
        );
        comment.createdAt = new Date(json.createdAt);
        comment.updatedAt = new Date(json.updatedAt);
        return comment;
    }
}

module.exports = Comment;
