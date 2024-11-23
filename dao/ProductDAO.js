const { db } = require('../config/firebaseConfig');
const { collection, getDocs, query, orderBy, limit, startAfter, getCountFromServer, where, doc, addDoc, updateDoc, deleteDoc, getDoc } = require('firebase/firestore');
const Product = require('../models/ProductModel');
const CategoryDAO = require('./CategoryDAO');

class ProductDAO {
    constructor() {
        this.collectionName = 'products';
    }

    async add(productData) {
        try {
            if (!productData.categoryId) {
                throw new Error('categoryId là bắt buộc khi thêm sản phẩm mới');
            }

            // Kiểm tra xem category có tồn tại không
            const categoryExists = await CategoryDAO.getById(productData.categoryId);
            if (!categoryExists) {
                throw new Error('Danh mục không tồn tại');
            }

            const product = new Product(
                productData.name,
                productData.description,
                productData.price,
                productData.costPrice,
                productData.quantity,
                productData.images,
                productData.categoryId
            );
            const productToAdd = product.toJSON();
            const docRef = await addDoc(collection(db, this.collectionName), productToAdd);
            return docRef.id;
        } catch (error) {
            console.error("Lỗi khi thêm sản phẩm: ", error);
            throw error;
        }
    }

    async update(id, productData) {
        try {
            const productRef = doc(db, this.collectionName, id);
            const docSnap = await getDoc(productRef);

            if (!docSnap.exists()) {
                throw new Error('Sản phẩm không tồn tại');
            }

            const existingProduct = Product.fromJSON({ ...docSnap.data(), id });

            // Nếu categoryId được cung cấp, kiểm tra xem nó có tồn tại không
            if (productData.categoryId) {
                const categoryExists = await CategoryDAO.getById(productData.categoryId);
                if (!categoryExists) {
                    throw new Error('Danh mục không tồn tại');
                }
            } else {
                // Nếu không được cung cấp, sử dụng categoryId hiện tại
                productData.categoryId = existingProduct.categoryId;
            }

            Object.assign(existingProduct, productData);
            existingProduct.updatedAt = new Date();
            const updatedProductData = existingProduct.toJSON();
            await updateDoc(productRef, updatedProductData);
            return id;
        } catch (error) {
            console.error("Lỗi khi cập nhật sản phẩm: ", error);
            throw error;
        }
    }

    async delete(productId) {
        try {
            // Kiểm tra xem sản phẩm có nằm trong đơn hàng nào không
            const isInOrder = await this.checkProductInOrders(productId);
            if (isInOrder) {
                throw new Error('Không thể xóa sản phẩm vì nó đã nằm trong đơn hàng.');
            }

            const productRef = doc(db, this.collectionName, productId);
            await deleteDoc(productRef);
        } catch (error) {
            console.error("Lỗi khi xóa sản phẩm: ", error);
            throw error;
        }
    }



    async checkProductInOrders(productId) {
        const ordersRef = collection(db, 'orders');
        const querySnapshot = await getDocs(ordersRef);

        // Kiểm tra từng đơn hàng để xem có chứa productId không
        const hasProduct = querySnapshot.docs.some(doc => {
            const orderData = doc.data();
            return orderData.items.some(item => item.productId === productId);
        });

        console.log('Has product in orders:', hasProduct);
        return hasProduct; // Trả về true nếu có đơn hàng chứa sản phẩm
    }


