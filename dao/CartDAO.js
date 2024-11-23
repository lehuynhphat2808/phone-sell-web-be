const { db } = require('../config/firebaseConfig');
const { collection, query, orderBy, limit, startAfter, getDocs, getCountFromServer, addDoc, doc, updateDoc, deleteDoc, getDoc, where } = require('firebase/firestore');
const Cart = require('../models/CartModel');

class CartDAO {
    constructor() {
        this.collectionName = 'carts';
    }

    async add(cartData) {
        try {
            const cart = new Cart(cartData.userId, cartData.items);
            const docRef = await addDoc(collection(db, this.collectionName), cart.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm giỏ hàng: ", error);
            throw error;
        }
    }

    async update(id, cartData) {
        try {
            const cartRef = doc(db, this.collectionName, id);

            // Lấy dữ liệu hiện tại của giỏ hàng
            const cartDoc = await getDoc(cartRef);
            if (!cartDoc.exists()) {
                throw new Error("Không tìm thấy giỏ hàng");
            }

            const currentCartData = cartDoc.data();

            // Tạo đối tượng Cart mới với dữ liệu cập nhật
            const updatedCart = new Cart(
                currentCartData.userId,
                cartData.items || currentCartData.items,
                id
            );
            updatedCart.createdAt = new Date(currentCartData.createdAt);
            updatedCart.updatedAt = new Date();

            // Cập nhật giỏ hàng trong database
            await updateDoc(cartRef, updatedCart.toJSON());
        } catch (error) {
            console.error("Lỗi khi cập nhật giỏ hàng: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa giỏ hàng: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));
            if (docSnap.exists()) {
                return Cart.fromJSON({ ...docSnap.data(), id: docSnap.id });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy thông tin giỏ hàng: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let q = query(collectionRef, orderBy('updatedAt', 'desc'), limit(pageSize));

            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const carts = querySnapshot.docs.map(doc => Cart.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                carts,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách giỏ hàng: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('updatedAt', 'desc'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByUserId(userId) {
        try {
            const q = query(collection(db, this.collectionName), where("userId", "==", userId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Cart.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy giỏ hàng theo userId: ", error);
            throw error;
        }
    }

    async search(searchQuery, page, pageSize) {
        const collectionRef = collection(db, this.collectionName);
        try {
            const searchRegex = new RegExp(searchQuery, 'i');
            let carts = [];
            let lastDoc = null;
            let totalFetched = 0;
            const requiredResults = page * pageSize;

            while (carts.length < requiredResults) {
                const batchSize = Math.min(500, requiredResults - carts.length);

                let q = query(
                    collectionRef,
                    orderBy('updatedAt', 'desc'),
                    limit(batchSize)
                );

                if (lastDoc) {
                    q = query(q, startAfter(lastDoc));
                }

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    break;
                }

                const batch = querySnapshot.docs
                    .filter(doc => searchRegex.test(doc.data().userId))
                    .map(doc => Cart.fromJSON({ ...doc.data(), id: doc.id }));

                carts = carts.concat(batch);
                lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                totalFetched += querySnapshot.docs.length;

                if (querySnapshot.docs.length < batchSize) {
                    break;
                }
            }

            const startIndex = (page - 1) * pageSize;
            const paginatedCarts = carts.slice(startIndex, startIndex + pageSize);

            const hasMore = carts.length > page * pageSize;

            return {
                carts: paginatedCarts,
                currentPage: page,
                hasMore
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm giỏ hàng:', error);
            throw error;
        }
    }
}

module.exports = new CartDAO();
