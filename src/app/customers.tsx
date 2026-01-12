import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Search, User, Phone, Mail, MapPin, Edit2, Trash2, X, Check, ChevronDown } from 'lucide-react-native';
import useFyllStore, { Customer, NIGERIA_STATES } from '@/lib/state/fyll-store';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { CustomerDetailPanel } from '@/components/CustomerDetailPanel';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function CustomersScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { isMobile, isDesktop } = useBreakpoint();
  const showSplitView = !isMobile;

  const customers = useFyllStore((s) => s.customers);
  const addCustomer = useFyllStore((s) => s.addCustomer);
  const updateCustomer = useFyllStore((s) => s.updateCustomer);
  const deleteCustomer = useFyllStore((s) => s.deleteCustomer);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showStateModal, setShowStateModal] = useState(false);

  // Split view state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Get selected customer
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [defaultState, setDefaultState] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter((c) =>
      c.fullName.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.phone.includes(query)
    );
  }, [customers, searchQuery]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setDefaultAddress('');
    setDefaultState('');
    setEditingCustomer(null);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFullName(customer.fullName);
    setEmail(customer.email);
    setPhone(customer.phone);
    setDefaultAddress(customer.defaultAddress);
    setDefaultState(customer.defaultState);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter the customer name');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Required Field', 'Phone number is required');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        defaultAddress: defaultAddress.trim(),
        defaultState,
      });
    } else {
      const newCustomer: Customer = {
        id: Math.random().toString(36).substring(2, 15),
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        defaultAddress: defaultAddress.trim(),
        defaultState,
        createdAt: new Date().toISOString(),
      };
      addCustomer(newCustomer);
    }

    setShowAddModal(false);
    resetForm();
  };

  const handleDelete = (customer: Customer) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete "${customer.fullName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            deleteCustomer(customer.id);
            if (selectedCustomerId === customer.id) {
              setSelectedCustomerId(null);
            }
          },
        },
      ]
    );
  };

  const handleCustomerSelect = (customerId: string) => {
    if (showSplitView) {
      setSelectedCustomerId(customerId);
    }
  };

  const handleEditFromPanel = (customer: Customer) => {
    openEditModal(customer);
  };

  // Master pane content
  const masterContent = (
    <>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Customers</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            resetForm();
            setShowAddModal(true);
          }}
          className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
          style={{ backgroundColor: '#111111' }}
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-5 pt-4">
        <View
          className="flex-row items-center rounded-xl px-4"
          style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50 }}
        >
          <Search size={18} color={colors.input.placeholder} strokeWidth={2} />
          <TextInput
            placeholder="Search customers..."
            placeholderTextColor={colors.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
            selectionColor={colors.text.primary}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ maxWidth: isDesktop ? 600 : undefined, alignSelf: isDesktop && !selectedCustomerId ? 'center' : undefined }}
        showsVerticalScrollIndicator={false}
      >
        {filteredCustomers.length === 0 ? (
            <Animated.View entering={FadeInDown.springify()} className="items-center justify-center py-20">
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <User size={40} color={colors.text.muted} strokeWidth={1.5} />
              </View>
              <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No customers found</Text>
              <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first customer to get started</Text>
              <Pressable
                onPress={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="rounded-xl overflow-hidden active:opacity-80"
                style={{ backgroundColor: '#111111', paddingHorizontal: 24, paddingVertical: 14 }}
              >
                <Text className="text-white font-semibold">Add Customer</Text>
              </Pressable>
            </Animated.View>
          ) : (
            filteredCustomers.map((customer, index) => (
              <Animated.View
                key={customer.id}
                entering={FadeInRight.delay(index * 50).springify()}
                layout={Layout.springify()}
                className="mb-3"
              >
                <Pressable
                  onPress={() => handleCustomerSelect(customer.id)}
                  className="active:opacity-80"
                >
                  <View
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: selectedCustomerId === customer.id && showSplitView ? colors.bg.tertiary : colors.bg.card,
                      borderWidth: selectedCustomerId === customer.id && showSplitView ? 2 : 1,
                      borderColor: selectedCustomerId === customer.id && showSplitView ? colors.accent.primary : colors.border.light,
                      borderLeftWidth: selectedCustomerId === customer.id && showSplitView ? 3 : 1,
                      borderLeftColor: selectedCustomerId === customer.id && showSplitView ? colors.accent.primary : colors.border.light,
                    }}
                  >
                    <View className="flex-row items-start">
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                      >
                        <User size={24} color="#10B981" strokeWidth={1.5} />
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.text.primary }} className="font-bold text-base">{customer.fullName}</Text>
                        {customer.phone && (
                          <View className="flex-row items-center mt-1">
                            <Phone size={12} color={colors.text.tertiary} strokeWidth={2} />
                            <Text style={{ color: colors.text.tertiary }} className="text-xs ml-1">{customer.phone}</Text>
                          </View>
                        )}
                        {customer.email && (
                          <View className="flex-row items-center mt-1">
                            <Mail size={12} color={colors.text.tertiary} strokeWidth={2} />
                            <Text style={{ color: colors.text.tertiary }} className="text-xs ml-1">{customer.email}</Text>
                          </View>
                        )}
                        {customer.defaultState && (
                          <View className="flex-row items-center mt-1">
                            <MapPin size={12} color={colors.text.tertiary} strokeWidth={2} />
                            <Text style={{ color: colors.text.tertiary }} className="text-xs ml-1">{customer.defaultState}</Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-row">
                        <Pressable
                          onPress={() => openEditModal(customer)}
                          className="p-2 active:opacity-50"
                        >
                          <Edit2 size={16} color={colors.text.tertiary} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(customer)}
                          className="p-2 active:opacity-50"
                        >
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
          <View className="h-24" />
        </ScrollView>
      </>
    );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <SplitViewLayout
          detailContent={selectedCustomerId ? <CustomerDetailPanel customerId={selectedCustomerId} onEdit={handleEditFromPanel} onClose={() => setSelectedCustomerId(null)} /> : null}
          detailTitle={selectedCustomer?.fullName || 'Customer Details'}
          onCloseDetail={() => setSelectedCustomerId(null)}
        >
          {masterContent}
        </SplitViewLayout>
      </SafeAreaView>

      {/* Add/Edit Customer Modal */}
      <Modal
        visible={showAddModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onPress={() => {
              setShowAddModal(false);
              resetForm();
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-[90%] rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.bg.primary, maxWidth: 400, maxHeight: '80%' }}
            >
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
                <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                  {editingCustomer ? 'Edit Customer' : 'New Customer'}
                </Text>
                <Pressable
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <X size={18} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              </View>

              <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
                {/* Full Name */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Full Name *</Text>
                  <View
                    className="rounded-xl px-4"
                    style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}
                  >
                    <TextInput
                      placeholder="Enter customer name"
                      placeholderTextColor={colors.input.placeholder}
                      value={fullName}
                      onChangeText={setFullName}
                      style={{ color: colors.input.text, fontSize: 14 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Phone */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Phone Number *</Text>
                  <View
                    className="rounded-xl px-4"
                    style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}
                  >
                    <TextInput
                      placeholder="+234 xxx xxx xxxx"
                      placeholderTextColor={colors.input.placeholder}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      style={{ color: colors.input.text, fontSize: 14 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Email */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Email</Text>
                  <View
                    className="rounded-xl px-4"
                    style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50, justifyContent: 'center' }}
                  >
                    <TextInput
                      placeholder="email@example.com"
                      placeholderTextColor={colors.input.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={{ color: colors.input.text, fontSize: 14 }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Default State */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Default Delivery State</Text>
                  <Pressable
                    onPress={() => setShowStateModal(true)}
                    className="rounded-xl px-4 flex-row items-center justify-between"
                    style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, height: 50 }}
                  >
                    <Text style={{ color: defaultState ? colors.input.text : colors.input.placeholder }} className="text-sm">
                      {defaultState || 'Select state'}
                    </Text>
                    <ChevronDown size={20} color={colors.text.tertiary} strokeWidth={2} />
                  </Pressable>
                </View>

                {/* Default Address */}
                <View className="mb-4">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-medium mb-2">Default Delivery Address</Text>
                  <View
                    className="rounded-xl px-4 py-3"
                    style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, minHeight: 80 }}
                  >
                    <TextInput
                      placeholder="Enter full address"
                      placeholderTextColor={colors.input.placeholder}
                      value={defaultAddress}
                      onChangeText={setDefaultAddress}
                      multiline
                      numberOfLines={3}
                      style={{ color: colors.input.text, fontSize: 14, textAlignVertical: 'top' }}
                      selectionColor={colors.text.primary}
                    />
                  </View>
                </View>

                {/* Buttons */}
                <View className="flex-row gap-3 mb-4">
                  <Pressable
                    onPress={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 rounded-xl items-center"
                    style={{ backgroundColor: colors.bg.secondary, height: 50, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!fullName.trim()}
                    className="flex-1 rounded-xl items-center"
                    style={{ backgroundColor: '#111111', height: 50, justifyContent: 'center', opacity: fullName.trim() ? 1 : 0.5 }}
                  >
                    <Text className="text-white font-semibold">{editingCustomer ? 'Save' : 'Add Customer'}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* State Selection Modal */}
      <Modal
        visible={showStateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowStateModal(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowStateModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxHeight: '70%', maxWidth: 400 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Select State</Text>
              <Pressable
                onPress={() => setShowStateModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {NIGERIA_STATES.map((state) => (
                <Pressable
                  key={state}
                  onPress={() => {
                    setDefaultState(state);
                    setShowStateModal(false);
                    Haptics.selectionAsync();
                  }}
                  className="py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{ backgroundColor: defaultState === state ? colors.accent.primary + '15' : colors.bg.secondary }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: defaultState === state ? colors.text.primary : colors.text.tertiary }} className="text-base">
                      {state}
                    </Text>
                    {defaultState === state && <Check size={20} color={colors.text.primary} strokeWidth={2} />}
                  </View>
                </Pressable>
              ))}
              <View className="h-4" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
