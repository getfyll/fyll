import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// For production (Vercel), use getFirestore to avoid initializeFirestore issues
// For Vibecode dev, use initializeFirestore with long polling
const isProduction = process.env.EXPO_PUBLIC_IS_PRODUCTION === 'true';
const db = isProduction
  ? getFirestore(app)
  : initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });

export { db };
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
