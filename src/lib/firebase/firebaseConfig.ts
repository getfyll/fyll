import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
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

console.log('🔥 Initializing Firebase app...');
console.log('📋 Project ID:', firebaseConfig.projectId);
console.log('🌐 Auth Domain:', firebaseConfig.authDomain);

const app = initializeApp(firebaseConfig);

// Use simple getFirestore - let Firebase SDK handle everything
// The issue is likely Firestore security rules blocking access
const db: Firestore = getFirestore(app);
console.log('🔥 Firestore initialized with default settings');

// Test Firestore API connectivity
fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then(response => {
    console.log('🌐 Firestore REST API reachable:', response.status);
    if (response.status === 401 || response.status === 403) {
      console.warn('⚠️ Firestore API returned auth error - this is normal without credentials');
    }
  })
  .catch(err => {
    console.error('❌ Firestore REST API test failed:', err);
    console.error('   This may indicate network issues or CORS problems');
  });

export { db };
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
