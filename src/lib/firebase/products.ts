// lib/firebase/products.ts
// Product and variant management

import { db } from './firebaseConfig';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    setDoc,
    getDoc
} from 'firebase/firestore';
import type { Product, ProductVariant, RestockLog } from '../state/fyll-store';

// Helper to remove undefined values from objects (Firebase doesn't accept undefined)
const cleanUndefined = <T extends Record<string, any>>(obj: T): T => {
    const cleaned = { ...obj };
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined) {
            delete cleaned[key];
        }
    });
    return cleaned as T;
};

export const productService = {
    // Create product
    async createProduct(businessId: string, product: Product) {
        console.log('📤 Creating product in Firebase:');
        console.log('   🏢 BusinessId:', businessId);
        console.log('   📦 Product ID:', product.id);
        console.log('   📛 Product Name:', product.name);
        console.log('   🔗 Full path: businesses/' + businessId + '/products/' + product.id);

        const productRef = doc(db, `businesses/${businessId}/products`, product.id);
        const productData = cleanUndefined({
            ...product,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        console.log('   📄 Product data:', JSON.stringify(productData, null, 2));

        try {
            await setDoc(productRef, productData);
            console.log('   ✅ Product saved successfully to Firebase');
        } catch (error) {
            console.error('   ❌ Failed to save product to Firebase:', error);
            throw error;
        }

        return product.id;
    },

    // Update product
    async updateProduct(businessId: string, productId: string, updates: Partial<Product>) {
        const productRef = doc(db, `businesses/${businessId}/products`, productId);
        await updateDoc(productRef, cleanUndefined({
            ...updates,
            updatedAt: new Date().toISOString(),
        }));
    },

    // Delete product
    async deleteProduct(businessId: string, productId: string) {
        const productRef = doc(db, `businesses/${businessId}/products`, productId);
        await deleteDoc(productRef);
    },

    // Update variant stock
    async updateVariantStock(businessId: string, productId: string, variantId: string, newStock: number) {
        const product = await this.getProduct(businessId, productId);

        if (product) {
            const updatedVariants = product.variants.map(v =>
                v.id === variantId ? { ...v, stock: newStock } : v
            );

            await this.updateProduct(businessId, productId, { variants: updatedVariants });
        }
    },

    // Add variant to product
    async addVariant(businessId: string, productId: string, variant: ProductVariant) {
        const product = await this.getProduct(businessId, productId);

        if (product) {
            const productRef = doc(db, `businesses/${businessId}/products`, productId);
            await updateDoc(productRef, {
                variants: [...product.variants, variant],
                updatedAt: new Date().toISOString(),
            });
        }
    },

    // Update variant
    async updateVariant(businessId: string, productId: string, variantId: string, updates: Partial<ProductVariant>) {
        const product = await this.getProduct(businessId, productId);

        if (product) {
            const updatedVariants = product.variants.map(v =>
                v.id === variantId ? { ...v, ...updates } : v
            );

            await this.updateProduct(businessId, productId, { variants: updatedVariants });
        }
    },

    // Delete variant
    async deleteVariant(businessId: string, productId: string, variantId: string) {
        const product = await this.getProduct(businessId, productId);

        if (product) {
            const updatedVariants = product.variants.filter(v => v.id !== variantId);
            await this.updateProduct(businessId, productId, { variants: updatedVariants });
        }
    },

    // Restock variant
    async restockVariant(
        businessId: string,
        productId: string,
        variantId: string,
        quantity: number,
        performedBy?: string
    ) {
        const product = await this.getProduct(businessId, productId);
        const variant = product?.variants.find(v => v.id === variantId);

        if (!product || !variant) return;

        const previousStock = variant.stock;
        const newStock = previousStock + quantity;

        // Update stock
        await this.updateVariantStock(businessId, productId, variantId, newStock);

        // Log restock
        const restockLog: RestockLog = {
            id: doc(collection(db, 'temp')).id,
            productId,
            variantId,
            quantityAdded: quantity,
            previousStock,
            newStock,
            timestamp: new Date().toISOString(),
            performedBy,
        };

        await this.addRestockLog(businessId, restockLog);
    },

    // Add restock log
    async addRestockLog(businessId: string, log: RestockLog) {
        const logRef = doc(db, `businesses/${businessId}/restockLogs`, log.id);
        await setDoc(logRef, log);
    },

    // Get all products
    async getAllProducts(businessId: string): Promise<Product[]> {
        const productsRef = collection(db, `businesses/${businessId}/products`);
        const snapshot = await getDocs(productsRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    },

    // Get single product
    async getProduct(businessId: string, productId: string): Promise<Product | null> {
        const productRef = doc(db, `businesses/${businessId}/products`, productId);
        const snapshot = await getDoc(productRef);

        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Product;
        }
        return null;
    },

    // Get all restock logs
    async getAllRestockLogs(businessId: string): Promise<RestockLog[]> {
        const logsRef = collection(db, `businesses/${businessId}/restockLogs`);
        const snapshot = await getDocs(logsRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RestockLog));
    },
};
