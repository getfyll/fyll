// lib/firebase/orders.ts
// Order management

import { db } from './firebaseConfig';
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc
} from 'firebase/firestore/lite';
import type { Order } from '../state/fyll-store';

export const orderService = {
    // Create order
    async createOrder(businessId: string, order: Order) {
        const orderRef = doc(db, `businesses/${businessId}/orders`, order.id);
        await setDoc(orderRef, {
            ...order,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        return order.id;
    },

    // Update order
    async updateOrder(businessId: string, orderId: string, updates: Partial<Order>) {
        const orderRef = doc(db, `businesses/${businessId}/orders`, orderId);
        await updateDoc(orderRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
        });
    },

    // Delete order
    async deleteOrder(businessId: string, orderId: string) {
        const orderRef = doc(db, `businesses/${businessId}/orders`, orderId);
        await deleteDoc(orderRef);
    },

    // Get all orders
    async getAllOrders(businessId: string): Promise<Order[]> {
        const ordersRef = collection(db, `businesses/${businessId}/orders`);
        const snapshot = await getDocs(ordersRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    },

    // Get single order
    async getOrder(businessId: string, orderId: string): Promise<Order | null> {
        const orderRef = doc(db, `businesses/${businessId}/orders`, orderId);
        const snapshot = await getDoc(orderRef);

        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Order;
        }
        return null;
    },

    // Update order status
    async updateOrderStatus(businessId: string, orderId: string, status: string, updatedBy?: string) {
        await this.updateOrder(businessId, orderId, {
            status,
            updatedBy,
            updatedAt: new Date().toISOString()
        });
    },

    // Add prescription to order
    async addPrescription(businessId: string, orderId: string, prescriptionInfo: any) {
        await this.updateOrder(businessId, orderId, { prescription: prescriptionInfo });
    },

    // Add logistics info
    async addLogistics(businessId: string, orderId: string, logisticsInfo: any) {
        await this.updateOrder(businessId, orderId, { logistics: logisticsInfo });
    },
};
