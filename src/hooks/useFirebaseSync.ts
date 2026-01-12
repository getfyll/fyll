// src/hooks/useFirebaseSync.ts
// Hook to sync Zustand store with Firebase in real-time

import { useEffect, useRef, useState } from 'react';
import { enableNetwork } from 'firebase/firestore';
import { db } from '../lib/firebase/firebaseConfig';
import useFyllStore from '../lib/state/fyll-store';
import useAuthStore from '../lib/state/auth-store';
import { syncService } from '../lib/firebase/sync';
import { productService } from '../lib/firebase';
import type { Product, Order, Customer } from '../lib/state/fyll-store';

export function useFirebaseSync() {
    const [isInitialized, setIsInitialized] = useState(false);
    const hasSeededProducts = useRef(false);
    const businessId = useAuthStore((s) => s.businessId);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isOfflineMode = useAuthStore((s) => s.isOfflineMode);

    useEffect(() => {
        if (!isAuthenticated || !businessId || isOfflineMode) {
            return;
        }

        console.log('🔥 Initializing Firebase sync...');
        console.log('📊 BusinessId:', businessId);
        console.log('👤 User:', useAuthStore.getState().currentUser?.email);

        // Force enable network to prevent "offline mode" cache issues
        enableNetwork(db)
            .then(() => console.log('📡 Network force-enabled - Firestore is now online'))
            .catch((error) => console.warn('⚠️ Could not force enable network:', error));

        // Subscribe to products
        const unsubProducts = syncService.subscribeToProducts(businessId, async (firebaseProducts: Product[]) => {
            console.log('📦 Products synced from Firebase:', firebaseProducts.length);
            if (firebaseProducts.length > 0) {
                console.log('📋 Product names:', firebaseProducts.map(p => p.name).join(', '));
            }

            if (firebaseProducts.length === 0) {
                const localProducts = useFyllStore.getState().products;
                if (localProducts.length > 0 && !hasSeededProducts.current) {
                    hasSeededProducts.current = true;
                    try {
                        await Promise.all(localProducts.map((product) => productService.createProduct(businessId, product)));
                        console.log('🌱 Seeded local products to Firebase');
                    } catch (error) {
                        console.error('❌ Failed to seed products to Firebase:', error);
                    }
                    return;
                }
            }

            useFyllStore.setState({ products: firebaseProducts });
        });

        // Subscribe to orders
        const unsubOrders = syncService.subscribeToOrders(businessId, (firebaseOrders: Order[]) => {
            console.log('📋 Orders synced from Firebase:', firebaseOrders.length);
            useFyllStore.setState({ orders: firebaseOrders });
        });

        // Subscribe to customers
        const unsubCustomers = syncService.subscribeToCustomers(businessId, (firebaseCustomers: Customer[]) => {
            console.log('👥 Customers synced from Firebase:', firebaseCustomers.length);
            useFyllStore.setState({ customers: firebaseCustomers });
        });

        const unsubRestockLogs = syncService.subscribeToRestockLogs(businessId, (firebaseLogs: any[]) => {
            console.log('📊 Restock logs synced from Firebase:', firebaseLogs.length);
            useFyllStore.setState({ restockLogs: firebaseLogs });
        });

        setIsInitialized(true);
        console.log('✅ Firebase sync initialized');

        // Cleanup subscriptions on unmount
        return () => {
            console.log('🔌 Disconnecting Firebase sync...');
            unsubProducts();
            unsubOrders();
            unsubCustomers();
            unsubRestockLogs();
        };
    }, [businessId, isAuthenticated, isOfflineMode]);

    return { isInitialized };
}
