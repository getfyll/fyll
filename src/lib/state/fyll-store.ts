import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storage } from "@/lib/storage";
import { productService, orderService, customerService } from "@/lib/firebase";

// Nigeria States
export const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Types
export interface ProductVariable {
  id: string;
  name: string; // e.g., "Color", "Size", "Material"
  values: string[]; // e.g., ["Gold", "Silver", "Matte Black"]
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode: string;
  variableValues: Record<string, string>; // e.g., { "Color": "Gold" }
  stock: number;
  sellingPrice: number;
  imageUrl?: string; // Optional variant-specific image
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categories: string[]; // Support multiple categories
  variants: ProductVariant[];
  lowStockThreshold: number;
  createdAt: string;
  imageUrl?: string; // Optional product image
  createdBy?: string; // Staff name who created the product
  // New Design tracking
  isNewDesign?: boolean; // Default false
  designYear?: number; // Default current year when isNewDesign is true
  designLaunchedAt?: string; // Auto-set when isNewDesign is first toggled ON
  // Discontinued tracking
  isDiscontinued?: boolean; // Default false - hide from New Order picker when true
  discontinuedAt?: string; // Auto-set when isDiscontinued is first toggled ON
}

// Currency settings
export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP';

export interface CurrencySettings {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencySettings> = {
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
};

export const formatCurrency = (amount: number, currencyCode: CurrencyCode = 'NGN'): string => {
  const currency = CURRENCIES[currencyCode];
  return `${currency.symbol}${amount.toLocaleString()}`;
};

// Custom Service for orders
export interface CustomService {
  id: string;
  name: string;
  defaultPrice: number;
}

// Order Service item
export interface OrderService {
  serviceId: string;
  name: string;
  price: number;
}

// Payment Method
export interface PaymentMethod {
  id: string;
  name: string;
}

// Logistics Carrier
export interface LogisticsCarrier {
  id: string;
  name: string;
}

// Logistics Info for order
export interface LogisticsInfo {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  dispatchDate: string;
  datePickedUp?: string; // Date Picked Up/Shipped
}

// Customer for CRM
export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  defaultAddress: string;
  defaultState: string;
  createdAt: string;
}

// Refund for orders
export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  date: string;
  reason: string;
  proofImageUri?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

// Prescription info for orders (internal only)
export interface PrescriptionInfo {
  fileUrl?: string; // Uploaded prescription image/PDF URL
  text?: string; // Manual prescription text entry
  uploadedAt?: string; // Timestamp when prescription was added
  uploadedBy?: string; // User ID/name who uploaded
}

export interface Order {
  id: string;
  orderNumber: string;
  websiteOrderReference?: string; // WooCommerce order reference (e.g. WC #10234)
  customerId?: string; // Link to Customer
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryState: string;
  deliveryAddress: string;
  items: OrderItem[];
  services: OrderService[];
  additionalCharges: number;
  additionalChargesNote: string;
  deliveryFee: number;
  discountCode?: string; // Discount/promo code applied
  discountAmount?: number; // Discount amount
  paymentMethod: string;
  logistics?: LogisticsInfo;
  prescription?: PrescriptionInfo; // Prescription details (internal)
  status: string;
  source: string; // WhatsApp, Instagram, etc.
  subtotal: number; // Products only
  totalAmount: number; // Grand total
  refund?: Refund; // Refund info if refunded
  orderDate: string; // ISO string - the date the order was placed (for stats/grouping)
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // Staff name who created the order
  updatedBy?: string; // Staff name who last updated the order
}

export interface ProcurementItem {
  productId: string;
  variantId: string;
  quantity: number;
  costAtPurchase: number;
}

