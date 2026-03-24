import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Modal, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Minus, Trash2, ChevronDown, Check, Search, Package, User as UserIcon, Users, Calendar, ChevronLeft, ChevronRight, Pencil, Clock3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import useFyllStore, { OrderItem, OrderService, ServiceFieldType, formatCurrency, NIGERIA_STATES, Customer } from '@/lib/state/fyll-store';
import useAuthStore from '@/lib/state/auth-store';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { Button, StickyButtonContainer } from '@/components/Button';
import { normalizeProductType } from '@/lib/product-utils';
import { useThemeColors } from '@/lib/theme';

interface SearchResult {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  stock: number;
  price: number;
  isService?: boolean;
}

type DatePickerTarget =
  | { type: 'order' }
  | { type: 'serviceField'; itemIndex: number; fieldId: string };

type TimePickerTarget = { itemIndex: number; fieldId: string };

const normalizeServiceFieldType = (type?: string): ServiceFieldType => (
  type === 'Date' || type === 'Time' || type === 'Number' || type === 'Select' || type === 'Price' ? type : 'Text'
);

const normalizeOption = (option: string | { value: string; amount?: number }) => (
  typeof option === 'string' ? { value: option } : option
);

const toIsoDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDateString = (value: string | undefined): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 12, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseTimeString = (value: string | undefined): { hour: number; minute: number } | null => {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const toTimeString = (hour: number, minute: number): string => (
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
);

const formatTimeDisplay = (value: string | undefined): string => {
  const parsed = parseTimeString(value);
  if (!parsed) return value ?? '';
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const getOptionAmountForValue = (
  options: (string | { value: string; amount?: number })[] | undefined,
  selectedValue: string | undefined
): number => {
  if (!selectedValue || !options?.length) return 0;
  const selectedOption = options
    .map(normalizeOption)
    .find((option) => option.value === selectedValue);
  return typeof selectedOption?.amount === 'number' && Number.isFinite(selectedOption.amount)
    ? selectedOption.amount
    : 0;
};

const calculateServiceUnitPrice = (
  product: { variants: { id: string; sellingPrice: number }[]; serviceUsesGlobalPricing?: boolean },
  variantId: string,
  serviceVariables: OrderItem['serviceVariables'],
  serviceFields: OrderItem['serviceFields']
): number => {
  const basePrice = product.variants.find((variant) => variant.id === variantId)?.sellingPrice ?? 0;
  const usesGlobalPricing = product.serviceUsesGlobalPricing ?? true;
  const variableAmount = usesGlobalPricing
    ? 0
    : (serviceVariables ?? []).reduce((sum, variable) => {
      if (variable.type !== 'Select') return sum;
      return sum + getOptionAmountForValue(variable.options, variable.value);
    }, 0);
  const fieldSelectAmount = (serviceFields ?? []).reduce((sum, field) => {
    if (field.type !== 'Select') return sum;
    return sum + getOptionAmountForValue(field.options, field.value);
  }, 0);
  const fieldPriceAmount = (serviceFields ?? []).reduce((sum, field) => {
    if (field.type !== 'Price') return sum;
    const parsed = Number.parseFloat((field.value ?? '').trim());
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return (usesGlobalPricing ? basePrice : 0) + variableAmount + fieldSelectAmount + fieldPriceAmount;
};

interface OrderEditFormProps {
  orderId: string;
  showHeader?: boolean;
  onClose?: () => void;
}

export function OrderEditForm({ orderId, showHeader = true, onClose }: OrderEditFormProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const inputContainerStyle = {
    backgroundColor: colors.input.bg,
    borderWidth: 1,
    borderColor: colors.input.border,
  } as const;
  const inputTextStyle = { color: colors.input.text } as const;
  const labelTextStyle = { color: colors.text.secondary } as const;
  const helperTextStyle = { color: colors.text.tertiary } as const;
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
  const [itemTypeTab, setItemTypeTab] = useState<'product' | 'service'>('product');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Order Date state
  const [orderDateType, setOrderDateType] = useState<'today' | 'another'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date()); // For calendar navigation
  const [pickerDate, setPickerDate] = useState(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget | null>(null);
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);

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
    setPickerDate(resolvedDate);

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
        const isService = normalizeProductType(product.productType) === 'service';
        if (itemTypeTab === 'service' && !isService) return;
        if (itemTypeTab === 'product' && isService) return;
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
              isService,
            });
          }
        });
      });
    return results;
  }, [searchQuery, products, itemTypeTab]);

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

  const isServiceOrderItem = (item: OrderItem): boolean => {
    const product = products.find((p) => p.id === item.productId);
    const isServiceProduct = product ? normalizeProductType(product.productType) === 'service' : false;
    const hasServiceConfig = (item.serviceVariables?.length ?? 0) > 0 || (item.serviceFields?.length ?? 0) > 0;
    return isServiceProduct || Boolean(item.serviceId) || hasServiceConfig;
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
      const product = products.find((p) => p.id === result.productId);
      const serviceVariables = result.isService
        ? (product?.serviceVariables ?? []).map((variable) => ({
          id: variable.id,
          name: variable.name,
          type: variable.type,
          options: (variable.options ?? []).map(normalizeOption),
          required: variable.required,
          value: variable.defaultValue ?? (variable.type === 'Toggle' ? 'false' : ''),
        }))
        : undefined;
      const serviceFields = result.isService
        ? (product?.serviceFields ?? []).map((field) => ({
          id: field.id,
          label: field.label,
          type: normalizeServiceFieldType(field.type),
          options: (field.options ?? []).map(normalizeOption),
          required: field.required,
          value: field.defaultValue ?? field.value ?? '',
        }))
        : undefined;
      const unitPrice = result.isService && product
        ? calculateServiceUnitPrice(product, result.variantId, serviceVariables, serviceFields)
        : result.price;
      setItems([...items, {
        productId: result.productId,
        variantId: result.variantId,
        quantity: 1,
        unitPrice,
        serviceId: result.isService ? result.productId : undefined,
        serviceVariables,
        serviceFields,
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
      const isService = isServiceOrderItem(newItems[index]);
      const product = products.find((p) => p.id === newItems[index].productId);
      const variant = product?.variants.find((v) => v.id === newItems[index].variantId);
      if (isService) {
        newItems[index].quantity = newQty;
      } else if (variant && newQty <= variant.stock) {
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
        const isService = isServiceOrderItem(item);
        if (!isService) {
          updateVariantStock(item.productId, item.variantId, item.quantity);
        }
      });

      // Deduct stock for the updated items
      items.forEach((item) => {
        const isService = isServiceOrderItem(item);
        if (!isService) {
          updateVariantStock(item.productId, item.variantId, -item.quantity);
        }
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
    const isService = isServiceOrderItem(item);
    const usesGlobalPricing = product?.serviceUsesGlobalPricing ?? true;
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const variantName = isService
      ? (product?.categories?.[0] ?? 'Service')
      : (variant ? Object.values(variant.variableValues).join(' / ') : '');
    return { productName: product?.name || 'Unknown', variantName, stock: variant?.stock || 0, isService, usesGlobalPricing };
  };

  const handleServiceVariableUpdate = (itemIndex: number, variableId: string, value: string) => {
    setItems((prev) => prev.map((item, index) => {
      if (index !== itemIndex) return item;
      const nextVars = (item.serviceVariables ?? []).map((variable) =>
        variable.id === variableId ? { ...variable, value } : variable
      );
      const product = products.find((p) => p.id === item.productId);
      const isService = isServiceOrderItem(item);
      if (!product || !isService) {
        return { ...item, serviceVariables: nextVars };
      }

      return {
        ...item,
        serviceVariables: nextVars,
        unitPrice: calculateServiceUnitPrice(product, item.variantId, nextVars, item.serviceFields),
      };
    }));
  };

  const handleServiceFieldUpdate = (itemIndex: number, fieldId: string, value: string) => {
    setItems((prev) => prev.map((item, index) => {
      if (index !== itemIndex) return item;
      const nextFields = (item.serviceFields ?? []).map((field) =>
        field.id === fieldId ? { ...field, value } : field
      );
      const product = products.find((p) => p.id === item.productId);
      const isService = isServiceOrderItem(item);
      if (!product || !isService) {
        return { ...item, serviceFields: nextFields };
      }
      return {
        ...item,
        serviceFields: nextFields,
        unitPrice: calculateServiceUnitPrice(product, item.variantId, item.serviceVariables, nextFields),
      };
    }));
  };

  const openOrderDatePicker = () => {
    const initialDate = selectedDate;
    setDatePickerTarget({ type: 'order' });
    setPickerDate(initialDate);
    setCalendarViewDate(initialDate);
    setShowDatePicker(true);
  };

  const openServiceFieldDatePicker = (itemIndex: number, fieldId: string, currentValue: string) => {
    const parsedDate = parseIsoDateString(currentValue) ?? new Date();
    setDatePickerTarget({ type: 'serviceField', itemIndex, fieldId });
    setPickerDate(parsedDate);
    setCalendarViewDate(parsedDate);
    setShowDatePicker(true);
  };

  const openServiceFieldTimePicker = (itemIndex: number, fieldId: string, currentValue: string) => {
    const parsedTime = parseTimeString(currentValue);
    const fallback = new Date();
    setTimePickerTarget({ itemIndex, fieldId });
    setPickerHour(parsedTime?.hour ?? fallback.getHours());
    setPickerMinute(parsedTime?.minute ?? fallback.getMinutes());
    setShowTimePicker(true);
  };

  const commitDatePickerValue = () => {
    if (!datePickerTarget) {
      setShowDatePicker(false);
      return;
    }

    if (datePickerTarget.type === 'order') {
      setSelectedDate(pickerDate);
      setOrderDateType('another');
    } else {
      handleServiceFieldUpdate(datePickerTarget.itemIndex, datePickerTarget.fieldId, toIsoDateString(pickerDate));
    }

    setShowDatePicker(false);
    setDatePickerTarget(null);
  };

  const commitTimePickerValue = () => {
    if (!timePickerTarget) {
      setShowTimePicker(false);
      return;
    }
    handleServiceFieldUpdate(timePickerTarget.itemIndex, timePickerTarget.fieldId, toTimeString(pickerHour, pickerMinute));
    setShowTimePicker(false);
    setTimePickerTarget(null);
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg.secondary }}>
        <Text style={{ color: colors.text.primary }} className="text-lg font-semibold">Order not found</Text>
        <Text style={{ color: colors.text.tertiary }} className="text-sm mt-2 text-center">
          This order may have been deleted or is no longer available.
        </Text>
        <Pressable
          onPress={handleClose}
          className="mt-5 rounded-xl px-4 py-2 active:opacity-70"
          style={{ borderWidth: 1, borderColor: colors.border.light }}
        >
          <Text style={{ color: colors.text.secondary }} className="text-sm font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.secondary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {showHeader && (
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ backgroundColor: colors.bg.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light }}
          >
            <Pressable
              onPress={handleClose}
              className="w-10 h-10 rounded-xl items-center justify-center active:opacity-50"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <X size={24} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
            <Text style={{ color: colors.text.primary }} className="text-lg font-bold">Edit Order</Text>
            <View className="w-10 h-10" />
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Customer Info Section */}
          <View className="mx-4 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base">Customer Information</Text>
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
                <View className="flex-row items-center rounded-xl px-3" style={inputContainerStyle}>
                  <Search size={18} color={colors.input.placeholder} strokeWidth={2} />
                  <TextInput
                    placeholder="Search by name, phone, or email..."
                    placeholderTextColor={colors.input.placeholder}
                    value={customerSearchQuery}
                    onChangeText={setCustomerSearchQuery}
                    autoFocus
                    className="flex-1 py-3 px-2 text-base"
                    style={inputTextStyle}
                  />
                </View>
                {customerSearchResults.length > 0 && (
                  <View className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: colors.input.border, backgroundColor: colors.input.bg }}>
                    {customerSearchResults.slice(0, 5).map((customer) => (
                      <Pressable
                        key={customer.id}
                        onPress={() => handleSelectCustomer(customer)}
                        className="flex-row items-center p-3 active:opacity-80"
                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
                      >
                        <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
                          <UserIcon size={18} color="#059669" strokeWidth={2} />
                        </View>
                        <View className="flex-1">
                          <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">{customer.fullName}</Text>
                          <Text style={{ color: colors.text.tertiary }} className="text-xs">
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
                  <View className="mt-2 p-4 rounded-xl items-center" style={inputContainerStyle}>
                    <Text style={{ color: colors.text.tertiary }} className="text-sm">No customers found</Text>
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
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Full Name *</Text>
              <TextInput
                placeholder="Enter customer name"
                placeholderTextColor={colors.input.placeholder}
                value={customerName}
                onChangeText={setCustomerName}
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Phone Number</Text>
              <TextInput
                placeholder="+234 xxx xxx xxxx"
                placeholderTextColor={colors.input.placeholder}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Email</Text>
              <TextInput
                placeholder="email@example.com"
                placeholderTextColor={colors.input.placeholder}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Delivery State</Text>
              <Pressable
                onPress={() => setShowStateModal(true)}
                className="rounded-xl px-4 py-3 flex-row items-center justify-between"
                style={inputContainerStyle}
              >
                <Text style={{ color: deliveryState ? colors.input.text : colors.input.placeholder }} className="text-base">
                  {deliveryState || 'Select state'}
                </Text>
                <ChevronDown size={20} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Delivery Address</Text>
              <TextInput
                placeholder="Enter full delivery address"
                placeholderTextColor={colors.input.placeholder}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline
                numberOfLines={3}
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              />
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Website Order Ref (WooCommerce)</Text>
              <TextInput
                placeholder="e.g. WC #10234 (optional)"
                placeholderTextColor={colors.input.placeholder}
                value={websiteOrderRef}
                onChangeText={setWebsiteOrderRef}
                className="rounded-xl px-4 h-[52px] text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

          </View>

          {/* Items Section */}
          <View className="mx-4 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base">Items *</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setItemTypeTab('product');
                    setShowProductSearch(true);
                  }}
                  className="px-3 py-2 rounded-full flex-row items-center active:opacity-70"
                  style={{
                    backgroundColor: itemTypeTab === 'product' && showProductSearch ? colors.text.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: itemTypeTab === 'product' && showProductSearch ? colors.text.primary : colors.input.border,
                  }}
                >
                  <Plus
                    size={16}
                    color={itemTypeTab === 'product' && showProductSearch ? colors.bg.primary : colors.text.secondary}
                    strokeWidth={2.4}
                  />
                  <Text
                    className="font-semibold text-sm ml-1"
                    style={{ color: itemTypeTab === 'product' && showProductSearch ? colors.bg.primary : colors.text.secondary }}
                  >
                    Add Product
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setItemTypeTab('service');
                    setShowProductSearch(true);
                  }}
                  className="px-3 py-2 rounded-full flex-row items-center active:opacity-70"
                  style={{
                    backgroundColor: itemTypeTab === 'service' && showProductSearch ? colors.text.primary : 'transparent',
                    borderWidth: 1.5,
                    borderColor: itemTypeTab === 'service' && showProductSearch ? colors.text.primary : colors.input.border,
                  }}
                >
                  <Plus
                    size={16}
                    color={itemTypeTab === 'service' && showProductSearch ? colors.bg.primary : colors.text.secondary}
                    strokeWidth={2.4}
                  />
                  <Text
                    className="font-semibold text-sm ml-1"
                    style={{ color: itemTypeTab === 'service' && showProductSearch ? colors.bg.primary : colors.text.secondary }}
                  >
                    Add Service
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Product Search */}
            {showProductSearch && (
              <View className="mb-4">
                <View className="flex-row items-center rounded-xl px-3" style={inputContainerStyle}>
                  <Search size={18} color={colors.input.placeholder} strokeWidth={2} />
                  <TextInput
                    placeholder={
                      itemTypeTab === 'service'
                        ? 'Search services (e.g., Eye Test)'
                        : 'Search products or variants (e.g., Black, Gold)'
                    }
                    placeholderTextColor={colors.input.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    className="flex-1 py-3 px-2 text-base"
                    style={inputTextStyle}
                  />
                </View>

                {searchResults.length > 0 && (
                  <View className="mt-2 rounded-xl border max-h-60" style={{ backgroundColor: colors.input.bg, borderColor: colors.input.border }}>
                    <ScrollView nestedScrollEnabled>
                      {searchResults.map((result) => {
                        const isSelected = items.some(
                          (item) => item.productId === result.productId && item.variantId === result.variantId
                        );
                        return (
                          <Pressable
                            key={`${result.productId}-${result.variantId}`}
                            onPress={() => handleAddProduct(result)}
                            className="flex-row items-center p-3 active:opacity-80"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border.light,
                              backgroundColor: isSelected ? 'rgba(16,185,129,0.12)' : colors.input.bg,
                            }}
                          >
                            <View className="w-10 h-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: colors.bg.secondary }}>
                              <Package size={18} color={colors.text.tertiary} strokeWidth={2} />
                            </View>
                            <View className="flex-1">
                              <Text style={{ color: colors.text.primary }} className="font-semibold text-sm">
                                {result.isService ? result.productName : `${result.productName} - ${result.variantName}`}
                              </Text>
                            {result.isService ? (
                              <Text style={{ color: colors.text.tertiary }} className="text-xs">Service</Text>
                            ) : (
                              <Text
                                className="text-xs"
                                style={{ color: result.stock > 0 ? '#059669' : '#EF4444' }}
                              >
                                {result.stock > 0 ? `${result.stock} in stock` : 'Out of stock'}
                              </Text>
                              )}
                            </View>
                            <Text style={{ color: colors.text.primary }} className="font-bold text-sm">{formatCurrency(result.price)}</Text>
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
                  const { productName, variantName, stock, isService, usesGlobalPricing } = getItemDetails(item);
                  const fullName = isService ? productName : `${productName} - ${variantName}`;
                  const serviceVariables = item.serviceVariables ?? [];
                  const serviceFields = item.serviceFields ?? [];
                  return (
                    <View
                      key={`${item.productId}-${item.variantId}`}
                      className="py-3 border-b border-gray-100"
                    >
                      <View className="flex-row items-center">
                        <View className="flex-1 mr-3">
                          <Text style={{ color: colors.text.primary }} className="font-semibold text-sm" numberOfLines={2}>{fullName}</Text>
                          <Text style={{ color: colors.text.tertiary }} className="text-xs mt-0.5">
                            {isService ? 'Service' : `${stock} in stock`}
                          </Text>
                        </View>

                        <View className="flex-row items-center rounded-lg" style={{ backgroundColor: colors.bg.secondary }}>
                          <Pressable
                            onPress={() => handleUpdateQuantity(index, -1)}
                            className="p-2 active:opacity-50"
                          >
                            <Minus size={14} color={colors.text.secondary} strokeWidth={2} />
                          </Pressable>
                          <Text style={{ color: colors.text.primary }} className="font-bold text-sm w-8 text-center">{item.quantity}</Text>
                          <Pressable
                            onPress={() => handleUpdateQuantity(index, 1)}
                            className="p-2 active:opacity-50"
                          >
                            <Plus size={14} color={colors.text.secondary} strokeWidth={2} />
                          </Pressable>
                        </View>

                        <Pressable onPress={() => handleRemoveItem(index)} className="ml-2 p-1 active:opacity-50">
                          <Trash2 size={16} color="#EF4444" strokeWidth={2} />
                        </Pressable>
                      </View>

                      <Text style={{ color: colors.text.primary }} className="font-bold text-sm mt-1">
                        {formatCurrency(item.unitPrice * item.quantity)}
                        {item.quantity > 1 && (
                          <Text style={helperTextStyle} className="font-normal text-xs">
                            {' '}({formatCurrency(item.unitPrice)} × {item.quantity})
                          </Text>
                        )}
                      </Text>

                      {isService && (serviceVariables.length > 0 || serviceFields.length > 0) && (
                        <View className="mt-3 pt-3 border-t border-gray-100">
                          <Text style={helperTextStyle} className="text-xs font-semibold uppercase tracking-wider mb-2">
                            Service Configuration
                          </Text>
                          <View className="gap-3">
                            {serviceVariables.map((variable) => {
                              const value = variable.value ?? '';
                              const isRequired = Boolean(variable.required);
                              return (
                                <View key={variable.id}>
                                  <Text style={labelTextStyle} className="text-sm font-medium mb-2">
                                    {variable.name}{isRequired ? ' *' : ''}
                                  </Text>
                                  {variable.type === 'Select' && (
                                    <View className="flex-row flex-wrap gap-2">
                                      {(variable.options ?? []).map((rawOption) => {
                                        const option = normalizeOption(rawOption);
                                        const selected = value === option.value;
                                        return (
                                          <Pressable
                                            key={`${option.value}-${option.amount ?? 'na'}`}
                                            onPress={() => handleServiceVariableUpdate(index, variable.id, option.value)}
                                            className="px-4 py-2 rounded-full"
                                            style={{
                                              backgroundColor: selected ? colors.text.primary : colors.bg.secondary,
                                              borderWidth: 1,
                                              borderColor: selected ? colors.text.primary : colors.border.light,
                                            }}
                                          >
                                            <Text
                                              className="text-xs font-semibold"
                                              style={{ color: selected ? colors.bg.primary : colors.text.secondary }}
                                            >
                                              {option.value}
                                              {!usesGlobalPricing && typeof option.amount === 'number' && Number.isFinite(option.amount)
                                                ? ` (+${formatCurrency(option.amount)})`
                                                : ''}
                                            </Text>
                                          </Pressable>
                                        );
                                      })}
                                    </View>
                                  )}
                                  {variable.type === 'Toggle' && (
                                    <Switch
                                      value={value === 'true'}
                                      onValueChange={(next: boolean) => handleServiceVariableUpdate(index, variable.id, next ? 'true' : 'false')}
                                    />
                                  )}
                                  {variable.type === 'Number' && (
                                    <TextInput
                                      value={value}
                                      onChangeText={(next) => handleServiceVariableUpdate(index, variable.id, next)}
                                      placeholder="Enter value"
                                      placeholderTextColor={colors.input.placeholder}
                                      keyboardType="numeric"
                                      className="rounded-xl px-4 py-3 text-sm"
                                      style={[inputContainerStyle, inputTextStyle]}
                                    />
                                  )}
                                  {variable.type === 'Text' && (
                                    <TextInput
                                      value={value}
                                      onChangeText={(next) => handleServiceVariableUpdate(index, variable.id, next)}
                                      placeholder="Enter value"
                                      placeholderTextColor={colors.input.placeholder}
                                      className="rounded-xl px-4 py-3 text-sm"
                                      style={[inputContainerStyle, inputTextStyle]}
                                    />
                                  )}
                                </View>
                              );
                            })}

                            {serviceFields.map((field) => {
                              const value = field.value ?? '';
                              const isRequired = Boolean(field.required);
                              const fieldType = normalizeServiceFieldType(field.type);
                              const parsedDateValue = fieldType === 'Date' ? parseIsoDateString(value) : null;
                              const displayDateValue = parsedDateValue
                                ? parsedDateValue.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                                : '';
                              const fieldOptions = Array.from(
                                new Map(
                                  (field.options ?? [])
                                    .map(normalizeOption)
                                    .filter((option) => option.value.trim().length > 0)
                                    .map((option) => [option.value, option])
                                ).values()
                              );
                              const displayTimeValue = fieldType === 'Time' ? formatTimeDisplay(value) : '';
                              return (
                                <View key={field.id}>
                                  <Text style={labelTextStyle} className="text-sm font-medium mb-2">
                                    {field.label}{isRequired ? ' *' : ''}
                                  </Text>
                                  {fieldType === 'Date' ? (
                                    <Pressable
                                      onPress={() => openServiceFieldDatePicker(index, field.id, value)}
                                      className="rounded-xl px-4 py-3 text-sm flex-row items-center justify-between"
                                      style={inputContainerStyle}
                                    >
                                      <View className="flex-row items-center">
                                        <Calendar size={16} color={colors.input.placeholder} strokeWidth={2} />
                                        <Text className="text-sm ml-2" style={{ color: displayDateValue ? colors.input.text : colors.input.placeholder }}>
                                          {displayDateValue || value || 'Pick a date'}
                                        </Text>
                                      </View>
                                      <ChevronDown size={16} color={colors.input.placeholder} strokeWidth={2} />
                                    </Pressable>
                                  ) : fieldType === 'Time' ? (
                                    <Pressable
                                      onPress={() => openServiceFieldTimePicker(index, field.id, value)}
                                      className="rounded-xl px-4 py-3 text-sm flex-row items-center justify-between"
                                      style={inputContainerStyle}
                                    >
                                      <View className="flex-row items-center">
                                        <Clock3 size={16} color={colors.input.placeholder} strokeWidth={2} />
                                        <Text className="text-sm ml-2" style={{ color: displayTimeValue ? colors.input.text : colors.input.placeholder }}>
                                          {displayTimeValue || value || 'Pick a time'}
                                        </Text>
                                      </View>
                                      <ChevronDown size={16} color={colors.input.placeholder} strokeWidth={2} />
                                    </Pressable>
                                  ) : fieldType === 'Select' ? (
                                    <View className="flex-row flex-wrap gap-2">
                                      {fieldOptions.map((option) => {
                                        const selected = value === option.value;
                                        return (
                                          <Pressable
                                            key={`${field.id}-${option.value}-${option.amount ?? 'na'}`}
                                            onPress={() => handleServiceFieldUpdate(index, field.id, option.value)}
                                            className="px-4 py-2 rounded-full"
                                            style={{
                                              backgroundColor: selected ? colors.text.primary : colors.bg.secondary,
                                              borderWidth: 1,
                                              borderColor: selected ? colors.text.primary : colors.border.light,
                                            }}
                                          >
                                            <Text
                                              className="text-xs font-semibold"
                                              style={{ color: selected ? colors.bg.primary : colors.text.secondary }}
                                            >
                                              {option.value}
                                              {typeof option.amount === 'number' && Number.isFinite(option.amount)
                                                ? ` (+${formatCurrency(option.amount)})`
                                                : ''}
                                            </Text>
                                          </Pressable>
                                        );
                                      })}
                                      {fieldOptions.length === 0 && (
                                        <Text style={helperTextStyle} className="text-xs">No options configured for this field.</Text>
                                      )}
                                    </View>
                                  ) : (
                                    <TextInput
                                      value={value}
                                      onChangeText={(next) => handleServiceFieldUpdate(index, field.id, next)}
                                      placeholder={fieldType === 'Number' || fieldType === 'Price' ? 'Enter number' : 'Enter value'}
                                      placeholderTextColor={colors.input.placeholder}
                                      keyboardType={fieldType === 'Number' || fieldType === 'Price' ? 'numeric' : 'default'}
                                      className="rounded-xl px-4 py-3 text-sm"
                                      style={[inputContainerStyle, inputTextStyle]}
                                    />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="py-8 items-center">
                <Package size={32} color={colors.text.muted} strokeWidth={1.5} />
                <Text style={helperTextStyle} className="text-sm mt-2">No items added yet</Text>
              </View>
            )}
          </View>

          {/* Add-ons Section */}
          {items.length > 0 && (
          <View className="mx-4 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: colors.text.primary }} className="font-bold text-base">Add-ons</Text>
              <Pressable
                onPress={() => setShowServiceModal(true)}
                className="px-3 py-2 rounded-full flex-row items-center active:opacity-70"
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: colors.input.border,
                }}
              >
                <Plus size={16} color={colors.text.secondary} strokeWidth={2} />
                <Text className="font-semibold text-sm ml-1" style={{ color: colors.text.secondary }}>Add Add-on</Text>
              </Pressable>
            </View>

            {services.length > 0 ? (
              services.map((service, index) => (
                <View key={`${service.serviceId}-${index}`} className="flex-row items-center py-3 border-b border-gray-100">
                  <View className="flex-1">
                    <Text style={{ color: colors.text.primary }} className="font-medium text-sm">{service.name}</Text>
                  </View>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-sm mr-2">{formatCurrency(service.price)}</Text>
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
              <Text style={{ color: colors.text.muted }} className="text-sm text-center py-4">No add-ons added</Text>
            )}
          </View>
          )}

          {/* Fees & Charges Section */}
          <View className="mx-4 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-4">Fees & Charges</Text>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Delivery Fee</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={colors.input.placeholder}
                value={deliveryFee}
                onChangeText={setDeliveryFee}
                keyboardType="numeric"
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Additional Charges</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={colors.input.placeholder}
                value={additionalCharges}
                onChangeText={setAdditionalCharges}
                keyboardType="numeric"
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>

            {additionalChargesNum > 0 && (
              <View className="mb-4">
                <Text style={labelTextStyle} className="text-sm font-medium mb-2">Additional Charges Note</Text>
                <TextInput
                  placeholder="Describe the additional charges"
                  placeholderTextColor={colors.input.placeholder}
                  value={additionalChargesNote}
                  onChangeText={setAdditionalChargesNote}
                  className="rounded-xl px-4 py-3 text-base"
                  style={[inputContainerStyle, inputTextStyle]}
                />
              </View>
            )}

            <View>
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Discount Amount</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={colors.input.placeholder}
                value={discountAmount}
                onChangeText={setDiscountAmount}
                keyboardType="numeric"
                className="rounded-xl px-4 py-3 text-base"
                style={[inputContainerStyle, inputTextStyle]}
              />
            </View>
          </View>

          {/* Order Details Section */}
          <View className="mx-4 mt-4 rounded-2xl p-4" style={{ backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.light }}>
            <Text style={{ color: colors.text.primary }} className="font-bold text-base mb-4">Order Details</Text>

            {/* Order Date */}
            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Order Date</Text>
              <View className="flex-row rounded-xl overflow-hidden border" style={{ borderColor: colors.input.border }}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setOrderDateType('today');
                  }}
                  className="flex-1 py-3 items-center justify-center"
                  style={{ backgroundColor: orderDateType === 'today' ? colors.text.primary : colors.input.bg }}
                >
                  <Text
                    className="font-semibold text-sm"
                    style={{ color: orderDateType === 'today' ? colors.bg.primary : colors.text.secondary }}
                  >
                    Today
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setOrderDateType('another');
                    openOrderDatePicker();
                  }}
                  className="flex-1 py-3 items-center justify-center"
                  style={{ backgroundColor: orderDateType === 'another' ? colors.text.primary : colors.input.bg }}
                >
                  <Text
                    className="font-semibold text-sm"
                    style={{ color: orderDateType === 'another' ? colors.bg.primary : colors.text.secondary }}
                  >
                    Another Day
                  </Text>
                </Pressable>
              </View>

              {/* Date Display for "Another Day" */}
              {orderDateType === 'another' && (
                <Pressable
                  onPress={openOrderDatePicker}
                  className="mt-3 rounded-xl px-4 py-3 flex-row items-center justify-between active:opacity-70"
                  style={inputContainerStyle}
                >
                  <View className="flex-row items-center">
                    <Calendar size={18} color={colors.text.tertiary} strokeWidth={2} />
                    <Text style={{ color: colors.input.text }} className="text-base ml-2">
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={colors.text.tertiary} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            <View className="mb-4">
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Sales Source</Text>
              <Pressable
                onPress={() => setShowSourceModal(true)}
                className="rounded-xl px-4 py-3 flex-row items-center justify-between"
                style={inputContainerStyle}
              >
                <Text style={{ color: colors.input.text }} className="text-base">{source}</Text>
                <ChevronDown size={20} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>

            <View>
              <Text style={labelTextStyle} className="text-sm font-medium mb-2">Payment Method</Text>
              <Pressable
                onPress={() => setShowPaymentModal(true)}
                className="rounded-xl px-4 py-3 flex-row items-center justify-between"
                style={inputContainerStyle}
              >
                <Text style={{ color: colors.input.text }} className="text-base">{paymentMethod}</Text>
                <ChevronDown size={20} color={colors.text.tertiary} strokeWidth={2} />
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
                <Text className="text-gray-400 text-sm">Add-ons</Text>
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
                <Text className="text-gray-400 text-sm">Discount</Text>
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
            style={{ backgroundColor: colors.bg.card, maxWidth: 420 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Set Service Price</Text>
              <Pressable
                onPress={() => setShowServicePriceModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>
            <View className="px-5 py-4">
              <Text style={{ color: colors.text.secondary }} className="text-sm font-medium mb-2">Service Fee</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={colors.input.placeholder}
                value={servicePriceInput}
                onChangeText={setServicePriceInput}
                keyboardType="numeric"
                className="rounded-xl px-4 py-3 text-base"
                style={{ backgroundColor: colors.input.bg, borderWidth: 1, borderColor: colors.input.border, color: colors.input.text }}
              />
              <View className="flex-row gap-3 mt-4">
                <Pressable
                  onPress={() => setShowServicePriceModal(false)}
                  className="flex-1 rounded-xl items-center justify-center"
                  style={{ height: 48, backgroundColor: colors.bg.secondary }}
                >
                  <Text style={{ color: colors.text.secondary }} className="font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmEditServicePrice}
                  className="flex-1 rounded-xl items-center justify-center"
                  style={{ height: 48, backgroundColor: colors.text.primary }}
                >
                  <Text style={{ color: colors.bg.primary }} className="font-semibold">Save</Text>
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
        onRequestClose={() => {
          setShowDatePicker(false);
          setDatePickerTarget(null);
        }}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => {
            setShowDatePicker(false);
            setDatePickerTarget(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.card, maxWidth: 400 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">
                {datePickerTarget?.type === 'serviceField' ? 'Select Field Date' : 'Select Date'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setDatePickerTarget(null);
                }}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
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
                  className="w-10 h-10 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <ChevronLeft size={20} color={colors.text.primary} strokeWidth={2} />
                </Pressable>
                <Text style={{ color: colors.text.primary }} className="font-bold text-base">
                  {calendarViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable
                  onPress={() => {
                    const newDate = new Date(calendarViewDate);
                    newDate.setMonth(newDate.getMonth() + 1);
                    const shouldRestrictFutureDates = datePickerTarget?.type !== 'serviceField';
                    if (!shouldRestrictFutureDates || newDate <= new Date()) {
                      setCalendarViewDate(newDate);
                    }
                  }}
                  className="w-10 h-10 rounded-full items-center justify-center active:opacity-50"
                  style={{ backgroundColor: colors.bg.secondary }}
                >
                  <ChevronRight size={20} color={colors.text.primary} strokeWidth={2} />
                </Pressable>
              </View>

              {/* Day Labels */}
              <View className="flex-row mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <View key={day} className="flex-1 items-center py-2">
                    <Text style={{ color: colors.text.tertiary }} className="text-xs font-semibold">{day}</Text>
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
                      const isSelected = pickerDate.getDate() === day &&
                        pickerDate.getMonth() === month &&
                        pickerDate.getFullYear() === year;
                      const shouldRestrictFutureDates = datePickerTarget?.type !== 'serviceField';
                      const isFuture = shouldRestrictFutureDates && dateObj > today;
                      const isToday = today.getDate() === day &&
                        today.getMonth() === month &&
                        today.getFullYear() === year;

                      return (
                        <Pressable
                          key={dayIndex}
                          onPress={() => {
                            if (!isFuture) {
                              const newDate = new Date(year, month, day, 12, 0, 0);
                              setPickerDate(newDate);
                            }
                          }}
                          disabled={isFuture}
                          className={cn(
                            'flex-1 items-center py-2 mx-0.5 my-0.5 rounded-lg',
                            isSelected && 'bg-gray-900',
                            !isSelected && !isFuture && 'active:opacity-70'
                          )}
                          style={!isSelected && !isFuture ? { backgroundColor: colors.bg.secondary } : undefined}
                        >
                          <Text className={cn(
                            'text-sm font-medium',
                            isSelected ? 'text-white' : isFuture ? 'text-gray-300' : 'text-gray-900',
                            isToday && !isSelected && 'text-blue-600 font-bold'
                          )} style={!isSelected && !isFuture ? { color: colors.text.primary } : undefined}>
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
                onPress={commitDatePickerValue}
                className="mt-4 w-full py-3 rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: colors.text.primary }}
              >
                <Text style={{ color: colors.bg.primary }} className="font-semibold">Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showTimePicker}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowTimePicker(false);
          setTimePickerTarget(null);
        }}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={() => {
            setShowTimePicker(false);
            setTimePickerTarget(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-[90%] rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.bg.card, maxWidth: 420 }}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border.light }}>
              <Text style={{ color: colors.text.primary }} className="font-bold text-lg">Select Time</Text>
              <Pressable
                onPress={() => {
                  setShowTimePicker(false);
                  setTimePickerTarget(null);
                }}
                className="w-8 h-8 rounded-full items-center justify-center active:opacity-50"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <X size={18} color={colors.text.tertiary} strokeWidth={2} />
              </Pressable>
            </View>
            <View className="p-4">
              <View className="flex-row items-center justify-center">
                <View className="items-center">
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-2">Hour</Text>
                  <Pressable
                    onPress={() => setPickerHour((prev) => (prev + 23) % 24)}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Minus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-3xl my-3">{String(pickerHour).padStart(2, '0')}</Text>
                  <Pressable
                    onPress={() => setPickerHour((prev) => (prev + 1) % 24)}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Plus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
                <Text style={{ color: colors.text.primary }} className="font-bold text-3xl mx-4 mt-7">:</Text>
                <View className="items-center">
                  <Text style={{ color: colors.text.tertiary }} className="text-xs mb-2">Minute</Text>
                  <Pressable
                    onPress={() => setPickerMinute((prev) => (prev + 59) % 60)}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Minus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                  <Text style={{ color: colors.text.primary }} className="font-bold text-3xl my-3">{String(pickerMinute).padStart(2, '0')}</Text>
                  <Pressable
                    onPress={() => setPickerMinute((prev) => (prev + 1) % 60)}
                    className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <Plus size={16} color={colors.text.primary} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              <Text style={{ color: colors.text.secondary }} className="text-center text-sm mt-4">
                {formatTimeDisplay(toTimeString(pickerHour, pickerMinute))}
              </Text>
              <Pressable
                onPress={commitTimePickerValue}
                className="mt-4 w-full py-3 rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: colors.text.primary }}
              >
                <Text style={{ color: colors.bg.primary }} className="font-semibold">Done</Text>
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
