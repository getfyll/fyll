// lib/firebase/storage.ts

import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export const storageService = {
    // Upload product image
    async uploadProductImage(businessId: string, productId: string, imageUri: string): Promise<string> {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const storageRef = ref(storage, `businesses/${businessId}/products/${productId}/main.jpg`);
        await uploadBytes(storageRef, blob);

        return await getDownloadURL(storageRef);
    },

    // Upload variant image
    async uploadVariantImage(businessId: string, productId: string, variantId: string, imageUri: string): Promise<string> {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const storageRef = ref(storage, `businesses/${businessId}/products/${productId}/variants/${variantId}.jpg`);
        await uploadBytes(storageRef, blob);

        return await getDownloadURL(storageRef);
    },

    // Upload prescription
    async uploadPrescription(businessId: string, orderId: string, imageUri: string): Promise<string> {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const timestamp = Date.now();
        const storageRef = ref(storage, `businesses/${businessId}/prescriptions/${orderId}/${timestamp}.jpg`);
        await uploadBytes(storageRef, blob);

        return await getDownloadURL(storageRef);
    },

    // Delete image
    async deleteImage(url: string) {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
    },
};
