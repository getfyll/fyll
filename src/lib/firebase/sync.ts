// lib/firebase/sync.ts

import { Platform } from 'react-native';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';

// Real-time subscription using onSnapshot
const subscribeWithRealtime = (path: string, callback: (items: any[]) => void) => {
    console.log('🎧 Setting up listener for path:', path);
    console.log('🔍 Firebase Project ID:', db.app.options.projectId);

    // First, try to fetch from server to verify connectivity
    getDocs(query(collection(db, path)))
        .then(serverSnapshot => {
            console.log('🌐 Server connectivity test:', {
                path,
                docs: serverSnapshot.docs.length,
                fromCache: serverSnapshot.metadata.fromCache,
                hasPendingWrites: serverSnapshot.metadata.hasPendingWrites
            });

            if (serverSnapshot.metadata.fromCache) {
                console.warn('⚠️ WARNING: Data is from cache, not server!');
                console.warn('   Possible causes:');
                console.warn('   1. Firestore security rules are blocking access');
                console.warn('   2. Network is offline');
                console.warn('   3. Firestore is in persistent offline mode');
            }
        })
        .catch(error => {
            console.error('❌ Server connectivity test failed:', error);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);

            if (error.code === 'permission-denied') {
                console.error('   🚨 PERMISSION DENIED!');
                console.error('   Your Firestore security rules are blocking access to:', path);
                console.error('   Please check your rules in Firebase Console');
            }
        });

    const unsubscribe = onSnapshot(
        query(collection(db, path)),
        {
            // Force include snapshot metadata to detect cache vs server
            includeMetadataChanges: true,
        },
        (snapshot) => {
            const docCount = snapshot.docs.length;
            const fromCache = snapshot.metadata.fromCache;
            const hasPendingWrites = snapshot.metadata.hasPendingWrites;

            console.log('🔔 Snapshot received for', path);
            console.log('   📊 Docs:', docCount);
            console.log('   💾 From cache:', fromCache);
            console.log('   🔄 Has pending writes:', hasPendingWrites);

            // Only process if data is from server (not cache) OR if it's the initial snapshot
            if (!fromCache || docCount > 0) {
                if (docCount > 0) {
                    console.log('   📄 First doc ID:', snapshot.docs[0].id);
                    console.log('   📄 First doc data:', snapshot.docs[0].data());
                } else {
                    console.log('   ⚠️ Collection is EMPTY (from server)');
                }

                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(items);
            } else {
                console.log('   ⏭️  Skipping cache-only snapshot, waiting for server data...');
            }
        },
        (error) => {
            console.error('❌ Firestore sync error for', path, ':', error);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);

            // Check if it's a permission error
            if (error.code === 'permission-denied') {
                console.error('   🚨 PERMISSION DENIED - Check Firestore security rules!');
            }
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
