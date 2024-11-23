class Voucher {
    constructor(code, discountType, discountValue, minPurchase, maxDiscount, startDate, endDate, usageLimit, usageCount = 0, userUsage = {}, id = null) {
        this.id = id;
        this.code = code;
        this.discountType = discountType; // 'percentage' hoặc 'fixed'
        this.discountValue = discountValue;
        this.minPurchase = minPurchase;
        this.maxDiscount = maxDiscount;
        this.startDate = new Date(startDate);
        this.endDate = new Date(endDate);
        this.usageLimit = usageLimit;
        this.usageCount = usageCount;
        this.userUsage = userUsage; // Thêm thuộc tính này
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    isValid() {
        const now = new Date();
        return now >= this.startDate && now <= this.endDate && this.usageCount < this.usageLimit;
    }

    isValidForUser(userId) {
        if (!this.isValid()) return false;
        const userUsageCount = this.userUsage[userId] || 0;
        return userUsageCount < this.usageLimit;
    }

    use(userId) {
        if (this.isValidForUser(userId)) {
            this.usageCount++;
            this.userUsage[userId] = (this.userUsage[userId] || 0) + 1;
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }

    calculateDiscount(purchaseAmount) {
        if (!this.isValid() || purchaseAmount < this.minPurchase) {
            return 0;
        }

        let discount;
        if (this.discountType === 'percentage') {
            discount = purchaseAmount * (this.discountValue / 100);
        } else {
            discount = this.discountValue;
        }

        return Math.min(discount, this.maxDiscount);
    }

    toJSON() {
        const json = {
            code: this.code,
            discountType: this.discountType,
            discountValue: this.discountValue,
            minPurchase: this.minPurchase,
            maxDiscount: this.maxDiscount,
            startDate: this.startDate.toISOString(),
            endDate: this.endDate.toISOString(),
            usageLimit: this.usageLimit,
            usageCount: this.usageCount,
            userUsage: this.userUsage,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };

        if (this.id != null) {
            json.id = this.id;
        }

        return json;
    }

    static fromJSON(json, id = null) {
        const voucher = new Voucher(
            json.code,
            json.discountType,
            json.discountValue,
            json.minPurchase,
            json.maxDiscount,
            new Date(json.startDate),
            new Date(json.endDate),
            json.usageLimit,
            json.usageCount,
            json.userUsage || {},
            id || json.id
        );
        voucher.createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
        voucher.updatedAt = json.updatedAt ? new Date(json.updatedAt) : new Date();
        return voucher;
    }

    static DISCOUNT_TYPES = {
        PERCENTAGE: 'percentage',
        FIXED: 'fixed'
    };
}

module.exports = Voucher;
