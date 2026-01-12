// lib/firebase/sync.ts

import { Platform } from 'react-native';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';

// Real-time subscription using onSnapshot
const subscribeWithRealtime = (path: string, callback: (items: any[]) => void) => {
    const unsubscribe = onSnapshot(
        query(collection(db, path)),
        (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(items);
        },
        (error) => {
            console.warn('Firestore sync error:', error);
        }
    );

    return unsubscribe;
};


export const syncService = {
    // Listen to products changes
    subscribeToProducts(businessId: string, callback: (products: any[]) => void) {
        const path = `businesses/${businessId}/products`;
        return subscribeWithRealtime(path, callback);
    },

    // Listen to orders changes
    subscribeToOrders(businessId: string, callback: (orders: any[]) => void) {
        const path = `businesses/${businessId}/orders`;
        return subscribeWithRealtime(path, callback);
    },

    // Listen to customers changes
    subscribeToCustomers(businessId: string, callback: (customers: any[]) => void) {
        const path = `businesses/${businessId}/customers`;
        return subscribeWithRealtime(path, callback);
    },

    // Listen to restock logs
    subscribeToRestockLogs(businessId: string, callback: (logs: any[]) => void) {
        const path = `businesses/${businessId}/restockLogs`;
        return subscribeWithRealtime(path, callback);
    },
};
