class Category {
    constructor(name, description, imageUrl, id = null) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.imageUrl = imageUrl;
        // Loại bỏ mảng products
    }

    toJSON() {
        const json = {
            name: this.name,
            description: this.description,
            imageUrl: this.imageUrl
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }

    static fromJSON(json, id = null) {
        return new Category(json.name, json.description, json.imageUrl, id || json.id);
    }

    // Các phương thức tiện ích khác có thể được thêm vào đây
}

// Định nghĩa các loại danh mục cố định (nếu cần)
Category.TYPES = {
    FISH: 'Cá',
    SHELLFISH: 'Động vật có vỏ',
    CRUSTACEANS: 'Giáp xác',
    MOLLUSKS: 'Động vật thân mềm',
    SEAWEED: 'Rong biển',
    OTHER: 'Khác'
};

module.exports = Category;
