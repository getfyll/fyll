// lib/firebase/settings.ts

import { db } from './firebaseConfig';
import {
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore/lite';
import type {
    OrderStatus,
    SaleSource,
    CustomService,
    PaymentMethod,
    LogisticsCarrier,
    ExpenseCategory
} from '../state/fyll-store';

export const settingsService = {
    // Order Statuses
    async saveOrderStatuses(businessId: string, statuses: OrderStatus[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'orderStatuses');
        await setDoc(settingsRef, { statuses });
    },

    async getOrderStatuses(businessId: string): Promise<OrderStatus[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'orderStatuses');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.statuses || [];
    },

    // Sale Sources
    async saveSaleSources(businessId: string, sources: SaleSource[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'saleSources');
        await setDoc(settingsRef, { sources });
    },

    async getSaleSources(businessId: string): Promise<SaleSource[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'saleSources');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.sources || [];
    },

    // Custom Services
    async saveCustomServices(businessId: string, services: CustomService[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'customServices');
        await setDoc(settingsRef, { services });
    },

    async getCustomServices(businessId: string): Promise<CustomService[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'customServices');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.services || [];
    },

    // Payment Methods
    async savePaymentMethods(businessId: string, methods: PaymentMethod[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'paymentMethods');
        await setDoc(settingsRef, { methods });
    },

    async getPaymentMethods(businessId: string): Promise<PaymentMethod[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'paymentMethods');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.methods || [];
    },

    // Logistics Carriers
    async saveLogisticsCarriers(businessId: string, carriers: LogisticsCarrier[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'logisticsCarriers');
        await setDoc(settingsRef, { carriers });
    },

    async getLogisticsCarriers(businessId: string): Promise<LogisticsCarrier[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'logisticsCarriers');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.carriers || [];
    },

    // Categories
    async saveCategories(businessId: string, categories: string[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'categories');
        await setDoc(settingsRef, { categories });
    },

    async getCategories(businessId: string): Promise<string[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'categories');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.categories || [];
    },

    // Expense Categories
    async saveExpenseCategories(businessId: string, categories: ExpenseCategory[]) {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'expenseCategories');
        await setDoc(settingsRef, { categories });
    },

    async getExpenseCategories(businessId: string): Promise<ExpenseCategory[]> {
        const settingsRef = doc(db, `businesses/${businessId}/settings`, 'expenseCategories');
        const snapshot = await getDoc(settingsRef);
        return snapshot.data()?.categories || [];
    },
};
