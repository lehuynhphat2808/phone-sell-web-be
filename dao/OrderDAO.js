const { db } = require('../config/firebaseConfig');
const { query, orderBy, limit, startAfter, getDocs, collection, where, getCountFromServer, addDoc, doc, updateDoc, deleteDoc, getDoc } = require('firebase/firestore');
const Order = require('../models/OrderModel');
const userDAO = require('./UserDAO');
const productDAO = require('./ProductDAO');

class OrderDAO {
    constructor() {
        this.collectionName = 'orders';
    }

    async add(orderData) {
        const order = new Order(
            orderData.userId,
            orderData.items,
            orderData.totalAmount,
            orderData.status,
            orderData.shippingAddress,
            orderData.paymentMethod,
            null,
            orderData.customerPhone,
            orderData.customerName,
            orderData.customerAddress,
            orderData.amountGiven,
            orderData.changeAmount
        );

        try {
            // Kiểm tra xem khách hàng đã tồn tại chưa
            let user = await userDAO.getByPhone(orderData.customerPhone);
            if (!user) {
                // Nếu chưa tồn tại, tạo tài khoản mới
                const newUserId = await userDAO.add({
                    email: null,
                    fullName: orderData.customerName,
                    phoneNumber: orderData.customerPhone,
                    address: orderData.customerAddress,
                    role: 'customer' // Gán vai trò là khách hàng
                });
                order.userId = newUserId; // Gán ID người dùng mới cho đơn hàng
            } else {
                order.userId = user.id; // Gán ID người dùng đã tồn tại
            }

            const docRef = await addDoc(collection(db, this.collectionName), order.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm đơn hàng: ", error);
            throw error;
        }
    }

    async update(id, orderData) {
        try {
            const orderRef = doc(db, this.collectionName, id);
            const order = Order.fromJSON({ ...orderData, id });
            await updateDoc(orderRef, order.toJSON());
        } catch (error) {
            console.error("Lỗi khi cập nhật đơn hàng: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa đơn hàng: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));
            if (docSnap.exists()) {
                return Order.fromJSON({ id: docSnap.id, ...docSnap.data() });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy đơn hàng theo ID: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let q = query(collectionRef, orderBy('createdAt', 'desc'), limit(pageSize));

            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            console.log('querySnapshot.docs', querySnapshot.docs);
            const orders = querySnapshot.docs.map(doc => Order.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                orders,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách đơn hàng: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByUserId(userId, page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            // Tạo query để lấy đơn hàng của user cụ thể
            let q = query(
                collectionRef,
                where("userId", "==", userId),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );

            // Nếu không phải trang đầu tiên, sử dụng startAfter
            if (page > 1) {
                const startAtDoc = await this.getStartAtDocForUser(userId, page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const orders = querySnapshot.docs.map(doc => Order.fromJSON({ ...doc.data(), id: doc.id }));

            // Lấy tổng số đơn hàng của user này
            const countQuery = query(collectionRef, where("userId", "==", userId));
            const countSnapshot = await getCountFromServer(countQuery);
            const totalCount = countSnapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            return {
                orders,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy đơn hàng theo userId: ", error);
            throw error;
        }
    }

    async getStartAtDocForUser(userId, page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(
            collection(db, this.collectionName),
            where("userId", "==", userId),
            orderBy('createdAt', 'desc'),
            limit(1),
            startAfter(skipCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByStatus(status) {
        try {
            const q = query(collection(db, this.collectionName), where("status", "==", status));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Order.fromJSON({ ...doc.data(), id: doc.id }));
        } catch (error) {
            console.error("Lỗi khi lấy đơn hàng theo trạng thái: ", error);
            throw error;
        }
    }

    async search(searchParams, page = 1, pageSize = 10) {
        const collectionRef = collection(db, this.collectionName);
        try {
            // Lấy tất cả đơn hàng
            const querySnapshot = await getDocs(collectionRef);
            let orders = querySnapshot.docs.map(doc => Order.fromJSON({ ...doc.data(), id: doc.id }));

            // Lọc đơn hàng theo điều kiện tìm kiếm
            orders = orders.filter(order => this.matchesSearchCriteria(order, searchParams));

            // Phân trang
            const totalCount = orders.length;
            const totalPages = Math.ceil(totalCount / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedOrders = orders.slice(startIndex, startIndex + pageSize);

            return {
                orders: paginatedOrders,
                totalPages,
                currentPage: page,
                hasMore: orders.length > page * pageSize
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm đơn hàng:', error);
            throw error;
        }
    }

    matchesSearchCriteria(orderData, searchParams) {
        const {
            query,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            status
        } = searchParams;

        if (query && (!(
            orderData.userId.includes(query) || orderData.customerPhone.includes(query)
        ))) {
            return false;
        }

        if (minAmount !== undefined && orderData.totalAmount < minAmount) {
            return false;
        }

        if (maxAmount !== undefined && orderData.totalAmount > maxAmount) {
            return false;
        }

        const orderDate = new Date(orderData.createdAt);

        if (startDate && orderDate < new Date(startDate)) {
            return false;
        }

        if (endDate && orderDate > new Date(endDate)) {
            return false;
        }

        if (status && orderData.status !== status) {
            return false;
        }

        return true;
    }

    async hasUserPurchasedProduct(userId, productId) {
        try {
            const ordersRef = collection(db, this.collectionName);
            const q = query(
                ordersRef,
                where('userId', '==', userId),
                where('status', '==', 'completed')
            );
            const querySnapshot = await getDocs(q);

            for (const doc of querySnapshot.docs) {
                const order = doc.data();
                if (order.items && Array.isArray(order.items)) {
                    const hasProduct = order.items.some(item => item.productId === productId);
                    if (hasProduct) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Lỗi khi kiểm tra lịch sử mua hàng:', error);
            throw error;
        }
    }

    async getTotalRevenue(startDate, endDate) {
        let totalOrder = 0;
        let totalProduct = 0;
        let totalCostAmount = 0;
        let orders = [];
        try {
            console.log('startDate:', startDate);
            console.log('endDate:', endDate);
            const ordersRef = collection(db, this.collectionName);
            let q = query(
                ordersRef,
                where('status', '==', 'completed'),
                orderBy('createdAt')
            );

            if (startDate) {
                q = query(q, where('createdAt', '>=', new Date(startDate).toISOString()));
            }
            if (endDate) {
                q = query(q, where('createdAt', '<=', new Date(endDate).toISOString()));
            }

            const querySnapshot = await getDocs(q);
            let totalRevenue = 0;

            // Tạo một mảng các Promise để chờ tất cả các sản phẩm
            const productPromises = [];

            querySnapshot.forEach((doc) => {
                const order = Order.fromJSON({ ...doc.data(), id: doc.id });
                orders.push(order);
                totalRevenue += order.totalAmount;
                totalOrder++;
                totalProduct += order.items.length;
                console.log('order.items', order.items);

                // Thêm Promise vào mảng
                order.items.forEach(item => {
                    productPromises.push(productDAO.getById(item.productId).then(product => {
                        console.log('product', product);
                        totalCostAmount += product.costPrice * item.quantity;
                    }));
                });
            });

            // Chờ tất cả các Promise hoàn thành
            await Promise.all(productPromises);

            return { totalRevenue, totalOrder, totalProduct, orders, profit: totalRevenue - totalCostAmount };
        } catch (error) {
            console.error('Lỗi khi tính tổng doanh thu:', error);
            throw error;
        }
    }

    async getRevenueByMonth(year) {
        try {
            const ordersRef = collection(db, this.collectionName);
            const startDate = new Date(`${year}-01-01T00:00:00Z`);
            const endDate = new Date(`${year}-12-31T23:59:59Z`);

            const q = query(
                ordersRef,
                where('status', '==', 'completed'),
                where('createdAt', '>=', startDate.toISOString()),
                where('createdAt', '<=', endDate.toISOString()),
                orderBy('createdAt')
            );

            const querySnapshot = await getDocs(q);
            const revenueByMonth = Array(12).fill(0);

            querySnapshot.forEach((doc) => {
                const orderData = doc.data();
                const orderDate = new Date(orderData.createdAt);
                const monthIndex = orderDate.getMonth();
                revenueByMonth[monthIndex] += orderData.totalAmount;
            });

            return revenueByMonth;
        } catch (error) {
            console.error('Lỗi khi tính doanh thu theo tháng:', error);
            throw error;
        }
    }

    async getOrderStatusStats(year) {
        try {
            const ordersRef = collection(db, this.collectionName);
            const startDate = new Date(`${year}-01-01T00:00:00Z`);
            const endDate = new Date(`${year}-12-31T23:59:59Z`);

            const q = query(
                ordersRef,
                where('createdAt', '>=', startDate.toISOString()),
                where('createdAt', '<=', endDate.toISOString())
            );

            const querySnapshot = await getDocs(q);
            const stats = {
                pending: 0,
                processing: 0,
                shipped: 0,
                delivered: 0,
                cancelled: 0
            };

            querySnapshot.forEach((doc) => {
                const orderData = doc.data();
                if (stats.hasOwnProperty(orderData.status)) {
                    stats[orderData.status]++;
                }
            });

            return stats;
        } catch (error) {
            console.error('Lỗi khi lấy thống kê trạng thái đơn hàng:', error);
            throw error;
        }
    }

    async getTopProducts(year) {
        try {
            const ordersRef = collection(db, this.collectionName);
            const startDate = new Date(`${year}-01-01T00:00:00Z`);
            const endDate = new Date(`${year}-12-31T23:59:59Z`);

            const q = query(
                ordersRef,
                where('createdAt', '>=', startDate.toISOString()),
                where('createdAt', '<=', endDate.toISOString()),
                where('status', '==', 'completed')
            );

            const querySnapshot = await getDocs(q);
            const productSales = {};

            querySnapshot.forEach((doc) => {
                const orderData = doc.data();
                orderData.items.forEach((item) => {
                    if (productSales[item.productId]) {
                        productSales[item.productId].quantity += item.quantity;
                        productSales[item.productId].revenue += item.price * item.quantity;
                    } else {
                        productSales[item.productId] = {
                            name: item.productName,
                            quantity: item.quantity,
                            revenue: item.price * item.quantity
                        };
                    }
                });
            });

            const sortedProducts = Object.entries(productSales)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .slice(0, 5);

            return sortedProducts.map(([id, data]) => ({
                id,
                name: data.name,
                quantity: data.quantity,
                revenue: data.revenue
            }));
        } catch (error) {
            console.error('Lỗi khi lấy top sản phẩm:', error);
            throw error;
        }
    }

    async checkProductInOrders(productId) {
        const ordersRef = collection(db, this.collectionName);
        const querySnapshot = await getDocs(ordersRef);

        // Kiểm tra từng đơn hàng để xem có chứa productId không
        const hasProduct = querySnapshot.docs.some(doc => {
            const orderData = doc.data();
            return orderData.items.some(item => item.productId === productId);
        });

        console.log('Has product in orders:', hasProduct);
        return hasProduct; // Trả về true nếu có đơn hàng chứa sản phẩm
    }
}

module.exports = new OrderDAO();
