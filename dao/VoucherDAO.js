const { db } = require('../config/firebaseConfig');
const { query, orderBy, limit, startAfter, getDocs, getCountFromServer, getDoc, doc, addDoc, updateDoc, deleteDoc, collection, where } = require('firebase/firestore');
const Voucher = require('../models/VoucherModel');

class VoucherDAO {
    constructor() {
        this.collectionName = 'vouchers';
    }

    async add(voucherData) {
        try {
            const voucher = new Voucher(
                voucherData.code,
                voucherData.discountType,
                voucherData.discountValue,
                voucherData.minPurchase,
                voucherData.maxDiscount,
                voucherData.startDate,
                voucherData.endDate,
                voucherData.usageLimit
            );
            const docRef = await addDoc(collection(db, this.collectionName), voucher.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm voucher: ", error);
            throw error;
        }
    }

    async update(id, voucherData) {
        try {
            const voucherRef = doc(db, this.collectionName, id);
            const updatedData = { ...voucherData };

            // Chuyển đổi startDate và endDate thành đối tượng Date nếu chúng tồn tại
            if (updatedData.startDate) {
                updatedData.startDate = new Date(updatedData.startDate);
            }
            if (updatedData.endDate) {
                updatedData.endDate = new Date(updatedData.endDate);
            }

            const voucher = Voucher.fromJSON({ ...updatedData, id });
            await updateDoc(voucherRef, voucher.toJSON());
        } catch (error) {
            console.error("Lỗi khi cập nhật voucher: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa voucher: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));
            if (docSnap.exists()) {
                return Voucher.fromJSON({ id: docSnap.id, ...docSnap.data() });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy voucher theo ID: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let q = query(collectionRef, orderBy('code'), limit(pageSize));

            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const vouchers = querySnapshot.docs.map(doc => Voucher.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                vouchers,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách voucher: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('code'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByCode(code) {
        try {
            const q = query(collection(db, this.collectionName), where("code", "==", code));
            const querySnapshot = await getDocs(q);
            const vouchers = querySnapshot.docs.map(doc => Voucher.fromJSON({ id: doc.id, ...doc.data() }));
            return vouchers.length > 0 ? vouchers[0] : null;
        } catch (error) {
            console.error("Lỗi khi lấy voucher theo mã: ", error);
            throw error;
        }
    }

    async getValidVouchers() {
        try {
            const now = new Date();
            const q = query(
                collection(db, this.collectionName),
                where("startDate", "<=", now),
                where("endDate", ">=", now)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs
                .map(doc => Voucher.fromJSON({ ...doc.data(), id: doc.id }))
                .filter(voucher => voucher.usageCount < voucher.usageLimit);
        } catch (error) {
            console.error("Lỗi khi lấy voucher hợp lệ: ", error);
            throw error;
        }
    }

    async search(searchParams, page = 1, pageSize = 10) {
        const collectionRef = collection(db, this.collectionName);
        try {
            let vouchers = [];
            let lastDoc = null;
            let totalFetched = 0;
            const requiredResults = page * pageSize;

            while (vouchers.length < requiredResults) {
                const batchSize = Math.min(500, requiredResults - vouchers.length);

                let q = query(collectionRef, orderBy('code'), limit(batchSize));

                if (lastDoc) {
                    q = query(q, startAfter(lastDoc));
                }

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    break;
                }

                const batch = querySnapshot.docs
                    .filter(doc => this.matchesSearchCriteria(doc.data(), searchParams))
                    .map(doc => Voucher.fromJSON({ ...doc.data(), id: doc.id }));

                vouchers = vouchers.concat(batch);
                lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                totalFetched += querySnapshot.docs.length;

                if (querySnapshot.docs.length < batchSize) {
                    break;
                }
            }

            const startIndex = (page - 1) * pageSize;
            const paginatedVouchers = vouchers.slice(startIndex, startIndex + pageSize);

            const totalCount = vouchers.length;
            const totalPages = Math.ceil(totalCount / pageSize);

            return {
                vouchers: paginatedVouchers,
                totalPages,
                currentPage: page,
                hasMore: vouchers.length > page * pageSize
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm voucher:', error);
            throw error;
        }
    }

    matchesSearchCriteria(voucherData, searchParams) {
        const {
            code,
            discountType,
            minDiscountValue,
            maxDiscountValue,
            minPurchase,
            maxDiscount,
            startDate,
            endDate,
            minUsageLimit,
            maxUsageCount
        } = searchParams;
        if (code && !voucherData.code.toLowerCase().includes(code.toLowerCase())) {
            return false;
        }

        if (discountType && voucherData.discountType !== discountType) {
            return false;
        }

        if (minDiscountValue !== undefined && voucherData.discountValue < parseFloat(minDiscountValue)) {
            return false;
        }

        if (maxDiscountValue !== undefined && voucherData.discountValue > parseFloat(maxDiscountValue)) {
            return false;
        }

        if (minPurchase !== undefined && voucherData.minPurchase < parseFloat(minPurchase)) {
            return false;
        }

        if (maxDiscount !== undefined && voucherData.maxDiscount > parseFloat(maxDiscount)) {
            return false;
        }

        if (startDate && new Date(voucherData.startDate) < new Date(startDate)) {
            return false;
        }

        if (endDate && new Date(voucherData.endDate) > new Date(endDate)) {
            return false;
        }

        if (minUsageLimit !== undefined && voucherData.usageLimit < parseInt(minUsageLimit)) {
            return false;
        }

        if (maxUsageCount !== undefined && voucherData.usageCount > parseInt(maxUsageCount)) {
            return false;
        }

        return true;
    }
}

module.exports = new VoucherDAO();
