class Product {
    constructor(name, description, price, costPrice, quantity, images, categoryId, id = null) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.costPrice = costPrice;
        this.quantity = quantity;
        this.images = Array.isArray(images) ? images : []; // Đảm bảo images là một mảng
        this.categoryId = categoryId;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    updateQuantity(newQuantity) {
        this.quantity = newQuantity;
        this.updatedAt = new Date();
    }

    updatePrice(newPrice) {
        this.price = newPrice;
        this.updatedAt = new Date();
    }

    calculateDiscountPrice(discountPercentage) {
        return this.price * (1 - discountPercentage / 100);
    }

    static SEAFOOD_TYPES = {
        FISH: 'Fish',
        SHRIMP: 'Shrimp',
        CRAB: 'Crab',
        SHELLFISH: 'Shellfish',
        OTHER: 'Other'
    };

    addImage(imageUrl) {
        this.images.push(imageUrl);
        this.updatedAt = new Date();
    }

    removeImage(imageUrl) {
        const index = this.images.indexOf(imageUrl);
        if (index > -1) {
            this.images.splice(index, 1);
            this.updatedAt = new Date();
        }
    }

    static removeDiacritics(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    static fromJSON(json, id = null) {
        const product = new Product(
            json.name,
            json.description,
            json.price,
            json.costPrice,
            json.quantity,
            json.images,
            json.categoryId,
            id || json.id
        );
        return product;
    }

    toJSON() {
        const json = {
            name: this.name,
            description: this.description,
            price: this.price,
            costPrice: this.costPrice,
            quantity: this.quantity,
            images: this.images,
            categoryId: this.categoryId,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }
}

module.exports = Product;
