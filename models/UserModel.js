class User {
    constructor(email, password, fullName, phoneNumber, address, googleId = null, role = 'customer', rewardPoints = 0, orders = [], avatar = null, id = null, isNewUser = false, tempLoginToken = null, tempLoginExpires = null, passwordChangeRequired = false, isLocked = false) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.address = address;
        this.googleId = googleId;
        this.role = role; // 'customer', 'admin', 'staff', etc.
        this.rewardPoints = rewardPoints;
        this.orders = orders; // Mảng chứa ID của các đơn hàng
        this.avatar = avatar; // Thêm thuộc tính avatar
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.isNewUser = isNewUser;
        this.tempLoginToken = tempLoginToken;
        this.tempLoginExpires = tempLoginExpires;
        this.passwordChangeRequired = passwordChangeRequired;
        this.isLocked = isLocked;
    }

    addOrder(orderId) {
        if (!this.orders.includes(orderId)) {
            this.orders.push(orderId);
            this.updatedAt = new Date();
        }
    }

    removeOrder(orderId) {
        const index = this.orders.indexOf(orderId);
        if (index > -1) {
            this.orders.splice(index, 1);
            this.updatedAt = new Date();
        }
    }

    addRewardPoints(points) {
        this.rewardPoints += points;
        this.updatedAt = new Date();
    }

    useRewardPoints(points) {
        if (this.rewardPoints >= points) {
            this.rewardPoints -= points;
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }

    updateProfile(updatedData) {
        Object.assign(this, updatedData);
        this.updatedAt = new Date();
    }

    updateAvatar(newAvatarUrl) {
        this.avatar = newAvatarUrl;
        this.updatedAt = new Date();
    }

    toJSON() {
        const json = {
            email: this.email,
            password: this.password,
            fullName: this.fullName,
            phoneNumber: this.phoneNumber, // Thêm phoneNumber vào JSON
            address: this.address, // Thêm address vào JSON
            googleId: this.googleId,
            role: this.role,
            rewardPoints: this.rewardPoints,
            orders: this.orders,
            avatar: this.avatar,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            isNewUser: this.isNewUser,
            tempLoginToken: this.tempLoginToken,
            tempLoginExpires: this.tempLoginExpires ? this.tempLoginExpires.toISOString() : null,
            passwordChangeRequired: this.passwordChangeRequired,
            isLocked: this.isLocked
        };

        if (this.id != null) {
            json.id = this.id;
        }

        // Không bao gồm mật khẩu trong JSON để bảo mật
        return json;
    }

    static fromJSON(json, id = null) {
        const user = new User(
            json.email,
            json.password,
            json.fullName,
            json.phoneNumber, // Thêm phoneNumber
            json.address, // Thêm address
            json.googleId,
            json.role,
            json.rewardPoints,
            json.orders,
            json.avatar, // Thêm avatar vào đây
            id || json.id,
            json.isNewUser,
            json.tempLoginToken,
            json.tempLoginExpires ? new Date(json.tempLoginExpires) : null,
            json.passwordChangeRequired,
            json.isLocked
        );
        user.createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
        user.updatedAt = json.updatedAt ? new Date(json.updatedAt) : new Date();
        return user;
    }

    static ROLES = {
        CUSTOMER: 'customer',
        ADMIN: 'admin',
        STAFF: 'staff'
    };
}
module.exports = User;
