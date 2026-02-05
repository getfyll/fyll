import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Upload, Search, X, Check, ChevronDown, ChevronRight, Filter, ArrowDownAZ, ArrowUpAZ, Clock, MapPin } from 'lucide-react-native';
import useFyllStore, { Customer, NIGERIA_STATES } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { useThemeColors } from '@/lib/theme';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { SplitViewLayout } from '@/components/SplitViewLayout';
import { CustomerDetailPanel } from '@/components/CustomerDetailPanel';
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
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showStateModal, setShowStateModal] = useState(false);
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState<Customer | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'state'>('name-asc');
  const isDark = colors.bg.primary === '#111111';

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
    let result = [...customers];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.fullName.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query)
      );
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.fullName.localeCompare(b.fullName);
        case 'name-desc':
          return b.fullName.localeCompare(a.fullName);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'state':
          return (a.defaultState || '').localeCompare(b.defaultState || '');
        default:
          return 0;
      }
    });
    return result;
  }, [customers, searchQuery, sortBy]);

  useEffect(() => {
    if (!showSplitView) return;
    if (selectedCustomerId && filteredCustomers.some((customer) => customer.id === selectedCustomerId)) return;
    if (filteredCustomers.length > 0) {
      setSelectedCustomerId(filteredCustomers[0].id);
    }
  }, [showSplitView, filteredCustomers, selectedCustomerId]);

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
      addCustomer(newCustomer, businessId);
    }

    setShowAddModal(false);
    resetForm();
  };

  const confirmDeleteCustomer = () => {
    if (!pendingDeleteCustomer) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteCustomer(pendingDeleteCustomer.id, businessId);
    if (selectedCustomerId === pendingDeleteCustomer.id) {
      setSelectedCustomerId(null);
    }
    setPendingDeleteCustomer(null);
  };

  const handleCustomerSelect = (customerId: string) => {
    if (showSplitView) {
      setSelectedCustomerId(customerId);
    } else {
      // On mobile, navigate to customer detail screen
      router.push(`/customer/${customerId}`);
    }
  };

  const handleEditFromPanel = (customer: Customer) => {
    openEditModal(customer);
  };

  // Master pane content
  const masterContent = (
    <>
      {/* Header + Search */}
      <View style={{ backgroundColor: colors.bg.primary, borderBottomWidth: 0.5, borderBottomColor: colors.border.light }}>
        <View className="px-5 pt-6 pb-3">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text style={{ color: colors.text.tertiary }} className="text-xs font-medium uppercase tracking-wider">Customers</Text>
              <Text style={{ color: colors.text.primary }} className="text-2xl font-bold">Customers</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => router.push('/import-customers')}
                className="rounded-full items-center justify-center active:opacity-80"
                style={{ paddingHorizontal: 14, height: 42, flexDirection: 'row', backgroundColor: colors.bg.secondary }}
              >
                <Upload size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={{ color: colors.text.primary }} className="font-semibold ml-1.5 text-sm">Import</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  resetForm();
                  setShowAddModal(true);
                }}
                className="rounded-full items-center justify-center active:opacity-80"
                style={{ paddingHorizontal: 14, height: 42, flexDirection: 'row', backgroundColor: colors.bg.secondary }}
              >
                <Plus size={18} color={colors.text.primary} strokeWidth={2.5} />
                <Text style={{ color: colors.text.primary }} className="font-semibold ml-1.5 text-sm">Add</Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <View
              className="flex-1 flex-row items-center rounded-full px-4"
              style={{ height: 52, backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border }}
            >
              <Search size={18} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                placeholder="Search customers..."
                placeholderTextColor={colors.input.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ flex: 1, marginLeft: 8, color: colors.input.text, fontSize: 14 }}
                selectionColor={colors.text.primary}
              />
            </View>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowFilterMenu(true);
              }}
              className="rounded-full items-center justify-center active:opacity-70 flex-row px-4"
              style={{
                height: 52,
                backgroundColor: sortBy !== 'name-asc' ? colors.accent.primary : colors.bg.secondary,
                borderWidth: sortBy !== 'name-asc' ? 0 : 0.5,
                borderColor: colors.border.light,
              }}
            >
              <Filter size={18} color={sortBy !== 'name-asc' ? (isDark ? '#000000' : '#FFFFFF') : colors.text.tertiary} strokeWidth={2} />
              {sortBy !== 'name-asc' && (
                <Text style={{ color: isDark ? '#000000' : '#FFFFFF' }} className="font-semibold text-sm ml-1.5">1</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: colors.bg.secondary }}
        contentContainerStyle={{ maxWidth: isDesktop ? 600 : undefined, alignSelf: isDesktop && !selectedCustomerId ? 'center' : undefined }}
        showsVerticalScrollIndicator={false}
      >
        {filteredCustomers.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Text style={{ color: colors.text.tertiary }} className="text-base mb-1">No customers found</Text>
            <Text style={{ color: colors.text.muted }} className="text-sm mb-4">Add your first customer to get started</Text>
            <Pressable
              onPress={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="rounded-full overflow-hidden active:opacity-80"
              style={{ backgroundColor: '#111111', paddingHorizontal: 24, paddingVertical: 14 }}
            >
              <Text className="text-white font-semibold">Add Customer</Text>
            </Pressable>
          </View>
        ) : (
          filteredCustomers.map((customer, index) => (
            <View
              key={customer.id}
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
                    borderWidth: 0.5,
                    borderColor: selectedCustomerId === customer.id && showSplitView ? colors.accent.primary + '60' : colors.border.light,
                    borderLeftWidth: selectedCustomerId === customer.id && showSplitView ? 2.5 : 0.5,
                    borderLeftColor: selectedCustomerId === customer.id && showSplitView ? colors.accent.primary : colors.border.light,
                  }}
                >
                  <View className="flex-row items-start">
                    <View className="flex-1">
                      <Text style={{ color: colors.text.primary }} className="font-bold text-base">{customer.fullName}</Text>
                      {customer.email && (
                        <Text style={{ color: colors.text.tertiary }} className="text-xs mt-1">{customer.email}</Text>
                      )}
                      {customer.defaultState && (
                        <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">{customer.defaultState}</Text>
                      )}
                    </View>
                    <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
                  </View>
                </View>
              </Pressable>
            </View>
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

      <Modal
        visible={!!pendingDeleteCustomer}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingDeleteCustomer(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setPendingDeleteCustomer(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxWidth: 360 }}
          >
            <View className="px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Delete Customer</Text>
              <Text style={{ color: colors.text.tertiary }} className="text-sm mt-1">
                {pendingDeleteCustomer?.fullName ? `Delete ${pendingDeleteCustomer.fullName}?` : 'Delete this customer?'}
              </Text>
            </View>
            <View className="px-5 py-4 flex-row gap-3">
              <Pressable
                onPress={() => setPendingDeleteCustomer(null)}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: colors.bg.secondary, height: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteCustomer}
                className="flex-1 rounded-full items-center"
                style={{ backgroundColor: '#EF4444', height: 48, justifyContent: 'center' }}
              >
                <Text className="text-white font-semibold">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                    className="flex-1 rounded-full items-center"
                    style={{ backgroundColor: colors.bg.secondary, height: 50, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text.tertiary }} className="font-medium">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!fullName.trim()}
                    className="flex-1 rounded-full items-center"
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

      {/* Sort Modal */}
      <Modal
        visible={showFilterMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <Pressable
          className="flex-1 items-center justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowFilterMenu(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl overflow-hidden"
            style={{ backgroundColor: colors.bg.primary, maxHeight: '60%' }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border.light }} />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-4" style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Sort</Text>
              <Pressable
                onPress={() => setShowFilterMenu(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="px-5 pt-4 pb-2">
                <Text style={{ color: colors.text.muted }} className="text-xs font-semibold uppercase tracking-wider mb-3">Sort By</Text>
                {([
                  { key: 'name-asc' as const, label: 'Name (A-Z)', icon: <ArrowDownAZ size={18} strokeWidth={2} /> },
                  { key: 'name-desc' as const, label: 'Name (Z-A)', icon: <ArrowUpAZ size={18} strokeWidth={2} /> },
                  { key: 'newest' as const, label: 'Newest First', icon: <Clock size={18} strokeWidth={2} /> },
                  { key: 'oldest' as const, label: 'Oldest First', icon: <Clock size={18} strokeWidth={2} /> },
                  { key: 'state' as const, label: 'State', icon: <MapPin size={18} strokeWidth={2} /> },
                ]).map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSortBy(option.key);
                    }}
                    className="flex-row items-center py-3 active:opacity-70"
                  >
                    {React.cloneElement(option.icon, { color: sortBy === option.key ? colors.accent.primary : colors.text.muted })}
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{option.label}</Text>
                    </View>
                    {sortBy === option.key && (
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: colors.accent.primary }}>
                        <Check size={12} color={isDark ? '#000000' : '#FFFFFF'} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
              <View className="px-5 py-4">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowFilterMenu(false);
                  }}
                  className="rounded-full items-center justify-center active:opacity-80"
                  style={{ height: 50, backgroundColor: '#111111' }}
                >
                  <Text style={{ color: '#FFFFFF' }} className="font-semibold">Done</Text>
                </Pressable>
              </View>
              <View className="h-8" />
            </ScrollView>
          </Pressable>
        </Pressable>
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
                  className="py-3 px-4 rounded-full mb-2 active:opacity-70"
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
