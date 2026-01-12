// lib/firebase/customers.ts
// Customer/CRM management

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
import type { Customer } from '../state/fyll-store';

export const customerService = {
    async createCustomer(businessId: string, customer: Customer) {
        const customerRef = doc(db, `businesses/${businessId}/customers`, customer.id);
        await setDoc(customerRef, customer);
        return customer.id;
    },

    async updateCustomer(businessId: string, customerId: string, updates: Partial<Customer>) {
        const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
        await updateDoc(customerRef, updates);
    },

    async deleteCustomer(businessId: string, customerId: string) {
        const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
        await deleteDoc(customerRef);
    },

    async getAllCustomers(businessId: string): Promise<Customer[]> {
        const customersRef = collection(db, `businesses/${businessId}/customers`);
        const snapshot = await getDocs(customersRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    },

    async getCustomer(businessId: string, customerId: string): Promise<Customer | null> {
        const customerRef = doc(db, `businesses/${businessId}/customers`, customerId);
        const snapshot = await getDoc(customerRef);

        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Customer;
        }
        return null;
    },
};
