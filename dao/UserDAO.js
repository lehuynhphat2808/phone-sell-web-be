const { db } = require('../config/firebaseConfig');
const { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, limit, startAfter, getCountFromServer } = require('firebase/firestore');
const User = require('../models/UserModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class UserDAO {
    constructor() {
        this.collectionName = 'users';
    }

    async add(userData) {
        try {
            const user = new User(
                userData.email,
                null, // Mật khẩu sẽ được đặt sau
                userData.fullName,
                userData.phoneNumber || '',
                userData.address || '',
                null, // googleId
                userData.role || 'staff',
                0, // rewardPoints
                [], // orders
                null, // avatar
                null, // id
                true, // isNewUser
                this.generateTempToken(),
                new Date(Date.now() + 60000), // tempLoginExpires (1 phút)
                true // passwordChangeRequired
            );

            const docRef = await addDoc(collection(db, this.collectionName), user.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm người dùng: ", error);
            throw error;
        }
    }

    generateTempToken() {
        return crypto.randomBytes(20).toString('hex');
    }

    async validateTempToken(email, token) {
        try {
            const user = await this.getByEmail(email);
            console.log('user', user);
            console.log('user.tempLoginToken === token', user.tempLoginToken === token);
            console.log('user.tempLoginExpires > new Date()', user.tempLoginExpires > new Date());
            if (user && user.tempLoginToken === token && user.tempLoginExpires > new Date()) {
                return user;
            }
            return null;
        } catch (error) {
            console.error("Lỗi khi xác thực token tạm thời: ", error);
            throw error;
        }
    }

    async setPassword(userId, password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const userRef = doc(db, this.collectionName, userId);
            await updateDoc(userRef, {
                password: hashedPassword,
                isNewUser: false,
                tempLoginToken: null,
                tempLoginExpires: null,
                passwordChangeRequired: true // Đặt là true khi đặt mật khẩu lần đầu
            });
        } catch (error) {
            console.error("Lỗi khi đặt mật khẩu: ", error);
            throw error;
        }
    }

    async changePassword(userId, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const userRef = doc(db, this.collectionName, userId);
            await updateDoc(userRef, {
                password: hashedPassword,
                passwordChangeRequired: false,
                isNewUser: false,
            });
        } catch (error) {
            console.error("Lỗi khi thay đổi mật khẩu: ", error);
            throw error;
        }
    }

    async update(id, userData) {
        try {
            console.log("Dữ liệu cập nhật:", userData);

            // Lấy thông tin người dùng hiện tại từ database
            const userRef = doc(db, this.collectionName, id);
            const userSnapshot = await getDoc(userRef);

            if (!userSnapshot.exists()) {
                throw new Error("Không tìm thấy người dùng");
            }

            const currentUserData = userSnapshot.data();

            // Tạo đối tượng cập nhật, giữ nguyên role hiện tại
            const updatedData = {
                ...currentUserData,
                ...userData,
                role: currentUserData.role, // Giữ nguyên role hiện tại
                updatedAt: new Date().toISOString()
            };

            // Tạo đối tượng User từ dữ liệu đã cập nhật
            const updatedUser = User.fromJSON({ ...updatedData, id });

            // Cập nhật trong database
            await updateDoc(userRef, updatedUser.toJSON());

            console.log("Đã cập nhật người dùng:", updatedUser.toJSON());
        } catch (error) {
            console.error("Lỗi khi cập nhật người dùng: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa người dùng: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));
            if (docSnap.exists()) {
                return User.fromJSON({ id: docSnap.id, ...docSnap.data() });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy người dùng theo ID: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let q = query(collectionRef, orderBy('email'), limit(pageSize));

            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const users = querySnapshot.docs.map(doc => User.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                users,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách người dùng: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('email'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByEmail(email) {
        const collectionRef = collection(db, this.collectionName);
        try {
            const q = query(collectionRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return null;
            }
            const userDoc = querySnapshot.docs[0];
            return User.fromJSON({ id: userDoc.id, ...userDoc.data() });
        } catch (error) {
            console.error("Lỗi khi lấy người dùng theo email: ", error);
            throw error;
        }
    }

    async getByRole(role) {
        try {
            const q = query(collection(db, this.collectionName), where("role", "==", role));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => User.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy người dùng theo vai trò: ", error);
            throw error;
        }
    }

    async updateRewardPoints(id, points) {
        try {
            const userRef = doc(db, this.collectionName, id);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const newPoints = (userData.rewardPoints || 0) + points;
                await updateDoc(userRef, { rewardPoints: newPoints });
                return newPoints;
            } else {
                throw new Error("Không tìm thấy người dùng");
            }
        } catch (error) {
            console.error("Lỗi khi cập nhật điểm thưởng: ", error);
            throw error;
        }
    }

    async addOrderToUser(userId, orderId) {
        try {
            const userRef = doc(db, this.collectionName, userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const orders = userData.orders || [];
                orders.push(orderId);
                await updateDoc(userRef, { orders: orders });
                return orders;
            } else {
                throw new Error("Không tìm thấy người dùng");
            }
        } catch (error) {
            console.error("Lỗi khi thêm đơn hàng cho người dùng: ", error);
            throw error;
        }
    }

    async exists(userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists();
    }

    async addSocialUser(userData) {
        try {
            const newUser = new User(
                userData.email,
                null, // Không có mật khẩu cho đng nhập xã hội
                userData.name,
                userData.phoneNumber || '',
                userData.address || '',
                User.ROLES.CUSTOMER,
                0,
                [],
                userData.avatar || null,
                null
            );

            const userToAdd = newUser.toJSON();
            const docRef = await addDoc(collection(db, this.collectionName), userToAdd);
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm người dùng từ mạng xã hội: ", error);
            throw error;
        }
    }

    async deleteUserData(userId) {
        try {
            const userRef = doc(db, this.collectionName, userId);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                throw new Error("Không tìm thấy người dùng");
            }

            // Xóa thông tin cá nhân nhạy cảm
            await updateDoc(userRef, {
                email: `deleted_${userId}@example.com`,
                fullName: 'Deleted User',
                phoneNumber: null,
                address: null,
                avatar: null,
                orders: [],
                rewardPoints: 0,
                updatedAt: new Date().toISOString()
            });

            // Xóa các dữ liệu liên quan khác (ví dụ: đơn hàng, giỏ hàng, ...)
            // Lưu ý: Bạn cần thêm logic để xóa dữ liệu từ các collection khác nếu cần

            console.log(`Đã xóa dữ liệu cho người dùng ${userId}`);
        } catch (error) {
            console.error("Lỗi khi xóa dữ liệu người dùng: ", error);
            throw error;
        }
    }

    async search(searchQuery, page = 1, pageSize = 10) {
        const collectionRef = collection(db, this.collectionName);
        try {
            // Lấy tất cả người dùng
            const querySnapshot = await getDocs(collectionRef);
            let users = querySnapshot.docs.map(doc => User.fromJSON({ ...doc.data(), id: doc.id }));

            // Lọc người dùng theo điều kiện tìm kiếm
            const searchRegex = new RegExp(searchQuery, 'i');
            users = users.filter(user => {
                return searchRegex.test(user.email) ||
                    searchRegex.test(user.fullName) ||
                    searchRegex.test(user.phoneNumber);
            });

            // Phân trang
            const totalCount = users.length;
            const totalPages = Math.ceil(totalCount / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedUsers = users.slice(startIndex, startIndex + pageSize);

            return {
                users: paginatedUsers,
                totalPages,
                currentPage: page,
                hasMore: users.length > page * pageSize
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm người dùng:', error);
            throw error;
        }
    }

    async getByGoogleId(googleId) {
        try {
            const q = query(collection(db, this.collectionName), where("googleId", "==", googleId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return User.fromJSON({ id: doc.id, ...doc.data() });
            }
            return null;
        } catch (error) {
            console.error("Lỗi khi tìm người dùng theo Google ID: ", error);
            throw error;
        }
    }

    async lockUser(userId, isLocked) {
        try {
            const userRef = doc(db, this.collectionName, userId);
            const updates = {
                isLocked: isLocked,
            };

            // Chỉ cập nhật tempLoginToken nếu isLocked là true
            if (isLocked) {
                updates.tempLoginToken = null; // Đặt token thành null khi khóa
            }

            await updateDoc(userRef, updates);
        } catch (error) {
            console.error("Lỗi khi khóa/mở khóa người dùng: ", error);
            throw error;
        }
    }

    async getByPhone(phoneNumber) {
        const q = query(collection(db, this.collectionName), where("phoneNumber", "==", phoneNumber));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return User.fromJSON({ id: doc.id, ...doc.data() });
        }
        return null; // Trả về null nếu không tìm thấy
    }
}

module.exports = new UserDAO();
