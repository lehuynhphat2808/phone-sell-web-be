class Order {
    constructor(userId, items, totalAmount, status = 'pending', shippingAddress = null, paymentMethod, id = null, customerPhone = null, customerName = null, customerAddress = null, amountGiven = 0, changeAmount = 0) {
        this.id = id;
        this.userId = userId;
        this.items = items;
        this.totalAmount = totalAmount;
        this.status = status;
        this.shippingAddress = shippingAddress;
        this.paymentMethod = paymentMethod;
        this.customerPhone = customerPhone;
        this.customerName = customerName;
        this.customerAddress = customerAddress;
        this.amountGiven = amountGiven;
        this.changeAmount = changeAmount;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    updateStatus(newStatus) {
        this.status = newStatus;
        this.updatedAt = new Date();
    }

    addItem(productId, quantity, price) {
        this.items.push({ productId, quantity, price });
        this.calculateTotalAmount();
        this.updatedAt = new Date();
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.productId !== productId);
        this.calculateTotalAmount();
        this.updatedAt = new Date();
    }

    calculateTotalAmount() {
        this.totalAmount = this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
    }

    toJSON() {
        const json = {
            userId: this.userId,
            items: this.items,
            totalAmount: this.totalAmount,
            status: this.status,
            shippingAddress: this.shippingAddress,
            paymentMethod: this.paymentMethod,
            customerPhone: this.customerPhone,
            customerName: this.customerName,
            customerAddress: this.customerAddress,
            amountGiven: this.amountGiven,
            changeAmount: this.changeAmount,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }

    static fromJSON(json, id = null) {
        const order = new Order(
            json.userId,
            json.items,
            json.totalAmount,
            json.status,
            json.shippingAddress,
            json.paymentMethod,
            id || json.id,
            json.customerPhone,
            json.customerName,
            json.customerAddress,
            json.amountGiven,
            json.changeAmount
        );
        order.createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
        order.updatedAt = json.updatedAt ? new Date(json.updatedAt) : new Date();
        return order;
    }

    static STATUS = {
        PENDING: 'pending',
        PROCESSING: 'processing',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled'
    };
}

module.exports = Order;
