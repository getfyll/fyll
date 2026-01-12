import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import useAuthStore from '@/lib/state/auth-store';

export default function FixAccountScreen() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const setBusinessId = (businessId: string) => {
    useAuthStore.setState({ businessId });
  };

  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fixed, setFixed] = useState(false);

  const handleFix = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter a business name');
      return;
    }

    setLoading(true);

    try {
      // Generate business ID from name
      const businessId = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        + '-' + Math.random().toString(36).substring(2, 8);

      const createdAt = new Date().toISOString();

      // Create business document
      await setDoc(doc(db, 'businesses', businessId), {
        id: businessId,
        name: businessName.trim(),
        ownerUid: currentUser.id,
        createdAt,
      });

      // Update user document with businessId
      await setDoc(
        doc(db, 'users', currentUser.id),
        {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          businessId,
          createdAt,
        },
        { merge: true }
      );

      // Create team member entry
      await setDoc(doc(db, `businesses/${businessId}/team`, currentUser.id), {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: 'admin',
        createdAt,
        lastLogin: createdAt,
      });

      // Update local state
      setBusinessId(businessId);
      useAuthStore.setState({
        currentUser: {
          ...currentUser,
          businessId,
        },
      });

      console.log('✅ Account fixed! Business ID:', businessId);
      setFixed(true);
      setLoading(false);

      Alert.alert(
        'Success!',
        `Your account has been fixed.\n\nBusiness ID: ${businessId}\n\nYou can now create products and they will sync across devices.`,
        [
          {
            text: 'Go to Inventory',
            onPress: () => router.replace('/(tabs)/inventory'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to fix account:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to fix account. Please try again or contact support.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
          >
            <ArrowLeft size={20} color="#000000" />
            <Text style={{ marginLeft: 8, fontSize: 16 }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000000' }}>
            Fix Your Account
          </Text>
        </View>

        <View style={{ flex: 1, padding: 20 }}>
          {!fixed ? (
            <>
              {/* Explanation */}
              <View style={{ padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12, marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 8 }}>
                  ⚠️ Account Issue Detected
                </Text>
                <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 20 }}>
                  Your account is missing a Business ID. This happened because Firestore timed out during signup.
                  {'\n\n'}
                  We need to create a business for you so your products can sync properly.
                </Text>
              </View>

              {/* Business Name Input */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 8 }}>
                Enter Your Business Name
              </Text>
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g., My Eyewear Store"
                style={{
                  backgroundColor: '#F5F5F5',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: '#000',
                  borderWidth: 1,
                  borderColor: '#E5E5E5',
                  marginBottom: 24,
                }}
                autoFocus
                editable={!loading}
              />

              {/* Fix Button */}
              <Pressable
                onPress={handleFix}
                disabled={loading || !businessName.trim()}
                style={{
                  backgroundColor: loading || !businessName.trim() ? '#D1D5DB' : '#10B981',
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                    Fix My Account
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <CheckCircle size={64} color="#10B981" strokeWidth={2} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#000', marginTop: 16 }}>
                Account Fixed!
              </Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
                Your account now has a business ID and products will sync properly.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
