import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DebugEnvScreen() {
  const envVars = {
    'EXPO_PUBLIC_FIREBASE_API_KEY': process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID': process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    'EXPO_PUBLIC_FIREBASE_APP_ID': process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID': process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
            Environment Variables Debug
          </Text>

          {Object.entries(envVars).map(([key, value]) => (
            <View key={key} style={{ marginBottom: 16, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4 }}>
                {key}
              </Text>
              <Text style={{ fontSize: 14, color: value ? '#000' : '#EF4444', fontFamily: 'monospace' }}>
                {value || '❌ MISSING'}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: 20, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 8 }}>
            <Text style={{ fontSize: 14, color: '#92400E' }}>
              ⚠️ If any values show as MISSING, you need to add them to your Vercel project's environment variables.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
