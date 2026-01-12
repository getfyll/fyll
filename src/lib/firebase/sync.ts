// lib/firebase/sync.ts

import { Platform } from 'react-native';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';

// Real-time subscription using onSnapshot
const subscribeWithRealtime = (path: string, callback: (items: any[]) => void) => {
    console.log('🎧 Setting up listener for path:', path);
    console.log('🔍 Firebase Project ID:', db.app.options.projectId);

    const unsubscribe = onSnapshot(
        query(collection(db, path)),
        (snapshot) => {
            console.log('🔔 Snapshot received for', path);
            console.log('   📊 Docs:', snapshot.docs.length);
            console.log('   💾 From cache:', snapshot.metadata.fromCache);
            console.log('   🔄 Has pending writes:', snapshot.metadata.hasPendingWrites);

            if (snapshot.docs.length > 0) {
                console.log('   📄 First doc ID:', snapshot.docs[0].id);
                console.log('   📄 First doc data:', snapshot.docs[0].data());
            } else {
                console.log('   ⚠️ Collection is EMPTY');
            }

            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(items);
        },
        (error) => {
            console.error('❌ Firestore sync error for', path, ':', error);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);
        }
    );

    console.log('✅ Listener registered for:', path);
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
