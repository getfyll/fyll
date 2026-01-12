// lib/firebase/sync.ts

import { db } from './firebaseConfig';
import { collection, getDocs, query } from 'firebase/firestore/lite';

const pollIntervalMs = 4000;

const subscribeWithPolling = (path: string, callback: (items: any[]) => void) => {
    let cancelled = false;

    const run = async () => {
        try {
            const snapshot = await getDocs(query(collection(db, path)));
            if (cancelled) return;
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(items);
        } catch (error) {
            console.warn('Firestore polling error:', error);
        }
    };

    run();
    const interval = setInterval(run, pollIntervalMs);
    return () => {
        cancelled = true;
        clearInterval(interval);
    };
};


export const syncService = {
    // Listen to products changes
    subscribeToProducts(businessId: string, callback: (products: any[]) => void) {
        const path = `businesses/${businessId}/products`;
        return subscribeWithPolling(path, callback);
    },

    // Listen to orders changes
    subscribeToOrders(businessId: string, callback: (orders: any[]) => void) {
        const path = `businesses/${businessId}/orders`;
        return subscribeWithPolling(path, callback);
    },

    // Listen to customers changes
    subscribeToCustomers(businessId: string, callback: (customers: any[]) => void) {
        const path = `businesses/${businessId}/customers`;
        return subscribeWithPolling(path, callback);
    },

    // Listen to restock logs
    subscribeToRestockLogs(businessId: string, callback: (logs: any[]) => void) {
        const path = `businesses/${businessId}/restockLogs`;
        return subscribeWithPolling(path, callback);
    },
};
