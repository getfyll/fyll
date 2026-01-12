// lib/firebase/sync.ts

import { db } from './firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';

export const syncService = {
    // Listen to products changes
    subscribeToProducts(businessId: string, callback: (products: any[]) => void) {
        const productsRef = collection(db, `businesses/${businessId}/products`);
        return onSnapshot(query(productsRef), (snapshot) => {
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(products);
        });
    },

    // Listen to orders changes
    subscribeToOrders(businessId: string, callback: (orders: any[]) => void) {
        const ordersRef = collection(db, `businesses/${businessId}/orders`);
        return onSnapshot(query(ordersRef), (snapshot) => {
            const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(orders);
        });
    },

    // Listen to customers changes
    subscribeToCustomers(businessId: string, callback: (customers: any[]) => void) {
        const customersRef = collection(db, `businesses/${businessId}/customers`);
        return onSnapshot(query(customersRef), (snapshot) => {
            const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(customers);
        });
    },

    // Listen to restock logs
    subscribeToRestockLogs(businessId: string, callback: (logs: any[]) => void) {
        const logsRef = collection(db, `businesses/${businessId}/restockLogs`);
        return onSnapshot(query(logsRef), (snapshot) => {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(logs);
        });
    },
};
