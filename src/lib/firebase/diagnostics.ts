// Firestore connectivity diagnostics
import { db } from './firebaseConfig';
import { collection, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';

export const firestoreDiagnostics = {
  async testConnectivity(businessId: string) {
    console.log('🔍 Running Firestore connectivity diagnostics...');
    console.log('📊 BusinessId:', businessId);

    const results = {
      canRead: false,
      canWrite: false,
      error: null as any,
    };

    // Test 1: Try to read from products collection
    try {
      console.log('📖 Test 1: Attempting to read products...');
      const productsRef = collection(db, `businesses/${businessId}/products`);
      const snapshot = await getDocs(productsRef);

      console.log('✅ Read test passed!');
      console.log('   📊 Documents found:', snapshot.docs.length);
      console.log('   💾 From cache:', snapshot.metadata.fromCache);

      if (snapshot.metadata.fromCache) {
        console.warn('⚠️ Data was from cache, not server!');
        results.error = 'Data from cache only - cannot reach server';
      } else {
        results.canRead = true;
      }
    } catch (error: any) {
      console.error('❌ Read test failed:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);

      if (error.code === 'permission-denied') {
        console.error('   🚨 PERMISSION DENIED: Firestore security rules are blocking reads!');
      }

      results.error = error;
    }

    // Test 2: Try to write a test document
    try {
      console.log('📝 Test 2: Attempting to write test document...');
      const testDocRef = doc(db, `businesses/${businessId}/diagnostics`, 'test');
      await setDoc(testDocRef, {
        timestamp: new Date().toISOString(),
        test: true,
      });

      console.log('✅ Write test passed!');
      results.canWrite = true;

      // Try to read it back
      const readBack = await getDoc(testDocRef);
      if (readBack.exists() && !readBack.metadata.fromCache) {
        console.log('✅ Write-then-read verified from server!');
      } else if (readBack.metadata.fromCache) {
        console.warn('⚠️ Write succeeded but read was from cache');
        results.error = 'Write may not have reached server';
      }
    } catch (error: any) {
      console.error('❌ Write test failed:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);

      if (error.code === 'permission-denied') {
        console.error('   🚨 PERMISSION DENIED: Firestore security rules are blocking writes!');
        console.error('');
        console.error('   TO FIX THIS:');
        console.error('   1. Go to: https://console.firebase.google.com/project/fyll-erp/firestore/rules');
        console.error('   2. Update your rules to allow authenticated users to write');
        console.error('   3. Example rule:');
        console.error('      match /businesses/{businessId}/{document=**} {');
        console.error('        allow read, write: if request.auth != null;');
        console.error('      }');
      }

      results.error = error;
    }

    console.log('');
    console.log('📊 Diagnostics Summary:');
    console.log('   Can read:', results.canRead);
    console.log('   Can write:', results.canWrite);
    console.log('   Error:', results.error?.code || 'none');

    return results;
  },
};
