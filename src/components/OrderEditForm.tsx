import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Modal, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Minus, Trash2, ChevronDown, Check, Search, Package, MapPin, User, Users, Calendar, ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import useFyllStore, { OrderItem, OrderService, formatCurrency, NIGERIA_STATES, Customer } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, StickyButtonContainer } from '@/components/Button';

interface SearchResult {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  stock: number;
  price: number;
}

interface OrderEditFormProps {
  orderId: string;
  showHeader?: boolean;
  onClose?: () => void;
}

export function OrderEditForm({ orderId, showHeader = true, onClose }: OrderEditFormProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const products = useFyllStore((s) => s.products);
  const saleSources = useFyllStore((s) => s.saleSources);
  const customServices = useFyllStore((s) => s.customServices);
  const paymentMethods = useFyllStore((s) => s.paymentMethods);
  const customers = useFyllStore((s) => s.customers);
  const orders = useFyllStore((s) => s.orders);
  const updateOrder = useFyllStore((s) => s.updateOrder);
  const addCustomer = useFyllStore((s) => s.addCustomer);
  const updateVariantStock = useFyllStore((s) => s.updateVariantStock);
  const currentUser = useAuthStore((s) => s.currentUser);
  const businessId = useAuthStore((s) => s.businessId ?? s.currentUser?.businessId ?? null);
  const [isInitialized, setIsInitialized] = useState(false);
  const originalItemsRef = useRef<OrderItem[]>([]);
  const order = useMemo(() => orders.find((entry) => entry.id === orderId), [orders, orderId]);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  };

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitGuard = useRef(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
  }, []);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showStateModal, setShowStateModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Order details
  const [source, setSource] = useState(saleSources[0]?.name || '');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]?.name || '');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [services, setServices] = useState<OrderService[]>([]);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [servicePriceInput, setServicePriceInput] = useState('');
  const [showServicePriceModal, setShowServicePriceModal] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState('');
  const [additionalChargesNote, setAdditionalChargesNote] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [websiteOrderRef, setWebsiteOrderRef] = useState('');

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Order Date state
  const [orderDateType, setOrderDateType] = useState<'today' | 'another'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date()); // For calendar navigation

  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  useEffect(() => {
    if (!order || isInitialized) return;

    const resolvedDate = new Date(order.orderDate || order.createdAt);
    const isToday = isSameDay(resolvedDate, new Date());

    setCustomerName(order.customerName ?? '');
    setCustomerEmail(order.customerEmail ?? '');
    setCustomerPhone(order.customerPhone ?? '');
    setDeliveryState(order.deliveryState ?? '');
    setDeliveryAddress(order.deliveryAddress ?? '');
    setSelectedCustomerId(order.customerId ?? null);
    setSource(order.source || saleSources[0]?.name || '');
    setPaymentMethod(order.paymentMethod || paymentMethods[0]?.name || '');
    setItems(order.items ?? []);
    setServices(order.services ?? []);
    setDeliveryFee(String(order.deliveryFee ?? 0));
    setAdditionalCharges(String(order.additionalCharges ?? 0));
    setAdditionalChargesNote(order.additionalChargesNote ?? '');
    setDiscountCode(order.discountCode ?? '');
    setDiscountAmount(order.discountAmount != null ? String(order.discountAmount) : '');
    setWebsiteOrderRef(order.websiteOrderReference ?? '');
    setOrderDateType(isToday ? 'today' : 'another');
    setSelectedDate(resolvedDate);
    setCalendarViewDate(resolvedDate);

    originalItemsRef.current = order.items ?? [];
    setIsInitialized(true);
  }, [order, isInitialized, paymentMethods, saleSources]);

  // Search results - searches both product names and variant values
  // Excludes discontinued products
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    const results: SearchResult[] = [];
    products
      .filter((product) => !product.isDiscontinued) // Exclude discontinued products
      .forEach((product) => {
        product.variants.forEach((variant) => {
          const variantName = Object.values(variant.variableValues).join(' ');
          const matchesProduct = product.name.toLowerCase().includes(query);
          const matchesVariant = variantName.toLowerCase().includes(query);

          if (matchesProduct || matchesVariant) {
            results.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName,
              stock: variant.stock,
              price: variant.sellingPrice,
            });
          }
        });
      });
    return results;
  }, [searchQuery, products]);

  // Customer search results
  const customerSearchResults = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 5);
    const query = customerSearchQuery.toLowerCase();
    return customers.filter((c) =>
      c.fullName.toLowerCase().includes(query) ||
      c.phone.includes(query) ||
      c.email.toLowerCase().includes(query)
    );
  }, [customerSearchQuery, customers]);

  // Select existing customer to auto-fill
  const handleSelectCustomer = (customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.fullName);
    setCustomerEmail(customer.email);
    setCustomerPhone(customer.phone);
    setDeliveryState(customer.defaultState);
    setDeliveryAddress(customer.defaultAddress);
    setShowCustomerSearch(false);
    setCustomerSearchQuery('');
  };

  // Clear customer selection
  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setDeliveryState('');
    setDeliveryAddress('');
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [items]);

  const servicesTotal = useMemo(() => {
    return services.reduce((sum, s) => sum + s.price, 0);
  }, [services]);

  const deliveryFeeNum = parseFloat(deliveryFee) || 0;
  const additionalChargesNum = parseFloat(additionalCharges) || 0;
  const discountAmountNum = parseFloat(discountAmount) || 0;

  const totalAmount = subtotal + servicesTotal + deliveryFeeNum + additionalChargesNum - discountAmountNum;

  const handleAddProduct = (result: SearchResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existingIndex = items.findIndex(
      (item) => item.productId === result.productId && item.variantId === result.variantId
    );

    if (existingIndex >= 0) {
      // Increment quantity if already exists
      handleUpdateQuantity(existingIndex, 1);
    } else {
      setItems([...items, {
        productId: result.productId,
        variantId: result.variantId,
        quantity: 1,
        unitPrice: result.price
      }]);
    }
    setSearchQuery('');
    setShowProductSearch(false);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const newItems = [...items];
    const newQty = newItems[index].quantity + delta;

    if (newQty <= 0) {
      newItems.splice(index, 1);
    } else {
      const product = products.find((p) => p.id === newItems[index].productId);
      const variant = product?.variants.find((v) => v.id === newItems[index].variantId);
      if (variant && newQty <= variant.stock) {
        newItems[index].quantity = newQty;
      }
    }

    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddService = (serviceId: string) => {
    const service = customServices.find((s) => s.id === serviceId);
    if (!service) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextServices = [...services, {
      serviceId: service.id,
      name: service.name,
      price: service.defaultPrice
    }];
    setServices(nextServices);
    setShowServiceModal(false);

    if (service.defaultPrice === 0) {
      setEditingServiceIndex(nextServices.length - 1);
      setServicePriceInput('');
      setShowServicePriceModal(true);
    }
  };

  const handleRemoveService = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setServices(services.filter((_, i) => i !== index));
  };

  const openEditServicePrice = (index: number) => {
    const current = services[index];
    if (!current) return;
    setEditingServiceIndex(index);
    setServicePriceInput(current.price ? current.price.toString() : '');
    setShowServicePriceModal(true);
  };

  const confirmEditServicePrice = () => {
    if (editingServiceIndex === null) return;
    const parsed = parseFloat(servicePriceInput);
    const nextPrice = Number.isFinite(parsed) ? parsed : 0;
    setServices(services.map((service, index) =>
      index === editingServiceIndex ? { ...service, price: nextPrice } : service
    ));
    setEditingServiceIndex(null);
    setServicePriceInput('');
    setShowServicePriceModal(false);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSubmit = async () => {
    if (!order || !customerName.trim() || items.length === 0 || isSubmitting || submitGuard.current) return;

    submitGuard.current = true;
    setIsSubmitting(true);

    try {
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      let resolvedCustomerId = selectedCustomerId ?? order.customerId ?? undefined;

      if (!resolvedCustomerId && customerName.trim()) {
        const normalizedEmail = customerEmail.trim().toLowerCase();
        const normalizedPhone = customerPhone.trim();
        const normalizedName = customerName.trim().toLowerCase();

        const existingCustomer = customers.find((customer) =>
          (normalizedEmail && customer.email.toLowerCase() === normalizedEmail) ||
          (normalizedPhone && customer.phone === normalizedPhone) ||
          customer.fullName.toLowerCase() === normalizedName
        );

        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          const newCustomerId = Math.random().toString(36).substring(2, 15);
          const newCustomer: Customer = {
            id: newCustomerId,
            fullName: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim(),
            defaultState: deliveryState,
            defaultAddress: deliveryAddress.trim(),
            createdAt: new Date().toISOString(),
          };
          await addCustomer(newCustomer, businessId);
          resolvedCustomerId = newCustomerId;
        }
      }

      // Compute the order date - use today or selected date
      const orderDateValue = orderDateType === 'today' ? new Date() : selectedDate;

      // Restore stock from the original order items
      originalItemsRef.current.forEach((item) => {
        updateVariantStock(item.productId, item.variantId, item.quantity);
      });

      // Deduct stock for the updated items
      items.forEach((item) => {
        updateVariantStock(item.productId, item.variantId, -item.quantity);
      });

      await updateOrder(order.id, {
        websiteOrderReference: websiteOrderRef.trim() || undefined,
        customerId: resolvedCustomerId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        deliveryState,
        deliveryAddress: deliveryAddress.trim(),
        items,
        services,
        additionalCharges: additionalChargesNum,
        additionalChargesNote: additionalChargesNote.trim(),
        deliveryFee: deliveryFeeNum,
        discountCode: discountCode.trim() || undefined,
        discountAmount: discountAmountNum || undefined,
        paymentMethod,
        source,
        subtotal,
        totalAmount,
        orderDate: orderDateValue.toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name,
      }, businessId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      showToast('success', 'Order updated successfully.');
      setTimeout(handleClose, 900);
    } catch (error) {
      console.warn('Order save failed:', error);
      showToast('error', 'Could not save this order. Please try again.');
    } finally {
      submitGuard.current = false;
      setIsSubmitting(false);
    }
  };

  const getItemDetails = (item: OrderItem) => {
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = variant ? Object.values(variant.variableValues).join(' / ') : '';
    return { productName: product?.name || 'Unknown', variantName, stock: variant?.stock || 0 };
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-lg font-semibold text-gray-900">Order not found</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          This order may have been deleted or is no longer available.
        </Text>
        <Pressable
          onPress={handleClose}
          className="mt-5 rounded-xl border border-gray-200 px-4 py-2 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-gray-700">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {showHeader && (
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
            <Pressable
              onPress={handleClose}
              className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50 bg-gray-100"
            >
              <X size={24} color="#111111" strokeWidth={2} />
            </Pressable>
            <Text className="text-lg font-bold text-gray-900">Edit Order</Text>
            <View className="w-10 h-10" />
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Customer Info Section */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 font-bold text-base">Customer Information</Text>
              {customers.length > 0 && (
                <Pressable
                  onPress={() => setShowCustomerSearch(!showCustomerSearch)}
                  className="bg-blue-50 px-3 py-2 rounded-xl flex-row items-center active:opacity-70"
                >
                  <Users size={16} color="#2563EB" strokeWidth={2} />
                  <Text className="text-blue-700 font-semibold text-sm ml-1">
                    {selectedCustomerId ? 'Change' : 'Search'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Customer Search */}
            {showCustomerSearch && (
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-50 rounded-xl px-3 border border-gray-200">
                  <Search size={18} color="#9CA3AF" strokeWidth={2} />
                  <TextInput
                    placeholder="Search by name, phone, or email..."
                    placeholderTextColor="#9CA3AF"
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                    autoFocus
                    className="flex-1 py-3 px-2 text-gray-900"
                  />
                </View>
                {customerSearchResults.length > 0 && (
                  <View className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {customerSearchResults.slice(0, 5).map((customer) => (
                      <Pressable
                        key={customer.id}
                        onPress={() => handleSelectCustomer(customer)}
                        className="flex-row items-center p-3 border-b border-gray-200 active:bg-gray-100"
                      >
                        <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
                          <User size={18} color="#059669" strokeWidth={2} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-900 font-semibold text-sm">{customer.fullName}</Text>
                          <Text className="text-gray-500 text-xs">
                            {customer.phone || customer.email || 'No contact info'}
                          </Text>
                        </View>
                        {selectedCustomerId === customer.id && (
                          <Check size={18} color="#059669" strokeWidth={2} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
                {customerSearchResults.length === 0 && customerSearchQuery.trim() && (
                  <View className="mt-2 p-4 rounded-xl bg-gray-50 items-center">
                    <Text className="text-gray-500 text-sm">No customers found</Text>
                  </View>
                )}
              </View>
            )}

            {/* Selected Customer Indicator */}
            {selectedCustomerId && (
              <View className="flex-row items-center justify-between mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <View className="flex-row items-center">
                  <Check size={16} color="#059669" strokeWidth={2} />
                  <Text className="text-emerald-700 font-medium text-sm ml-2">Existing customer selected</Text>
                </View>
                <Pressable onPress={handleClearCustomer} className="active:opacity-50">
                  <X size={18} color="#059669" strokeWidth={2} />
                </Pressable>
              </View>
            )}

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Full Name *</Text>
              <TextInput
                placeholder="Enter customer name"
                placeholderTextColor="#9CA3AF"
                value={customerName}
                onChangeText={setCustomerName}
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Phone Number</Text>
              <TextInput
                placeholder="+234 xxx xxx xxxx"
                placeholderTextColor="#9CA3AF"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Email</Text>
              <TextInput
                placeholder="email@example.com"
                placeholderTextColor="#9CA3AF"
                value={customerEmail}
                onChangeText={setCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Delivery State</Text>
              <Pressable
                onPress={() => setShowStateModal(true)}
                className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center justify-between border border-gray-200"
              >
                <Text className={deliveryState ? 'text-gray-900 text-base' : 'text-gray-400 text-base'}>
                  {deliveryState || 'Select state'}
                </Text>
                <ChevronDown size={20} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Delivery Address</Text>
              <TextInput
                placeholder="Enter full delivery address"
                placeholderTextColor="#9CA3AF"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline
                numberOfLines={3}
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Website Order Ref (WooCommerce)</Text>
              <TextInput
                placeholder="e.g. WC #10234 (optional)"
                placeholderTextColor="#9CA3AF"
                value={websiteOrderRef}
                onChangeText={setWebsiteOrderRef}
                className="bg-gray-50 rounded-xl px-4 h-[52px] text-gray-900 text-base border border-gray-200"
              />
            </View>

          </View>

          {/* Products Section */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 font-bold text-base">Products *</Text>
              <Pressable
                onPress={() => setShowProductSearch(!showProductSearch)}
                className="bg-emerald-50 px-3 py-2 rounded-xl flex-row items-center active:opacity-70"
              >
                <Plus size={16} color="#059669" strokeWidth={2} />
                <Text className="text-emerald-700 font-semibold text-sm ml-1">Add</Text>
              </Pressable>
            </View>

            {/* Product Search */}
            {showProductSearch && (
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-50 rounded-xl px-3 border border-gray-200">
                  <Search size={18} color="#9CA3AF" strokeWidth={2} />
                  <TextInput
                    placeholder="Search products or variants (e.g., Black, Gold)"
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    className="flex-1 py-3 px-2 text-gray-900 text-base"
                  />
                </View>

                {searchResults.length > 0 && (
                  <View className="mt-2 bg-white rounded-xl border border-gray-200 max-h-60">
                    <ScrollView nestedScrollEnabled>
                      {searchResults.map((result) => {
                        const isSelected = items.some(
                          (item) => item.productId === result.productId && item.variantId === result.variantId
                        );
                        return (
                          <Pressable
                            key={`${result.productId}-${result.variantId}`}
                            onPress={() => handleAddProduct(result)}
                            className={cn(
                              'flex-row items-center p-3 border-b border-gray-100',
                              isSelected ? 'bg-emerald-50' : 'active:bg-gray-50'
                            )}
                          >
                            <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center mr-3">
                              <Package size={18} color="#6B7280" strokeWidth={2} />
                            </View>
                            <View className="flex-1">
                              <Text className="text-gray-900 font-semibold text-sm">
                                {result.productName} - {result.variantName}
                              </Text>
                              <Text className={cn(
                                'text-xs',
                                result.stock > 0 ? 'text-emerald-600' : 'text-red-500'
                              )}>
                                {result.stock > 0 ? `${result.stock} in stock` : 'Out of stock'}
                              </Text>
                            </View>
                            <Text className="text-gray-900 font-bold text-sm">{formatCurrency(result.price)}</Text>
                            {isSelected && <Check size={18} color="#059669" strokeWidth={2} style={{ marginLeft: 8 }} />}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Selected Items */}
            {items.length > 0 ? (
              <View>
                {items.map((item, index) => {
                  const { productName, variantName, stock } = getItemDetails(item);
                  return (
                    <View
                      key={`${item.productId}-${item.variantId}`}
                      className="flex-row items-center py-3 border-b border-gray-100"
                    >
                      <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center mr-3">
                        <Package size={18} color="#6B7280" strokeWidth={2} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-900 font-semibold text-sm">{productName}</Text>
                        <Text className="text-gray-500 text-xs">{variantName} • {stock} in stock</Text>
                      </View>

                      <View className="flex-row items-center bg-gray-100 rounded-lg mr-3">
                        <Pressable
                          onPress={() => handleUpdateQuantity(index, -1)}
                          className="p-2 active:opacity-50"
                        >
                          <Minus size={14} color="#374151" strokeWidth={2} />
                        </Pressable>
                        <Text className="text-gray-900 font-bold text-sm w-8 text-center">{item.quantity}</Text>
                        <Pressable
                          onPress={() => handleUpdateQuantity(index, 1)}
                          className="p-2 active:opacity-50"
                        >
                          <Plus size={14} color="#374151" strokeWidth={2} />
                        </Pressable>
                      </View>

                      <Text className="text-gray-900 font-bold text-sm w-24 text-right">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </Text>

                      <Pressable onPress={() => handleRemoveItem(index)} className="ml-2 p-1 active:opacity-50">
                        <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="py-8 items-center">
                <Package size={32} color="#D1D5DB" strokeWidth={1.5} />
                <Text className="text-gray-400 text-sm mt-2">No products added yet</Text>
              </View>
            )}
          </View>

          {/* Services Section */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 font-bold text-base">Services</Text>
              <Pressable
                onPress={() => setShowServiceModal(true)}
                className="bg-blue-50 px-3 py-2 rounded-xl flex-row items-center active:opacity-70"
              >
                <Plus size={16} color="#2563EB" strokeWidth={2} />
                <Text className="text-blue-700 font-semibold text-sm ml-1">Add Service</Text>
              </Pressable>
            </View>

            {services.length > 0 ? (
              services.map((service, index) => (
                <View key={`${service.serviceId}-${index}`} className="flex-row items-center py-3 border-b border-gray-100">
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium text-sm">{service.name}</Text>
                  </View>
                  <Text className="text-gray-900 font-bold text-sm mr-2">{formatCurrency(service.price)}</Text>
                  <Pressable
                    onPress={() => openEditServicePrice(index)}
                    className="px-2 py-1 rounded-lg mr-2 active:opacity-70"
                    style={{ backgroundColor: service.price > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(234, 179, 8, 0.12)' }}
                  >
                    <View className="flex-row items-center">
                      <Pencil size={14} color={service.price > 0 ? '#3B82F6' : '#CA8A04'} strokeWidth={2} />
                      <Text className="text-xs font-semibold ml-1" style={{ color: service.price > 0 ? '#3B82F6' : '#CA8A04' }}>
                        {service.price > 0 ? 'Edit' : 'Set'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleRemoveService(index)} className="p-1 active:opacity-50">
                    <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Text className="text-gray-400 text-sm text-center py-4">No services added</Text>
            )}
          </View>

          {/* Fees & Charges Section */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
            <Text className="text-gray-900 font-bold text-base mb-4">Fees & Charges</Text>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Delivery Fee</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={deliveryFee}
                onChangeText={setDeliveryFee}
                keyboardType="numeric"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Additional Charges</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={additionalCharges}
                onChangeText={setAdditionalCharges}
                keyboardType="numeric"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            {additionalChargesNum > 0 && (
              <View className="mb-4">
                <Text className="text-gray-600 text-sm font-medium mb-2">Additional Charges Note</Text>
                <TextInput
                  placeholder="Describe the additional charges"
                  placeholderTextColor="#9CA3AF"
                  value={additionalChargesNote}
                  onChangeText={setAdditionalChargesNote}
                  className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
                />
              </View>
            )}

            {/* Discount Code Section */}
            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Discount Code</Text>
              <TextInput
                placeholder="Enter discount code (optional)"
                placeholderTextColor="#9CA3AF"
                value={discountCode}
                onChangeText={setDiscountCode}
                autoCapitalize="characters"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>

            <View>
              <Text className="text-gray-600 text-sm font-medium mb-2">Discount Amount</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={discountAmount}
                onChangeText={setDiscountAmount}
                keyboardType="numeric"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
            </View>
          </View>

          {/* Order Details Section */}
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4">
            <Text className="text-gray-900 font-bold text-base mb-4">Order Details</Text>

            {/* Order Date */}
            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Order Date</Text>
              <View className="flex-row rounded-xl overflow-hidden border border-gray-200">
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setOrderDateType('today');
                  }}
                  className={cn(
                    'flex-1 py-3 items-center justify-center',
                    orderDateType === 'today' ? 'bg-gray-900' : 'bg-gray-50'
                  )}
                >
                  <Text className={cn(
                    'font-semibold text-sm',
                    orderDateType === 'today' ? 'text-white' : 'text-gray-600'
                  )}>
                    Today
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setOrderDateType('another');
                    setShowDatePicker(true);
                  }}
                  className={cn(
                    'flex-1 py-3 items-center justify-center',
                    orderDateType === 'another' ? 'bg-gray-900' : 'bg-gray-50'
                  )}
                >
                  <Text className={cn(
                    'font-semibold text-sm',
                    orderDateType === 'another' ? 'text-white' : 'text-gray-600'
                  )}>
                    Another Day
                  </Text>
                </Pressable>
              </View>

              {/* Date Display for "Another Day" */}
              {orderDateType === 'another' && (
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="mt-3 bg-gray-50 rounded-xl px-4 py-3 flex-row items-center justify-between border border-gray-200 active:opacity-70"
                >
                  <View className="flex-row items-center">
                    <Calendar size={18} color="#6B7280" strokeWidth={2} />
                    <Text className="text-gray-900 text-base ml-2">
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <ChevronDown size={20} color="#6B7280" strokeWidth={2} />
                </Pressable>
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Sales Source</Text>
              <Pressable
                onPress={() => setShowSourceModal(true)}
                className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center justify-between border border-gray-200"
              >
                <Text className="text-gray-900 text-base">{source}</Text>
                <ChevronDown size={20} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>

            <View>
              <Text className="text-gray-600 text-sm font-medium mb-2">Payment Method</Text>
              <Pressable
                onPress={() => setShowPaymentModal(true)}
                className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center justify-between border border-gray-200"
              >
                <Text className="text-gray-900 text-base">{paymentMethod}</Text>
                <ChevronDown size={20} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Order Summary */}
          <View className="mx-4 mt-4 mb-8 rounded-2xl p-4" style={{ backgroundColor: '#111111' }}>
            <Text className="text-white font-bold text-base mb-3">Order Summary</Text>

            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-400 text-sm">Products Subtotal</Text>
              <Text className="text-white font-semibold">{formatCurrency(subtotal)}</Text>
            </View>

            {servicesTotal > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-400 text-sm">Services</Text>
                <Text className="text-white font-semibold">{formatCurrency(servicesTotal)}</Text>
              </View>
            )}

            {deliveryFeeNum > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-400 text-sm">Delivery Fee</Text>
                <Text className="text-white font-semibold">{formatCurrency(deliveryFeeNum)}</Text>
              </View>
            )}

            {additionalChargesNum > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-400 text-sm">Additional Charges</Text>
                <Text className="text-white font-semibold">{formatCurrency(additionalChargesNum)}</Text>
              </View>
            )}

            {discountAmountNum > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-400 text-sm">Discount{discountCode ? ` (${discountCode})` : ''}</Text>
                <Text className="text-emerald-400 font-semibold">-{formatCurrency(discountAmountNum)}</Text>
              </View>
            )}

            <View className="mt-2 pt-3 flex-row justify-between" style={{ borderTopWidth: 1, borderTopColor: '#333333' }}>
              <Text className="text-white font-bold text-lg">Total</Text>
              <Text className="text-white font-bold text-2xl">{formatCurrency(totalAmount)}</Text>
            </View>
          </View>

          {/* Bottom padding for sticky CTA */}
          <View className="h-32" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* State Selection Modal - Centered */}
      <Modal visible={showStateModal} animationType="fade" transparent onRequestClose={() => setShowStateModal(false)}>
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowStateModal(false)}
          />
          <View
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#111111', maxHeight: '70%', maxWidth: 400 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#333333' }}>
              <Text className="text-white font-bold text-lg">Select State</Text>
              <Pressable
                onPress={() => setShowStateModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#222222' }}
              >
                <X size={18} color="#888888" strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={true}
              overScrollMode="always"
            >
              {NIGERIA_STATES.map((state) => (
                <Pressable
                  key={state}
                  onPress={() => {
                    setDeliveryState(state);
                    setShowStateModal(false);
                    Haptics.selectionAsync();
                  }}
                  className="py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{ backgroundColor: deliveryState === state ? 'rgba(255,255,255,0.1)' : '#1A1A1A' }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={cn(
                      'text-base',
                      deliveryState === state ? 'text-white font-semibold' : 'text-gray-400'
                    )}>
                      {state}
                    </Text>
                    {deliveryState === state && <Check size={20} color="#FFFFFF" strokeWidth={2} />}
                  </View>
                </Pressable>
              ))}
              <View className="h-4" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Selection Modal - Centered */}
      <Modal visible={showServiceModal} animationType="fade" transparent onRequestClose={() => setShowServiceModal(false)}>
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowServiceModal(false)}
          />
          <View
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#111111', maxWidth: 400, maxHeight: '70%' }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#333333' }}>
              <Text className="text-white font-bold text-lg">Add Service</Text>
              <Pressable
                onPress={() => setShowServiceModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#222222' }}
              >
                <X size={18} color="#888888" strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              {customServices.map((service) => (
                <Pressable
                  key={service.id}
                  onPress={() => handleAddService(service.id)}
                  className="flex-row items-center justify-between py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{ backgroundColor: '#1A1A1A' }}
                >
                  <Text className="text-white font-medium text-base">{service.name}</Text>
                  <Text className="text-green-400 font-bold">{formatCurrency(service.defaultPrice)}</Text>
                </Pressable>
              ))}
              <View className="h-4" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Price Modal */}
      <Modal visible={showServicePriceModal} animationType="fade" transparent onRequestClose={() => setShowServicePriceModal(false)}>
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowServicePriceModal(false)}
          />
          <View
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#FFFFFF', maxWidth: 420 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#E5E7EB' }}>
              <Text className="text-gray-900 font-bold text-lg">Set Service Price</Text>
              <Pressable
                onPress={() => setShowServicePriceModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#F3F4F6' }}
              >
                <X size={18} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>
            <View className="px-5 py-4">
              <Text className="text-gray-600 text-sm font-medium mb-2">Service Fee</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={servicePriceInput}
                onChangeText={setServicePriceInput}
                keyboardType="numeric"
                className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-base border border-gray-200"
              />
              <View className="flex-row gap-3 mt-4">
                <Pressable
                  onPress={() => setShowServicePriceModal(false)}
                  className="flex-1 rounded-xl items-center justify-center"
                  style={{ height: 48, backgroundColor: '#F3F4F6' }}
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmEditServicePrice}
                  className="flex-1 rounded-xl items-center justify-center"
                  style={{ height: 48, backgroundColor: '#111111' }}
                >
                  <Text className="text-white font-semibold">Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Source Selection Modal - Centered */}
      <Modal visible={showSourceModal} animationType="fade" transparent onRequestClose={() => setShowSourceModal(false)}>
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowSourceModal(false)}
          />
          <View
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#111111', maxWidth: 400, maxHeight: '70%' }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#333333' }}>
              <Text className="text-white font-bold text-lg">Sales Source</Text>
              <Pressable
                onPress={() => setShowSourceModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#222222' }}
              >
                <X size={18} color="#888888" strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              {saleSources.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSource(s.name);
                    setShowSourceModal(false);
                    Haptics.selectionAsync();
                  }}
                  className="py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{ backgroundColor: source === s.name ? 'rgba(255,255,255,0.1)' : '#1A1A1A' }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={cn(
                      'text-base',
                      source === s.name ? 'text-white font-semibold' : 'text-gray-400'
                    )}>
                      {s.name}
                    </Text>
                    {source === s.name && <Check size={20} color="#FFFFFF" strokeWidth={2} />}
                  </View>
                </Pressable>
              ))}
              <View className="h-4" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal - Centered */}
      <Modal visible={showPaymentModal} animationType="fade" transparent onRequestClose={() => setShowPaymentModal(false)}>
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowPaymentModal(false)}
          />
          <View
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#111111', maxWidth: 400, maxHeight: '70%' }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: '#333333' }}>
              <Text className="text-white font-bold text-lg">Payment Method</Text>
              <Pressable
                onPress={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: '#222222' }}
              >
                <X size={18} color="#888888" strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={true}
            >
              {paymentMethods.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setPaymentMethod(m.name);
                    setShowPaymentModal(false);
                    Haptics.selectionAsync();
                  }}
                  className="py-3 px-4 rounded-xl mb-2 active:opacity-70"
                  style={{ backgroundColor: paymentMethod === m.name ? 'rgba(255,255,255,0.1)' : '#1A1A1A' }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={cn(
                      'text-base',
                      paymentMethod === m.name ? 'text-white font-semibold' : 'text-gray-400'
                    )}>
                      {m.name}
                    </Text>
                    {paymentMethod === m.name && <Check size={20} color="#FFFFFF" strokeWidth={2} />}
                  </View>
                </Pressable>
              ))}
              <View className="h-4" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal - Works on iOS/Android/Web */}
      <Modal
        visible={showDatePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#FFFFFF', maxWidth: 400 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200">
              <Text className="text-gray-900 font-bold text-lg">Select Date</Text>
              <Pressable
                onPress={() => setShowDatePicker(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
              >
                <X size={18} color="#666666" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Calendar View for all platforms */}
            <View className="p-4">
              {/* Month/Year Navigation */}
              <View className="flex-row items-center justify-between mb-4">
                <Pressable
                  onPress={() => {
                    const newDate = new Date(calendarViewDate);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setCalendarViewDate(newDate);
                  }}
                  className="w-10 h-10 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                >
                  <ChevronLeft size={20} color="#111111" strokeWidth={2} />
                </Pressable>
                <Text className="text-gray-900 font-bold text-base">
                  {calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable
                  onPress={() => {
                    const newDate = new Date(calendarViewDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    // Don't allow going past current month
                    if (newDate <= new Date()) {
                      setCalendarViewDate(newDate);
                    }
                  }}
                  className="w-10 h-10 rounded-full items-center justify-center active:opacity-50 bg-gray-100"
                >
                  <ChevronRight size={20} color="#111111" strokeWidth={2} />
                </Pressable>
              </View>

              {/* Day Labels */}
              <View className="flex-row mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <View key={day} className="flex-1 items-center py-2">
                    <Text className="text-gray-500 text-xs font-semibold">{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              {(() => {
                const year = calendarViewDate.getFullYear();
                const month = calendarViewDate.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const today = new Date();

                const weeks: (number | null)[][] = [];
                let currentWeek: (number | null)[] = [];

                // Fill in empty slots before first day
                for (let i = 0; i < firstDay; i++) {
                  currentWeek.push(null);
                }

                // Fill in days
                for (let day = 1; day <= daysInMonth; day++) {
                  currentWeek.push(day);
                  if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                  }
                }

                // Fill in remaining slots
                if (currentWeek.length > 0) {
                  while (currentWeek.length < 7) {
                    currentWeek.push(null);
                  }
                  weeks.push(currentWeek);
                }

                return weeks.map((week, weekIndex) => (
                  <View key={weekIndex} className="flex-row">
                    {week.map((day, dayIndex) => {
                      if (day === null) {
                        return <View key={dayIndex} className="flex-1 items-center py-2" />;
                      }

                      const dateObj = new Date(year, month, day);
                      const isSelected = selectedDate.getDate() === day &&
                        selectedDate.getMonth() === month &&
                        selectedDate.getFullYear() === year;
                      const isFuture = dateObj > today;
                      const isToday = today.getDate() === day &&
                        today.getMonth() === month &&
                        today.getFullYear() === year;

                      return (
                        <Pressable
                          key={dayIndex}
                          onPress={() => {
                            if (!isFuture) {
                              const newDate = new Date(year, month, day, 12, 0, 0);
                              setSelectedDate(newDate);
                            }
                          }}
                          disabled={isFuture}
                          className={cn(
                            'flex-1 items-center py-2 mx-0.5 my-0.5 rounded-lg',
                            isSelected && 'bg-gray-900',
                            !isSelected && !isFuture && 'active:bg-gray-100'
                          )}
                        >
                          <Text className={cn(
                            'text-sm font-medium',
                            isSelected ? 'text-white' : isFuture ? 'text-gray-300' : 'text-gray-900',
                            isToday && !isSelected && 'text-blue-600 font-bold'
                          )}>
                            {day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ));
              })()}

              {/* Confirm Button */}
              <Pressable
                onPress={() => setShowDatePicker(false)}
                className="mt-4 w-full py-3 rounded-xl items-center bg-gray-900 active:opacity-80"
              >
                <Text className="text-white font-semibold">Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sticky Bottom CTA */}
      <StickyButtonContainer bottomInset={insets.bottom}>
        <Button
          onPress={handleSubmit}
          disabled={!customerName.trim() || items.length === 0}
          loading={isSubmitting}
          loadingText="Saving..."
        >
          Save Changes
        </Button>
      </StickyButtonContainer>

      {toast && (
        <View
          className="absolute left-5 right-5 items-center"
          style={{ top: insets.top + 60 }}
        >
          <View
            className="flex-row items-center px-5 py-4 rounded-xl"
            style={{ backgroundColor: toast.type === 'success' ? '#111111' : '#EF4444' }}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-white">
              <Check size={18} color={toast.type === 'success' ? '#111111' : '#EF4444'} strokeWidth={2.5} />
            </View>
            <Text className="text-white font-semibold text-sm">{toast.message}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
