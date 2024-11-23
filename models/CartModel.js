class Cart {
    constructor(userId, items = [], id = null) {
        this.id = id;
        this.userId = userId;
        this.items = items; // Mảng các đối tượng {productId, quantity, price}
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }
    // Constructor mới để tạo giỏ hàng từ giỏ hàng cũ với danh sách sản phẩm mới
    static createWithNewItems(oldCart, newItems) {
        return new Cart(
            oldCart.userId,
            newItems,
            oldCart.id,
            oldCart.createdAt,
            new Date() // Cập nhật thời gian
        );
    }


    addItem(productId, quantity, price) {
        const existingItem = this.items.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({ productId, quantity, price });
        }
        this.updatedAt = new Date();
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.productId !== productId);
        this.updatedAt = new Date();
    }

    updateItemQuantity(productId, quantity) {
        const item = this.items.find(item => item.productId === productId);
        if (item) {
            item.quantity = quantity;
            this.updatedAt = new Date();
        }
    }

    clearCart() {
        this.items = [];
        this.updatedAt = new Date();
    }

    getTotalItems() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    getTotalPrice() {
        return this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
    }

    toJSON() {
        const json = {
            userId: this.userId,
            items: this.items,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }

    static fromJSON(json, id = null) {
        const cart = new Cart(json.userId, json.items, id || json.id);
        return cart;
    }
}

module.exports = Cart;