export interface Procurement {
  id: string;
  supplierName: string;
  items: ProcurementItem[];
  totalCost: number;
  notes: string;
  createdAt: string;
  createdBy?: string; // Staff name who created the procurement
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdAt: string;
  createdBy?: string; // Staff name who created the expense
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface SaleSource {
  id: string;
  name: string;
  icon: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface AuditLog {
  id: string;
  month: number; // 0-11
  year: number;
  itemsAudited: number;
  discrepancies: number;
  completedAt: string;
}

export interface RestockLog {
  id: string;
  productId: string;
  variantId: string;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  timestamp: string;
  performedBy?: string;
}

export type UserRole = 'owner' | 'staff';
export type ThemeMode = 'light' | 'dark';

interface FyllStore {
  // Theme
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // User
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  // Global Low Stock Threshold
  useGlobalLowStockThreshold: boolean;
  globalLowStockThreshold: number;
  setUseGlobalLowStockThreshold: (use: boolean) => void;
  setGlobalLowStockThreshold: (threshold: number) => void;
  getEffectiveLowStockThreshold: (product: Product) => number;

  // Global Categories
  categories: string[];
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;

  // Customers (CRM)
  customers: Customer[];
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Products
  products: Product[];
  productVariables: ProductVariable[];
  addProduct: (product: Product, businessId?: string | null) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>, businessId?: string | null) => Promise<void>;
  deleteProduct: (id: string, businessId?: string | null) => Promise<void>;
  addProductVariable: (variable: ProductVariable) => void;
  updateProductVariable: (id: string, variable: Partial<ProductVariable>) => void;
  deleteProductVariable: (id: string) => void;
  updateVariantStock: (productId: string, variantId: string, delta: number) => void;
  addProductVariant: (productId: string, variant: ProductVariant) => void;
  updateProductVariant: (productId: string, variantId: string, variant: Partial<ProductVariant>) => void;
  deleteProductVariant: (productId: string, variantId: string) => void;

  // Restock Logs
  restockLogs: RestockLog[];
  addRestockLog: (log: Omit<RestockLog, 'id' | 'timestamp'>) => void;
  getRestockLogsForVariant: (productId: string, variantId: string, limit?: number) => RestockLog[];
  restockVariant: (productId: string, variantId: string, quantity: number, performedBy?: string) => void;

  // Orders
  orders: Order[];
  orderStatuses: OrderStatus[];
  saleSources: SaleSource[];
  addOrder: (order: Order) => void;
  updateOrder: (id: string, order: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  addOrderStatus: (status: OrderStatus) => void;
  updateOrderStatus: (id: string, status: Partial<OrderStatus>) => void;
  deleteOrderStatus: (id: string) => void;
  addSaleSource: (source: SaleSource) => void;
  updateSaleSource: (id: string, source: Partial<SaleSource>) => void;
  deleteSaleSource: (id: string) => void;

  // Custom Services
  customServices: CustomService[];
  addCustomService: (service: CustomService) => void;
  updateCustomService: (id: string, service: Partial<CustomService>) => void;
  deleteCustomService: (id: string) => void;

  // Payment Methods
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (method: PaymentMethod) => void;
  updatePaymentMethod: (id: string, method: Partial<PaymentMethod>) => void;
  deletePaymentMethod: (id: string) => void;

  // Logistics Carriers
  logisticsCarriers: LogisticsCarrier[];
  addLogisticsCarrier: (carrier: LogisticsCarrier) => void;
  updateLogisticsCarrier: (id: string, carrier: Partial<LogisticsCarrier>) => void;
  deleteLogisticsCarrier: (id: string) => void;

  // Procurement
  procurements: Procurement[];
  addProcurement: (procurement: Procurement) => void;
  updateProcurement: (id: string, procurement: Partial<Procurement>) => void;
  deleteProcurement: (id: string) => void;

  // Expenses
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addExpenseCategory: (category: ExpenseCategory) => void;
  updateExpenseCategory: (id: string, category: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (id: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (log: AuditLog) => void;
  hasAuditForMonth: (month: number, year: number) => boolean;

  // Reset
  resetStore: () => void;
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Generate barcode
const generateBarcode = () => {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
};

// Initial Mint Eyewear Data
const initialOrderStatuses: OrderStatus[] = [
  { id: '0', name: 'Processing', color: '#3B82F6', order: 0 },
  { id: '1', name: 'Prescription Needed', color: '#F59E0B', order: 1 },
  { id: '2', name: 'Lab Processing', color: '#8B5CF6', order: 2 },
  { id: '3', name: 'Quality Check', color: '#111111', order: 3 },
  { id: '4', name: 'Ready for Pickup', color: '#10B981', order: 4 },
  { id: '5', name: 'Delivered', color: '#059669', order: 5 },
  { id: '6', name: 'Refunded', color: '#EF4444', order: 6 },
];

const initialSaleSources: SaleSource[] = [
  { id: '1', name: 'WhatsApp', icon: 'message-circle' },
  { id: '2', name: 'Instagram', icon: 'instagram' },
  { id: '3', name: 'Website', icon: 'globe' },
  { id: '4', name: 'Physical Store', icon: 'store' },
];

const initialExpenseCategories: ExpenseCategory[] = [
  { id: '1', name: 'Rent' },
  { id: '2', name: 'Power' },
  { id: '3', name: 'Marketing' },
  { id: '4', name: 'Supplies' },
  { id: '5', name: 'Salaries' },
];

const initialCustomServices: CustomService[] = [
  { id: '1', name: 'Lens Coating', defaultPrice: 5000 },
  { id: '2', name: 'Express Delivery', defaultPrice: 3000 },
  { id: '3', name: 'Frame Adjustment', defaultPrice: 1500 },
  { id: '4', name: 'Anti-Scratch Protection', defaultPrice: 2500 },
];

const initialPaymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Bank Transfer' },
  { id: '2', name: 'Website Payment' },
  { id: '3', name: 'POS' },
  { id: '4', name: 'Cash' },
];

const initialLogisticsCarriers: LogisticsCarrier[] = [
  { id: '1', name: 'GIG Logistics' },
  { id: '2', name: 'DHL' },
  { id: '3', name: 'FedEx' },
  { id: '4', name: 'GIGL' },
  { id: '5', name: 'Kwik Delivery' },
];

const initialProductVariables: ProductVariable[] = [
  { id: '1', name: 'Color', values: ['Gold', 'Silver', 'Matte Black'] },
];

const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Aviator 1.0',
    description: 'Classic aviator sunglasses with premium finish',
    categories: ['Sunglasses'],
    lowStockThreshold: 5,
    createdAt: new Date().toISOString(),
    variants: [
      { id: '1-1', sku: 'AV1-GOLD', barcode: generateBarcode(), variableValues: { Color: 'Gold' }, stock: 15, sellingPrice: 129000 },
      { id: '1-2', sku: 'AV1-SILV', barcode: generateBarcode(), variableValues: { Color: 'Silver' }, stock: 12, sellingPrice: 129000 },
      { id: '1-3', sku: 'AV1-MBLK', barcode: generateBarcode(), variableValues: { Color: 'Matte Black' }, stock: 8, sellingPrice: 139000 },
    ],
  },
  {
    id: '2',
    name: 'Wayfarer Classic',
    description: 'Timeless wayfarer design for everyday wear',
    categories: ['Sunglasses'],
    lowStockThreshold: 5,
    createdAt: new Date().toISOString(),
    variants: [
      { id: '2-1', sku: 'WFC-GOLD', barcode: generateBarcode(), variableValues: { Color: 'Gold' }, stock: 20, sellingPrice: 99000 },
      { id: '2-2', sku: 'WFC-SILV', barcode: generateBarcode(), variableValues: { Color: 'Silver' }, stock: 3, sellingPrice: 99000 },
      { id: '2-3', sku: 'WFC-MBLK', barcode: generateBarcode(), variableValues: { Color: 'Matte Black' }, stock: 18, sellingPrice: 109000 },
    ],
  },
];

const initialOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-001',
    customerName: 'Adaeze Okonkwo',
    customerEmail: 'adaeze@email.com',
    customerPhone: '+234 803 555 0101',
    deliveryState: 'Lagos',
    deliveryAddress: '15 Admiralty Way, Lekki Phase 1, Lagos',
    items: [{ productId: '1', variantId: '1-1', quantity: 1, unitPrice: 129000 }],
    services: [],
    additionalCharges: 0,
    additionalChargesNote: '',
    deliveryFee: 2500,
    paymentMethod: 'Bank Transfer',
    status: 'Lab Processing',
    source: 'Instagram',
    subtotal: 129000,
    totalAmount: 131500,
    orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    orderNumber: 'ORD-002',
    customerName: 'Chinedu Eze',
    customerEmail: 'chinedu@email.com',
    customerPhone: '+234 805 555 0102',
    deliveryState: 'Abuja',
    deliveryAddress: '23 Gana Street, Maitama, FCT',
    items: [
      { productId: '2', variantId: '2-3', quantity: 2, unitPrice: 109000 },
      { productId: '1', variantId: '1-2', quantity: 1, unitPrice: 129000 },
    ],
    services: [{ serviceId: '1', name: 'Lens Coating', price: 5000 }],
    additionalCharges: 0,
    additionalChargesNote: '',
    deliveryFee: 3500,
    paymentMethod: 'POS',
    status: 'Ready for Pickup',
    source: 'WhatsApp',
    subtotal: 347000,
    totalAmount: 355500,
    orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    orderNumber: 'ORD-003',
    customerName: 'Funke Adeyemi',
    customerEmail: 'funke@email.com',
    customerPhone: '+234 812 555 0103',
    deliveryState: 'Rivers',
    deliveryAddress: '7 Aba Road, Port Harcourt, Rivers',
    items: [{ productId: '1', variantId: '1-3', quantity: 1, unitPrice: 139000 }],
    services: [],
    additionalCharges: 0,
    additionalChargesNote: '',
    deliveryFee: 4000,
    paymentMethod: 'Website Payment',
    logistics: {
      carrierId: '1',
      carrierName: 'GIG Logistics',
      trackingNumber: 'GIG-2024-001234',
      dispatchDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
    status: 'Delivered',
    source: 'Website',
    subtotal: 139000,
    totalAmount: 143000,
    orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const initialProcurements: Procurement[] = [
  {
    id: '1',
    supplierName: 'Premium Optics Co.',
    items: [
      { productId: '1', variantId: '1-1', quantity: 20, costAtPurchase: 42 },
      { productId: '1', variantId: '1-2', quantity: 15, costAtPurchase: 42 },
    ],
    totalCost: 1470,
    notes: 'Initial stock order',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const initialExpenses: Expense[] = [
  { id: '1', category: 'Rent', description: 'Monthly store rent', amount: 250000, date: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: '2', category: 'Marketing', description: 'Instagram ads campaign', amount: 45000, date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() },
  { id: '3', category: 'Power', description: 'Electricity bill', amount: 18000, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() },
];

const initialCategories: string[] = ['Sunglasses', 'Optical', 'Accessories'];

const initialState = {
  themeMode: 'light' as ThemeMode,
  userRole: 'owner' as UserRole,
  useGlobalLowStockThreshold: false,
  globalLowStockThreshold: 5,
  categories: initialCategories,
  customers: [] as Customer[],
  products: [] as Product[],
  productVariables: initialProductVariables,
  orders: [] as Order[],
  orderStatuses: initialOrderStatuses,
  saleSources: initialSaleSources,
  customServices: initialCustomServices,
  paymentMethods: initialPaymentMethods,
  logisticsCarriers: initialLogisticsCarriers,
  procurements: [] as Procurement[],
  expenses: [] as Expense[],
  expenseCategories: initialExpenseCategories,
  auditLogs: [] as AuditLog[],
  restockLogs: [] as RestockLog[],
};

const useFyllStore = create<FyllStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Theme
      setThemeMode: (mode) => set({ themeMode: mode }),

      // User
      setUserRole: (role) => set({ userRole: role }),

      // Global Low Stock Threshold
      setUseGlobalLowStockThreshold: (use) => set({ useGlobalLowStockThreshold: use }),
      setGlobalLowStockThreshold: (threshold) => set({ globalLowStockThreshold: threshold }),
      getEffectiveLowStockThreshold: (product) => {
        const state = get();
        return state.useGlobalLowStockThreshold ? state.globalLowStockThreshold : product.lowStockThreshold;
      },

      // Global Categories
      addCategory: (category) => {
        const current = get().categories;
        if (!current.includes(category)) {
          set({ categories: [...current, category] });
        }
      },
      deleteCategory: (category) => set({ categories: get().categories.filter((c) => c !== category) }),

      // Customers (CRM)
      addCustomer: (customer) => set({ customers: [...get().customers, customer] }),
      updateCustomer: (id, updates) => set({
        customers: get().customers.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteCustomer: (id) => set({ customers: get().customers.filter((c) => c.id !== id) }),

      // Products
      addProduct: async (product, businessId) => {
        // Update local state immediately
        set({ products: [...get().products, product] });

        // Save to Firebase if businessId is provided
        if (businessId) {
          try {
            await productService.createProduct(businessId, product);
            console.log('✅ Product saved to Firebase:', product.id);
          } catch (error) {
            console.error('❌ Failed to save product to Firebase:', error);
          }
        }
      },
      updateProduct: async (id, updates, businessId) => {
        // Update local state immediately
        set({
          products: get().products.map((p) => p.id === id ? { ...p, ...updates } : p),
        });

        // Update in Firebase if businessId is provided
        if (businessId) {
          try {
            await productService.updateProduct(businessId, id, updates);
            console.log('✅ Product updated in Firebase:', id);
          } catch (error) {
            console.error('❌ Failed to update product in Firebase:', error);
          }
        }
      },
      deleteProduct: async (id, businessId) => {
        // Update local state immediately
        set({ products: get().products.filter((p) => p.id !== id) });

        // Delete from Firebase if businessId is provided
        if (businessId) {
          try {
            await productService.deleteProduct(businessId, id);
            console.log('✅ Product deleted from Firebase:', id);
          } catch (error) {
            console.error('❌ Failed to delete product from Firebase:', error);
          }
        }
      },
      addProductVariable: (variable) => set({ productVariables: [...get().productVariables, variable] }),
      updateProductVariable: (id, updates) => set({
        productVariables: get().productVariables.map((v) => v.id === id ? { ...v, ...updates } : v),
      }),
      deleteProductVariable: (id) => set({ productVariables: get().productVariables.filter((v) => v.id !== id) }),
      updateVariantStock: (productId, variantId, delta) => set({
        products: get().products.map((p) =>
          p.id === productId
            ? {
                ...p,
                variants: p.variants.map((v) =>
                  v.id === variantId ? { ...v, stock: Math.max(0, v.stock + delta) } : v
                ),
              }
            : p
        ),
      }),

      addProductVariant: (productId, variant) => set({
        products: get().products.map((p) =>
          p.id === productId
            ? { ...p, variants: [...p.variants, variant] }
            : p
        ),
      }),

      updateProductVariant: (productId, variantId, updates) => set({
        products: get().products.map((p) =>
          p.id === productId
            ? {
                ...p,
                variants: p.variants.map((v) =>
                  v.id === variantId ? { ...v, ...updates } : v
                ),
              }
            : p
        ),
      }),

      deleteProductVariant: (productId, variantId) => set({
        products: get().products.map((p) =>
          p.id === productId
            ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) }
            : p
        ),
      }),

      // Orders
      addOrder: (order) => set({ orders: [...get().orders, order] }),
      updateOrder: (id, updates) => set({
        orders: get().orders.map((o) => o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o),
      }),
      deleteOrder: (id) => set({ orders: get().orders.filter((o) => o.id !== id) }),
      addOrderStatus: (status) => set({ orderStatuses: [...get().orderStatuses, status] }),
      updateOrderStatus: (id, updates) => set({
        orderStatuses: get().orderStatuses.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteOrderStatus: (id) => set({ orderStatuses: get().orderStatuses.filter((s) => s.id !== id) }),
      addSaleSource: (source) => set({ saleSources: [...get().saleSources, source] }),
      updateSaleSource: (id, updates) => set({
        saleSources: get().saleSources.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteSaleSource: (id) => set({ saleSources: get().saleSources.filter((s) => s.id !== id) }),

      // Custom Services
      addCustomService: (service) => set({ customServices: [...get().customServices, service] }),
      updateCustomService: (id, updates) => set({
        customServices: get().customServices.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteCustomService: (id) => set({ customServices: get().customServices.filter((s) => s.id !== id) }),

      // Payment Methods
      addPaymentMethod: (method) => set({ paymentMethods: [...get().paymentMethods, method] }),
      updatePaymentMethod: (id, updates) => set({
        paymentMethods: get().paymentMethods.map((m) => m.id === id ? { ...m, ...updates } : m),
      }),
      deletePaymentMethod: (id) => set({ paymentMethods: get().paymentMethods.filter((m) => m.id !== id) }),

      // Logistics Carriers
      addLogisticsCarrier: (carrier) => set({ logisticsCarriers: [...get().logisticsCarriers, carrier] }),
      updateLogisticsCarrier: (id, updates) => set({
        logisticsCarriers: get().logisticsCarriers.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteLogisticsCarrier: (id) => set({ logisticsCarriers: get().logisticsCarriers.filter((c) => c.id !== id) }),

      // Procurement
      addProcurement: (procurement) => set({ procurements: [...get().procurements, procurement] }),
      updateProcurement: (id, updates) => set({
        procurements: get().procurements.map((p) => p.id === id ? { ...p, ...updates } : p),
      }),
      deleteProcurement: (id) => set({ procurements: get().procurements.filter((p) => p.id !== id) }),

      // Expenses
      addExpense: (expense) => set({ expenses: [...get().expenses, expense] }),
      updateExpense: (id, updates) => set({
        expenses: get().expenses.map((e) => e.id === id ? { ...e, ...updates } : e),
      }),
      deleteExpense: (id) => set({ expenses: get().expenses.filter((e) => e.id !== id) }),
      addExpenseCategory: (category) => set({ expenseCategories: [...get().expenseCategories, category] }),
      updateExpenseCategory: (id, updates) => set({
        expenseCategories: get().expenseCategories.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteExpenseCategory: (id) => set({ expenseCategories: get().expenseCategories.filter((c) => c.id !== id) }),

      // Audit Logs
      addAuditLog: (log) => set({ auditLogs: [...get().auditLogs, log] }),
      hasAuditForMonth: (month, year) => {
        return get().auditLogs.some((log) => log.month === month && log.year === year);
      },

      // Restock Logs
      addRestockLog: (log) => set({
        restockLogs: [...get().restockLogs, {
          ...log,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }],
      }),

      getRestockLogsForVariant: (productId, variantId, limit = 10) => {
        return get().restockLogs
          .filter((log) => log.productId === productId && log.variantId === variantId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);
      },

      restockVariant: (productId, variantId, quantity, performedBy) => {
        const { products, restockLogs } = get();
        const product = products.find((p) => p.id === productId);
        const variant = product?.variants.find((v) => v.id === variantId);

        if (!product || !variant || quantity <= 0) return;

        const previousStock = variant.stock;
        const newStock = previousStock + quantity;

        // Update the stock
        set({
          products: products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  variants: p.variants.map((v) =>
                    v.id === variantId ? { ...v, stock: newStock } : v
                  ),
                }
              : p
          ),
          // Add restock log
          restockLogs: [...restockLogs, {
            id: generateId(),
            productId,
            variantId,
            quantityAdded: quantity,
            previousStock,
            newStock,
            timestamp: new Date().toISOString(),
            performedBy,
          }],
        });
      },

      // Reset
      resetStore: () => set(initialState),
    }),
    {
      name: "fyll-storage",
      storage: createJSONStorage(() => storage),
    }
  )
);

// Helper functions
export const generateProductId = generateId;
export const generateVariantBarcode = generateBarcode;
export const generateOrderNumber = () => `ORD-${String(Date.now()).slice(-6)}`;

export default useFyllStore;
