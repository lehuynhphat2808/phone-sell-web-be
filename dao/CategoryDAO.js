const { db } = require('../config/firebaseConfig');
const {
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getCountFromServer,
    collection
} = require('firebase/firestore');
const Category = require('../models/CategoryModel');

class CategoryDAO {
    constructor() {
        this.collectionName = 'categories';
    }

    async add(categoryData) {
        try {
            const category = new Category(categoryData.name, categoryData.description, categoryData.imageUrl);
            const collectionRef = collection(db, this.collectionName);
            const docRef = await addDoc(collectionRef, category.toJSON());
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm danh mục: ", error);
            throw error;
        }
    }

    async update(id, categoryData) {
        try {
            const categoryRef = doc(db, this.collectionName, id);
            const category = new Category(categoryData.name, categoryData.description, categoryData.imageUrl, id);
            await updateDoc(categoryRef, category.toJSON());
        } catch (error) {
            console.error("Lỗi khi cập nhật danh mục: ", error);
            throw error;
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error("Lỗi khi xóa danh mục: ", error);
            throw error;
        }
    }

    async getById(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return Category.fromJSON({ ...docSnap.data(), id: docSnap.id });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh mục theo ID: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            // Lấy tổng số danh mục
            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;

            // Tính toán số trang
            const totalPages = Math.ceil(totalCount / pageSize);

            // Tạo query cơ bản
            let q = query(collectionRef, orderBy('name'), limit(pageSize));

            // Nếu không phải trang đầu, cần lấy điểm bắt đầu
            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            // Thực hiện truy vấn
            const querySnapshot = await getDocs(q);
            const categories = querySnapshot.docs.map(doc => Category.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                categories,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách danh mục: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('name'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByName(name) {
        try {
            const q = query(collection(db, this.collectionName), where("name", "==", name));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Category.fromJSON({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Lỗi khi tìm danh mục theo tên: ", error);
            throw error;
        }
    }

    async search(searchQuery, page, pageSize) {
        const collectionRef = collection(db, this.collectionName);
        try {
            // Lấy tất cả danh mục
            const querySnapshot = await getDocs(collectionRef);
            let categories = querySnapshot.docs.map(doc => Category.fromJSON({ ...doc.data(), id: doc.id }));

            // Lọc danh mục theo điều kiện tìm kiếm
            const searchRegex = new RegExp(searchQuery, 'i');
            categories = categories.filter(category => searchRegex.test(category.name));

            // Phân trang
            const totalCount = categories.length;
            const totalPages = Math.ceil(totalCount / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedCategories = categories.slice(startIndex, startIndex + pageSize);

            return {
                categories: paginatedCategories,
                totalPages,
                currentPage: page,
                hasMore: categories.length > page * pageSize
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm danh mục:', error);
            throw error;
        }
    }
}

module.exports = new CategoryDAO();