    async getById(id) {
        try {
            const docSnap = await getDoc(doc(db, this.collectionName, id));

            if (docSnap.exists()) {
                return Product.fromJSON({ id: docSnap.id, ...docSnap.data() });
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error getting product: ", error);
            throw error;
        }
    }

    async getAll(page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            const snapshot = await getCountFromServer(collectionRef);
            const totalCount = snapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let q = query(collectionRef, orderBy('name'), limit(pageSize));

            if (page > 1) {
                const startAtDoc = await this.getStartAtDoc(page, pageSize);
                if (startAtDoc) {
                    q = query(q, startAfter(startAtDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const products = querySnapshot.docs.map(doc => Product.fromJSON({ ...doc.data(), id: doc.id }));

            return {
                products,
                totalPages,
                currentPage: page,
                hasMore: page < totalPages
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách sản phẩm: ", error);
            throw error;
        }
    }

    async getStartAtDoc(page, pageSize) {
        const skipCount = (page - 1) * pageSize;
        const q = query(collection(db, this.collectionName), orderBy('name'), limit(1), startAfter(skipCount));
        const snapshot = await getDocs(q);
        return snapshot.docs[0];
    }

    async getByType(type) {
        try {
            const q = query(collection(db, this.collectionName), where("type", "==", type));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => Product.fromJSON({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error getting products by type: ", error);
            throw error;
        }
    }

    async exists(productId) {
        const productDoc = await getDoc(doc(db, 'products', productId));
        return productDoc.exists();
    }

    async search(searchQuery, minPrice, maxPrice, page = 1, pageSize = 10) {
        const collectionRef = collection(db, this.collectionName);
        try {
            // Lấy tất cả sản phẩm
            const querySnapshot = await getDocs(collectionRef);
            let products = querySnapshot.docs.map(doc => Product.fromJSON({ ...doc.data(), id: doc.id }));

            // Lọc sản phẩm theo điều kiện tìm kiếm
            const isAccent = /[áàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/i.test(searchQuery);
            const searchRegex = new RegExp(searchQuery, 'i');
            const searchRegexNoAccent = new RegExp(searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), 'i');

            products = products.filter(product => {
                const productName = product.name;
                const productNameNoAccent = productName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                return (
                    (isAccent ? searchRegex.test(productName) : searchRegexNoAccent.test(productNameNoAccent)) &&
                    (minPrice === undefined || product.price >= parseFloat(minPrice)) &&
                    (maxPrice === undefined || product.price <= parseFloat(maxPrice))
                );
            });

            // Phân trang
            const totalCount = products.length;
            const totalPages = Math.ceil(totalCount / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

            return {
                products: paginatedProducts,
                totalPages,
                currentPage: page,
                hasMore: products.length > page * pageSize
            };
        } catch (error) {
            console.error('Lỗi khi tìm kiếm sản phẩm:', error);
            throw error;
        }
    }

    async getStartAfterDoc(q, page, pageSize) {
        const startAt = (page - 1) * pageSize;
        const snapshot = await getDocs(query(q, limit(startAt)));
        return snapshot.docs[snapshot.docs.length - 1];
    }

    async getByCategoryId(categoryId, page = 1, pageSize = 10) {
        try {
            const collectionRef = collection(db, this.collectionName);

            let q = query(
                collectionRef,
                where('categoryId', '==', categoryId),
                orderBy('name'),
                limit(pageSize)
            );

            if (page > 1) {
                const startAfterDoc = await this.getStartAfterDoc(q, page, pageSize);
                if (startAfterDoc) {
                    q = query(q, startAfter(startAfterDoc));
                }
            }

            const querySnapshot = await getDocs(q);
            const products = querySnapshot.docs.map(doc => Product.fromJSON({ ...doc.data(), id: doc.id }));

            // Tính toán tổng số trang
            const totalCountQuery = query(collectionRef, where('categoryId', '==', categoryId));
            const totalCountSnapshot = await getCountFromServer(totalCountQuery);
            const totalCount = totalCountSnapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            return {
                products,
                totalPages,
                currentPage: page,
                hasMore: products.length === pageSize
            };
        } catch (error) {
            console.error("Lỗi khi lấy sản phẩm theo danh mục: ", error);
            throw error;
        }
    }

    matchesSearchCriteria(product, searchQuery, minPrice, maxPrice) {
        // Kiểm tra điều kiện tìm kiếm theo từ khóa
        const matchesQuery = !searchQuery || product.searchKeywords.some(keyword => {
            const normalizedKeyword = Product.removeDiacritics(keyword.toLowerCase());
            const normalizedQuery = Product.removeDiacritics(searchQuery.toLowerCase());
            return normalizedKeyword.includes(normalizedQuery);
        });

        // Kiểm tra điều kiện giá tối thiểu
        const matchesMinPrice = minPrice === undefined || minPrice === '' || product.price >= parseFloat(minPrice);

        // Kiểm tra điều kiện giá tối đa
        const matchesMaxPrice = maxPrice === undefined || maxPrice === '' || product.price <= parseFloat(maxPrice);

        // Trả về true nếu sản phẩm thỏa mãn tất cả các điều kiện
        return matchesQuery && matchesMinPrice && matchesMaxPrice;
    }

}

module.exports = new ProductDAO();
