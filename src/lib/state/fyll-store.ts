import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";
import { storage } from "@/lib/storage";
import { supabaseData } from "@/lib/supabase/data";
import { supabaseSettings } from "@/lib/supabase/settings";

const isDataUri = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().startsWith('data:')
);

const sanitizeProductForWebPersist = (product: Product): Product => ({
  ...product,
  imageUrl: isDataUri(product.imageUrl) ? undefined : product.imageUrl,
  variants: (product.variants ?? []).map((variant) => ({
    ...variant,
    imageUrl: isDataUri(variant.imageUrl) ? undefined : variant.imageUrl,
  })),
});

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

export type ProductType = 'product' | 'service';

export type ServiceVariableType = 'Select' | 'Number' | 'Toggle' | 'Text';
export type ServiceFieldType = 'Text' | 'Date' | 'Time' | 'Number' | 'Price' | 'Select';

export interface ServiceVariableOption {
  value: string;
  amount?: number;
}

export interface ServiceVariable {
  id: string;
  name: string;
  type: ServiceVariableType;
  options?: (string | ServiceVariableOption)[];
  required?: boolean;
  defaultValue?: string;
}

export interface ServiceField {
  id: string;
  label: string;
  type?: ServiceFieldType;
  options?: (string | ServiceVariableOption)[];
  required?: boolean;
  defaultValue?: string;
  value?: string; // legacy fallback
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categories: string[]; // Support multiple categories
  variants: ProductVariant[];
  lowStockThreshold: number;
  createdAt: string;
  productType: ProductType;
  imageUrl?: string; // Optional product image
  createdBy?: string; // Staff name who created the product
  serviceTags?: string[];
  serviceUsesGlobalPricing?: boolean; // true = single service price, false = option-based pricing
  serviceVariables?: ServiceVariable[];
  serviceFields?: ServiceField[];
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

export const formatCurrency = (amount: number | null | undefined, currencyCode: CurrencyCode = 'NGN'): string => {
  const currency = CURRENCIES[currencyCode];
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${currency.symbol}${safeAmount.toLocaleString()}`;
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
  serviceId?: string;
  serviceVariables?: ServiceOrderVariable[];
  serviceFields?: ServiceOrderField[];
}

export interface ServiceOrderVariable {
  id: string;
  name: string;
  type: ServiceVariableType;
  value?: string;
  options?: (string | ServiceVariableOption)[];
  required?: boolean;
}

export interface ServiceOrderField {
  id: string;
  label: string;
  type: ServiceFieldType;
  options?: (string | ServiceVariableOption)[];
  value?: string;
  required?: boolean;
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
  activityLog?: OrderActivityEntry[]; // Trail of all staff activity
}

export interface OrderActivityEntry {
  staffName: string;
  action: string; // e.g. "Created order", "Updated status to Shipped"
  date: string; // ISO string
}

export interface ProcurementItem {
  productId: string;
  variantId: string;
  quantity: number;
  costAtPurchase: number;
  productName?: string;
  variantName?: string;
}

export interface ProcurementAttachment {
  uri: string;
  name: string;
  mimeType?: string;
  storagePath?: string;
  fileSize?: number;
}

export interface Procurement {
  id: string;
  title?: string;
  supplierName: string;
  items: ProcurementItem[];
  totalCost: number;
  notes: string;
  createdAt: string;
  createdBy?: string;
  attachments?: ProcurementAttachment[];
}

export type ExpensePaymentStatus = 'draft' | 'partial' | 'paid';

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdAt: string;
  createdBy?: string; // Staff name who created the expense
  status?: ExpensePaymentStatus;
}

export type ExpenseRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type RefundRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'void';

export interface ExpenseRequestReceipt {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType?: string;
  fileSize?: number;
}

export interface ExpenseRequestLineItem {
  id: string;
  label: string;
  amount: number;
  category: string;
  kind: 'base' | 'charge';
}

export interface RefundRequestAttachment {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType?: string;
  fileSize?: number;
}

export interface ExpenseRequest {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  merchant?: string;
  type: 'one-time' | 'recurring';
  frequency?: string;
  note?: string;
  status: ExpenseRequestStatus;
  submittedByUserId: string;
  submittedByName?: string;
  submittedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  approvedExpenseId?: string;
  receipts?: ExpenseRequestReceipt[];
  lineItems?: ExpenseRequestLineItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  amount: number;
  requestedDate: string;
  reason: string;
  status: RefundRequestStatus;
  refundType: 'full' | 'partial';
  note?: string;
  attachments?: RefundRequestAttachment[];
  proofAttachments?: RefundRequestAttachment[];
  source?: 'order' | 'finance';
  submittedByUserId: string;
  submittedByName?: string;
  submittedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  paidAt?: string;
  paidByUserId?: string;
  paidByName?: string;
  paymentReference?: string;
  applyBankCharges?: boolean;
  bankChargeAmount?: number;
  stampDutyAmount?: number;
  totalDebitAmount?: number;
  voidedAt?: string;
  voidedByUserId?: string;
  voidedByName?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt?: string;
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

export interface FinanceSupplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  paymentTerms?: string;
}

export interface ProcurementStatusOption {
  id: string;
  name: string;
  order: number;
}

export type FixedCostFrequency = 'Monthly' | 'Quarterly' | 'Yearly';

export interface FixedCostSetting {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: FixedCostFrequency;
  supplierName?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BankChargeTier {
  id: string;
  maxAmount: number | null; // null = catch-all "over previous tier"
  fixedFee: number;
}

export interface RevenueRule {
  id: string;
  name: string;        // e.g. "Paystack", "Flutterwave"
  channel: string;     // "All Payment Methods" or matches order.paymentMethod
  percentFee: number;  // e.g. 1.5 means 1.5%
  flatFee: number;     // e.g. 100 means ₦100 flat
  enabled: boolean;
}

export interface FinanceRules {
  vatRate: number; // e.g. 0.075 = 7.5%
  bankChargeTiers: BankChargeTier[];
  revenueRules: RevenueRule[];
  incomingStampDuty: number; // ₦50 bank debit on every incoming credit (CBN stamp duty)
}

export interface OrderAutomationRule {
  id: string;
  enabled: boolean;
  fromStatus: string;
  toStatus: string;
  afterDays: number;
}

export interface AuditLogItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  expectedStock: number;
  actualStock: number;
  discrepancy: number;
}

export interface AuditLog {
  id: string;
  month: number; // 0-11
  year: number;
  itemsAudited: number;
  discrepancies: number;
  completedAt: string;
  performedBy?: string;
  items: AuditLogItem[];
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

// Case Types for FYLL Cases feature
export type CaseType = 'Repair' | 'Replacement' | 'Refund' | 'Partial Refund' | 'Goodwill' | 'Other';
export type CaseStatus = string;
export type CasePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type CaseSource = 'Email' | 'Phone' | 'Chat' | 'Web' | 'In-Store' | 'Other';

// Case timeline entry for audit history
export interface CaseTimelineEntry {
  id: string;
  date: string; // ISO timestamp
  action: string; // e.g., "Status changed to Under Review", "Note added: ..."
  user: string; // Who performed the action
}
export interface CaseAttachment {
  id: string;
  label: string;
  uri: string;
  preview?: string;
  description?: string;
  uploadedAt: string;
}
export interface CaseStatusOption {
  id: string;
  name: string;
  color: string;
  description?: string;
  order?: number;
}

export interface ResolutionTypeOption {
  id: string;
  name: string;
  description?: string;
  order?: number;
}

export type ResolutionType = string;

export interface CaseResolution {
  type: ResolutionType;
  notes: string;
  value?: number; // For refund/credit amount
  resolvedAt: string; // ISO timestamp
  resolvedBy?: string; // Staff name
}

export interface Case {
  id: string;
  caseNumber: string; // Auto-generated like "CASE-001234"
  orderId?: string; // Optional - linked order (standalone cases may not have one)
  orderNumber?: string; // Denormalized for display
  customerId?: string; // Optional - linked customer
  customerName: string; // Denormalized for display
  type: CaseType;
  status: CaseStatus;
  priority?: CasePriority; // Critical, High, Medium, Low
  assignedTo?: string; // Optional staff name assigned to this case
  source?: CaseSource; // Email, Phone, Chat, Web, In-Store, Other
  issueSummary: string; // Short description
  originalCustomerMessage?: string; // Full customer complaint/message
  resolution?: CaseResolution;
  attachments?: CaseAttachment[];
  timeline?: CaseTimelineEntry[]; // Audit history of all actions
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // Staff name who created
  updatedBy?: string; // Staff name who last updated
}

export const CASE_TYPES: CaseType[] = [
  'Repair',
  'Replacement',
  'Refund',
  'Goodwill',
  'Other'
];

export const CASE_PRIORITIES: CasePriority[] = ['Critical', 'High', 'Medium', 'Low'];

export const CASE_PRIORITY_COLORS: Record<CasePriority, string> = {
  'Critical': '#DC2626', // Red
  'High': '#F59E0B', // Amber
  'Medium': '#3B82F6', // Blue
  'Low': '#6B7280', // Gray
};

export const CASE_SOURCES: CaseSource[] = ['Email', 'Phone', 'Chat', 'Web', 'Other'];
export const CASE_STATUS_COLORS: Record<string, string> = {
  'Open': '#3B82F6', // Blue
  'Under Review': '#F59E0B', // Amber
  'Awaiting Customer': '#8B5CF6', // Purple
  'Awaiting Internal Action': '#F97316', // Orange
  'Resolved': '#10B981', // Green
  'Closed': '#6B7280', // Gray
};

export const DEFAULT_CASE_STATUS_OPTIONS: CaseStatusOption[] = [
  {
    id: 'case-status-open',
    name: 'Open',
    color: CASE_STATUS_COLORS['Open'],
    description: 'New cases waiting for review',
    order: 1,
  },
  {
    id: 'case-status-under-review',
    name: 'Under Review',
    color: CASE_STATUS_COLORS['Under Review'],
    description: 'Case is being investigated internally',
    order: 2,
  },
  {
    id: 'case-status-awaiting-customer',
    name: 'Awaiting Customer',
    color: CASE_STATUS_COLORS['Awaiting Customer'],
    description: 'Waiting on customer for more info',
    order: 3,
  },
  {
    id: 'case-status-awaiting-team',
    name: 'Awaiting Internal Action',
    color: CASE_STATUS_COLORS['Awaiting Internal Action'],
    description: 'Requires action from our team',
    order: 4,
  },
  {
    id: 'case-status-resolved',
    name: 'Resolved',
    color: CASE_STATUS_COLORS['Resolved'],
    description: 'Issue has been resolved with customer',
    order: 5,
  },
  {
    id: 'case-status-closed',
    name: 'Closed',
    color: CASE_STATUS_COLORS['Closed'],
    description: 'Case archived or closed after follow-up',
    order: 6,
  },
];

export const RESOLUTION_TYPES: ResolutionType[] = [
  'Refund Issued',
  'Credit Applied',
  'Replacement Sent',
  'Repair Completed',
  'No Action Required',
  'Other'
];

export type UserRole = 'owner' | 'staff';
export type ThemeMode = 'system' | 'light' | 'dark';

interface FyllStore {
  // Sync state
  isBackgroundSyncing: boolean;
  lastDataSyncAt: string | null;
  lastFullDataSyncAt: string | null;
  setIsBackgroundSyncing: (value: boolean) => void;
  setDataSyncTimestamps: (timestamps: { lastDataSyncAt?: string | null; lastFullDataSyncAt?: string | null }) => void;

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

  // Order Auto-Completion
  autoCompleteOrders: boolean;
  autoCompleteAfterDays: number;
  autoCompleteFromStatus: string;
  autoCompleteToStatus: string;
  orderAutomations: OrderAutomationRule[];
  setAutoCompleteOrders: (enabled: boolean) => void;
  setAutoCompleteAfterDays: (days: number) => void;
  setAutoCompleteFromStatus: (status: string) => void;
  setAutoCompleteToStatus: (status: string) => void;
  setOrderAutomations: (rules: OrderAutomationRule[]) => void;
  addOrderAutomation: (rule?: Partial<OrderAutomationRule>) => void;
  updateOrderAutomation: (id: string, updates: Partial<OrderAutomationRule>) => void;
  deleteOrderAutomation: (id: string) => void;

  // Global Categories
  categories: string[];
  addCategory: (category: string) => void;
  updateCategory: (previous: string, next: string) => void;
  deleteCategory: (category: string, businessId?: string | null) => void;
  saveGlobalSettings: (businessId?: string | null) => Promise<{ success: boolean; error?: string }>;

  // Customers (CRM)
  customers: Customer[];
  addCustomer: (customer: Customer, businessId?: string | null) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string, businessId?: string | null) => void;

  // Products
  products: Product[];
  productVariables: ProductVariable[];
  addProduct: (product: Product, businessId?: string | null) => Promise<void>;
  addProductsBulk: (products: Product[], businessId?: string | null) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>, businessId?: string | null) => Promise<void>;
  deleteProduct: (id: string, businessId?: string | null) => Promise<void>;
  addProductVariable: (variable: ProductVariable) => void;
  updateProductVariable: (id: string, variable: Partial<ProductVariable>) => void;
  deleteProductVariable: (id: string, businessId?: string | null) => void;
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
  addOrder: (order: Order, businessId?: string | null) => Promise<void>;
  updateOrder: (id: string, order: Partial<Order>, businessId?: string | null) => Promise<void>;
  deleteOrder: (id: string, businessId?: string | null) => void;
  addOrderStatus: (status: OrderStatus) => void;
  updateOrderStatus: (id: string, status: Partial<OrderStatus>) => void;
  deleteOrderStatus: (id: string, businessId?: string | null) => void;
  addSaleSource: (source: SaleSource) => void;
  updateSaleSource: (id: string, source: Partial<SaleSource>) => void;
  deleteSaleSource: (id: string, businessId?: string | null) => void;

  // Custom Services
  customServices: CustomService[];
  addCustomService: (service: CustomService) => void;
  updateCustomService: (id: string, service: Partial<CustomService>) => void;
  deleteCustomService: (id: string, businessId?: string | null) => void;

  // Payment Methods
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (method: PaymentMethod) => void;
  updatePaymentMethod: (id: string, method: Partial<PaymentMethod>) => void;
  deletePaymentMethod: (id: string, businessId?: string | null) => void;

  // Logistics Carriers
  logisticsCarriers: LogisticsCarrier[];
  addLogisticsCarrier: (carrier: LogisticsCarrier) => void;
  updateLogisticsCarrier: (id: string, carrier: Partial<LogisticsCarrier>) => void;
  deleteLogisticsCarrier: (id: string, businessId?: string | null) => void;

  // Procurement
  procurements: Procurement[];
  addProcurement: (procurement: Procurement, businessId?: string | null) => void;
  updateProcurement: (id: string, procurement: Partial<Procurement>, businessId?: string | null) => void;
  deleteProcurement: (id: string, businessId?: string | null) => void;

  // Expenses
  expenses: Expense[];
  expenseRequests: ExpenseRequest[];
  refundRequests: RefundRequest[];
  expenseCategories: ExpenseCategory[];
  financeSuppliers: FinanceSupplier[];
  procurementStatusOptions: ProcurementStatusOption[];
  fixedCosts: FixedCostSetting[];
  addExpense: (expense: Expense, businessId?: string | null) => void;
  updateExpense: (id: string, expense: Partial<Expense>, businessId?: string | null) => void;
  deleteExpense: (id: string, businessId?: string | null) => void;
  addExpenseRequest: (request: ExpenseRequest, businessId?: string | null) => void;
  updateExpenseRequest: (id: string, updates: Partial<ExpenseRequest>, businessId?: string | null) => void;
  deleteExpenseRequest: (id: string, businessId?: string | null) => void;
  addRefundRequest: (request: RefundRequest, businessId?: string | null) => Promise<void>;
  updateRefundRequest: (id: string, updates: Partial<RefundRequest>, businessId?: string | null) => Promise<void>;
  deleteRefundRequest: (id: string, businessId?: string | null) => Promise<void>;
  addExpenseCategory: (category: ExpenseCategory) => void;
  updateExpenseCategory: (id: string, category: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (id: string, businessId?: string | null) => void;
  addFinanceSupplier: (supplier: FinanceSupplier) => void;
  updateFinanceSupplier: (id: string, supplier: Partial<FinanceSupplier>) => void;
  deleteFinanceSupplier: (id: string) => void;
  addProcurementStatusOption: (status: ProcurementStatusOption) => void;
  updateProcurementStatusOption: (id: string, status: Partial<ProcurementStatusOption>) => void;
  deleteProcurementStatusOption: (id: string) => void;
  addFixedCost: (cost: FixedCostSetting) => void;
  updateFixedCost: (id: string, updates: Partial<FixedCostSetting>) => void;
  deleteFixedCost: (id: string) => void;
  financeRules: FinanceRules;
  updateFinanceRules: (rules: Partial<FinanceRules>) => void;
  addRevenueRule: (rule: RevenueRule) => void;
  updateRevenueRule: (id: string, updates: Partial<RevenueRule>) => void;
  deleteRevenueRule: (id: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (log: AuditLog) => void;
  hasAuditForMonth: (month: number, year: number) => boolean;

  // Cases
  cases: Case[];
  addCase: (caseItem: Case, businessId?: string | null) => Promise<void>;
  updateCase: (id: string, updates: Partial<Case>, businessId?: string | null) => Promise<void>;
  deleteCase: (id: string, businessId?: string | null) => void;
  getCasesForOrder: (orderId: string) => Case[];
  caseStatuses: CaseStatusOption[];
  addCaseStatus: (status: CaseStatusOption) => void;
  updateCaseStatus: (id: string, updates: Partial<CaseStatusOption>) => void;
  deleteCaseStatus: (id: string, businessId?: string | null) => void;

  // Resolution Types
  resolutionTypes: ResolutionTypeOption[];
  addResolutionType: (type: ResolutionTypeOption) => void;
  updateResolutionType: (id: string, updates: Partial<ResolutionTypeOption>) => void;
  deleteResolutionType: (id: string, businessId?: string | null) => void;

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
const initialOrderStatuses: OrderStatus[] = [];

const initialSaleSources: SaleSource[] = [];

export const DEFAULT_EXPENSE_CATEGORY_NAMES: string[] = [
  'Rent & Utilities',
  'Salaries & Wages',
  'Marketing & Ads',
  'Software & Subscriptions',
  'Logistics & Delivery',
  'Inventory Purchases',
  'Procurement',
  'Repairs & Maintenance',
  'Internet & Communication',
  'Bank Charges & Fees',
  'Professional Services',
  'Travel & Transport',
  'Meals & Entertainment',
  'Office Supplies',
  'Insurance',
  'Training & Education',
  'Taxes & Levies',
  'Licenses & Compliance',
  'Equipment',
  'Miscellaneous',
];

const initialExpenseCategories: ExpenseCategory[] = DEFAULT_EXPENSE_CATEGORY_NAMES.map((name, index) => ({
  id: `expense-category-${index + 1}`,
  name,
}));
const initialFinanceSuppliers: FinanceSupplier[] = [];
const initialProcurementStatusOptions: ProcurementStatusOption[] = [
  { id: 'proc-status-draft', name: 'Draft', order: 1 },
  { id: 'proc-status-sent', name: 'Sent', order: 2 },
  { id: 'proc-status-confirmed', name: 'Confirmed', order: 3 },
  { id: 'proc-status-received', name: 'Received', order: 4 },
  { id: 'proc-status-cancelled', name: 'Cancelled', order: 5 },
];
const initialFixedCosts: FixedCostSetting[] = [];

const initialFinanceRules: FinanceRules = {
  vatRate: 0.075,
  bankChargeTiers: [
    { id: 'tier-1', maxAmount: 5000, fixedFee: 10 },
    { id: 'tier-2', maxAmount: 50000, fixedFee: 25 },
    { id: 'tier-3', maxAmount: null, fixedFee: 50 },
  ],
  revenueRules: [],
  incomingStampDuty: 50,
};

const initialCustomServices: CustomService[] = [];

const initialPaymentMethods: PaymentMethod[] = [];

const initialLogisticsCarriers: LogisticsCarrier[] = [];

const initialProductVariables: ProductVariable[] = [];

const initialExpenseRequests: ExpenseRequest[] = [];
const initialRefundRequests: RefundRequest[] = [];

const initialCategories: string[] = [];

const initialState = {
  isBackgroundSyncing: false,
  lastDataSyncAt: null as string | null,
  lastFullDataSyncAt: null as string | null,
  themeMode: 'system' as ThemeMode,
  userRole: 'owner' as UserRole,
  useGlobalLowStockThreshold: false,
  globalLowStockThreshold: 5,
  autoCompleteOrders: false,
  autoCompleteAfterDays: 10,
  autoCompleteFromStatus: '',
  autoCompleteToStatus: '',
  orderAutomations: [] as OrderAutomationRule[],
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
  expenseRequests: initialExpenseRequests,
  refundRequests: initialRefundRequests,
  expenseCategories: initialExpenseCategories,
  financeSuppliers: initialFinanceSuppliers,
  procurementStatusOptions: initialProcurementStatusOptions,
  fixedCosts: initialFixedCosts,
  financeRules: initialFinanceRules,
  auditLogs: [] as AuditLog[],
  restockLogs: [] as RestockLog[],
  cases: [] as Case[],
  caseStatuses: DEFAULT_CASE_STATUS_OPTIONS,
};

const slugify = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const buildCategoryItems = (categories: string[]) => {
  const items = new Map<string, { id: string; name: string }>();
  categories.forEach((category) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    const id = slug || trimmed;
    if (!items.has(id)) {
      items.set(id, { id, name: trimmed });
    }
  });
  return Array.from(items.values());
};

const dedupeByName = <T extends { name: string }>(items: T[]) => {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
};

const normalizeAfterDays = (value: number | undefined) => {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : 10;
};

const normalizeFixedCostFrequency = (value?: string): FixedCostFrequency => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'quarterly') return 'Quarterly';
  if (normalized === 'yearly' || normalized === 'annual') return 'Yearly';
  return 'Monthly';
};

const sanitizeOrderAutomationRule = (
  rule: Partial<OrderAutomationRule> | null | undefined,
  fallbackId: string
): OrderAutomationRule | null => {
  if (!rule) return null;
  const id = String(rule.id ?? fallbackId).trim();
  if (!id) return null;
  return {
    id,
    enabled: rule.enabled ?? true,
    fromStatus: (rule.fromStatus ?? '').trim(),
    toStatus: (rule.toStatus ?? '').trim(),
    afterDays: normalizeAfterDays(rule.afterDays),
  };
};

const sanitizeOrderAutomations = (
  rules: (Partial<OrderAutomationRule> | null | undefined)[]
): OrderAutomationRule[] => {
  const seen = new Set<string>();
  const nextRules: OrderAutomationRule[] = [];
  rules.forEach((rule, index) => {
    const sanitized = sanitizeOrderAutomationRule(rule, `automation-${index + 1}`);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    nextRules.push(sanitized);
  });
  return nextRules;
};

const resolveLegacyAutomationFields = (rules: OrderAutomationRule[]) => {
  const firstRule = rules[0];
  return {
    autoCompleteAfterDays: firstRule?.afterDays ?? 10,
    autoCompleteFromStatus: firstRule?.fromStatus ?? '',
    autoCompleteToStatus: firstRule?.toStatus ?? '',
  };
};

const useFyllStore = create<FyllStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Sync state
      setIsBackgroundSyncing: (value) => set({ isBackgroundSyncing: value }),
      setDataSyncTimestamps: ({ lastDataSyncAt, lastFullDataSyncAt }) => set((state) => ({
        lastDataSyncAt: lastDataSyncAt ?? state.lastDataSyncAt,
        lastFullDataSyncAt: lastFullDataSyncAt ?? state.lastFullDataSyncAt,
      })),

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

      // Order Auto-Completion
      setAutoCompleteOrders: (enabled) => set({ autoCompleteOrders: enabled }),
      setAutoCompleteAfterDays: (days) => set((state) => {
        const nextAfterDays = normalizeAfterDays(days);
        const nextRules = state.orderAutomations.length > 0
          ? state.orderAutomations.map((rule, index) => (
            index === 0 ? { ...rule, afterDays: nextAfterDays } : rule
          ))
          : [{
            id: generateId(),
            enabled: true,
            fromStatus: state.autoCompleteFromStatus,
            toStatus: state.autoCompleteToStatus,
            afterDays: nextAfterDays,
          }];
        return {
          autoCompleteAfterDays: nextAfterDays,
          orderAutomations: nextRules,
        };
      }),
      setAutoCompleteFromStatus: (status) => set((state) => {
        const nextStatus = status.trim();
        const nextRules = state.orderAutomations.length > 0
          ? state.orderAutomations.map((rule, index) => (
            index === 0 ? { ...rule, fromStatus: nextStatus } : rule
          ))
          : [{
            id: generateId(),
            enabled: true,
            fromStatus: nextStatus,
            toStatus: state.autoCompleteToStatus,
            afterDays: normalizeAfterDays(state.autoCompleteAfterDays),
          }];
        return {
          autoCompleteFromStatus: nextStatus,
          orderAutomations: nextRules,
        };
      }),
      setAutoCompleteToStatus: (status) => set((state) => {
        const nextStatus = status.trim();
        const nextRules = state.orderAutomations.length > 0
          ? state.orderAutomations.map((rule, index) => (
            index === 0 ? { ...rule, toStatus: nextStatus } : rule
          ))
          : [{
            id: generateId(),
            enabled: true,
            fromStatus: state.autoCompleteFromStatus,
            toStatus: nextStatus,
            afterDays: normalizeAfterDays(state.autoCompleteAfterDays),
          }];
        return {
          autoCompleteToStatus: nextStatus,
          orderAutomations: nextRules,
        };
      }),
      setOrderAutomations: (rules) => set(() => {
        const nextRules = sanitizeOrderAutomations(rules);
        return {
          ...resolveLegacyAutomationFields(nextRules),
          orderAutomations: nextRules,
        };
      }),
      addOrderAutomation: (rule) => set((state) => {
        const nextRule = sanitizeOrderAutomationRule({
          id: rule?.id ?? generateId(),
          enabled: rule?.enabled ?? true,
          fromStatus: rule?.fromStatus ?? '',
          toStatus: rule?.toStatus ?? '',
          afterDays: rule?.afterDays ?? state.autoCompleteAfterDays,
        }, generateId());
        if (!nextRule) return {};
        const nextRules = [...state.orderAutomations, nextRule];
        return {
          ...resolveLegacyAutomationFields(nextRules),
          orderAutomations: nextRules,
        };
      }),
      updateOrderAutomation: (id, updates) => set((state) => {
        const nextRules = state.orderAutomations.map((rule) => (
          rule.id === id
            ? (sanitizeOrderAutomationRule({ ...rule, ...updates, id: rule.id }, rule.id) ?? rule)
            : rule
        ));
        return {
          ...resolveLegacyAutomationFields(nextRules),
          orderAutomations: nextRules,
        };
      }),
      deleteOrderAutomation: (id) => set((state) => {
        const nextRules = state.orderAutomations.filter((rule) => rule.id !== id);
        return {
          ...resolveLegacyAutomationFields(nextRules),
          orderAutomations: nextRules,
        };
      }),

      // Global Categories
      addCategory: (category) => {
        const current = get().categories;
        const normalized = category.trim();
        if (!normalized) return;
        const exists = current.some((existing) => existing.trim().toLowerCase() === normalized.toLowerCase());
        if (!exists) {
          set({ categories: [...current, normalized] });
        }
      },
      updateCategory: (previous, next) => {
        const trimmedNext = next.trim();
        if (!trimmedNext) return;
        const normalizedNext = trimmedNext.toLowerCase();
        const nextCategories = get().categories
          .map((category) => (category === previous ? trimmedNext : category))
          .filter((category, index, list) => list.findIndex(
            (item) => item.trim().toLowerCase() === category.trim().toLowerCase()
          ) === index);
        if (nextCategories.some((category) => category.trim().toLowerCase() === normalizedNext)) {
          set({ categories: nextCategories });
          return;
        }
        set({ categories: nextCategories });
      },
      deleteCategory: (category, businessId) => {
        set({ categories: get().categories.filter((c) => c !== category) });
        if (!businessId) return;
        const slug = slugify(category.trim());
        const id = slug || category.trim();
        supabaseSettings
          .deleteSettings('product_categories', businessId, [id])
          .catch((error) => console.warn('Supabase category delete failed:', error));
      },
      saveGlobalSettings: async (businessId) => {
        if (!businessId) {
          return { success: false, error: 'No business selected.' };
        }

        try {
          const state = get();
          const orderStatuses = dedupeByName(state.orderStatuses ?? []).filter((status) => status.name.trim());
          const saleSources = dedupeByName(state.saleSources ?? []).filter((source) => source.name.trim());
          const customServices = dedupeByName(state.customServices ?? []).filter((service) => service.name.trim());
          const paymentMethods = dedupeByName(state.paymentMethods ?? []).filter((method) => method.name.trim());
          const logisticsCarriers = dedupeByName(state.logisticsCarriers ?? []).filter((carrier) => carrier.name.trim());
          const productVariables = dedupeByName(state.productVariables ?? []).filter((variable) => variable.name.trim());
          const expenseCategories = dedupeByName(state.expenseCategories ?? []).filter((category) => category.name.trim());
          const financeSuppliers = dedupeByName(state.financeSuppliers ?? []).filter((supplier) => supplier.name.trim());
          const procurementStatusOptions = dedupeByName(state.procurementStatusOptions ?? [])
            .filter((status) => status.name.trim())
            .sort((a, b) => a.order - b.order)
            .map((status, index) => ({ ...status, order: index + 1 }));
          const fixedCosts = (state.fixedCosts ?? [])
            .filter((cost) => (
              cost.id.trim()
              && cost.name.trim()
              && cost.category.trim()
              && Number.isFinite(cost.amount)
              && cost.amount > 0
            ))
            .map((cost) => ({
              ...cost,
              name: cost.name.trim(),
              category: cost.category.trim(),
              amount: Number(cost.amount),
              frequency: normalizeFixedCostFrequency(cost.frequency),
              supplierName: cost.supplierName?.trim() ?? '',
              notes: cost.notes?.trim() ?? '',
              createdAt: cost.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          const normalizedProcurementStatusOptions = procurementStatusOptions.length > 0
            ? procurementStatusOptions
            : initialProcurementStatusOptions;
          const caseStatuses = dedupeByName(state.caseStatuses ?? []).filter((status) => status.name.trim());
          const categories = (state.categories ?? []).filter((category) => category.trim());
          const categoryItems = buildCategoryItems(categories);
          const categoryNames = categoryItems.map((item) => item.name);
          const sanitizedOrderAutomations = sanitizeOrderAutomations(state.orderAutomations ?? []);
          const shouldUseLegacyFallback = Boolean(
            state.autoCompleteFromStatus.trim() || state.autoCompleteToStatus.trim()
          );
          const fallbackOrderAutomation = shouldUseLegacyFallback
            ? sanitizeOrderAutomationRule({
              id: 'automation-legacy',
              enabled: true,
              fromStatus: state.autoCompleteFromStatus,
              toStatus: state.autoCompleteToStatus,
              afterDays: state.autoCompleteAfterDays,
            }, 'automation-legacy')
            : null;
          const orderAutomations = sanitizedOrderAutomations.length > 0
            ? sanitizedOrderAutomations
            : (fallbackOrderAutomation ? [fallbackOrderAutomation] : []);
          const legacyAutomation = resolveLegacyAutomationFields(orderAutomations);
          const businessSettings = [{
            id: 'global',
            useGlobalLowStockThreshold: state.useGlobalLowStockThreshold ?? false,
            globalLowStockThreshold: state.globalLowStockThreshold ?? 0,
            autoCompleteOrders: state.autoCompleteOrders ?? false,
            autoCompleteAfterDays: legacyAutomation.autoCompleteAfterDays,
            autoCompleteFromStatus: legacyAutomation.autoCompleteFromStatus,
            autoCompleteToStatus: legacyAutomation.autoCompleteToStatus,
            orderAutomations,
            financeSuppliers,
            procurementStatusOptions: normalizedProcurementStatusOptions,
            fixedCosts,
            financeRules: state.financeRules,
          }];

          set({
            orderStatuses,
            saleSources,
            customServices,
            paymentMethods,
            logisticsCarriers,
            productVariables,
            expenseCategories,
            financeSuppliers,
            procurementStatusOptions: normalizedProcurementStatusOptions,
            fixedCosts,
            caseStatuses,
            categories: categoryNames,
            orderAutomations,
            autoCompleteAfterDays: legacyAutomation.autoCompleteAfterDays,
            autoCompleteFromStatus: legacyAutomation.autoCompleteFromStatus,
            autoCompleteToStatus: legacyAutomation.autoCompleteToStatus,
          });

          const syncTable = async <T extends { id: string }>(table: string, items: T[]) => {
            const existing = await supabaseSettings.fetchSettings<{ id: string }>(table, businessId);
            const existingIds = existing.map((row) => row.id);
            const nextIds = new Set(items.map((item) => item.id));
            const removed = existingIds.filter((id) => !nextIds.has(id));

            if (items.length === 0 && existingIds.length > 0) {
              console.warn(`🛡️ Blocked bulk deletion of ALL rows in ${table} during settings save`);
              return;
            }

            await supabaseSettings.upsertSettings(table, businessId, items);
            await supabaseSettings.deleteSettings(table, businessId, removed);
          };

          await Promise.all([
            syncTable('order_statuses', orderStatuses),
            syncTable('sale_sources', saleSources),
            syncTable('custom_services', customServices),
            syncTable('payment_methods', paymentMethods),
            syncTable('logistics_carriers', logisticsCarriers),
            syncTable('product_variables', productVariables),
            syncTable('expense_categories', expenseCategories),
            syncTable('case_statuses', caseStatuses),
            syncTable('product_categories', categoryItems),
            supabaseSettings.upsertSettings('business_settings', businessId, businessSettings),
          ]);

          return { success: true };
        } catch (err) {
          console.warn('Global settings save failed:', err);
          return { success: false, error: 'Failed to sync settings.' };
        }
      },

      // Customers (CRM)
      addCustomer: async (customer, businessId) => {
        set({ customers: [...get().customers, customer] });
        if (businessId) {
          supabaseData
            .upsertCollection('customers', businessId, [customer])
            .catch((error) => console.warn('Supabase customer add failed:', error));
        }
      },
      updateCustomer: (id, updates) => set({
        customers: get().customers.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteCustomer: (id, businessId) => {
        // Update local state immediately
        set({ customers: get().customers.filter((c) => c.id !== id) });

        if (!businessId) return;
        supabaseData
          .deleteByIds('customers', businessId, [id])
          .catch((error) => console.warn('Supabase customer delete failed:', error));
      },

      // Products
      addProduct: async (product, businessId) => {
        console.log('➕ Adding product:', product.name, 'ID:', product.id);

        // Update local state immediately
        set({ products: [...get().products, product] });

        if (businessId) {
          supabaseData
            .upsertCollection('products', businessId, [product])
            .catch((error) => console.warn('Supabase product create failed:', error));
        }
      },
      addProductsBulk: async (productsToAdd, businessId) => {
        if (!productsToAdd.length) return;

        const existing = get().products;
        set({ products: [...existing, ...productsToAdd] });

        if (businessId) {
          supabaseData
            .upsertCollection('products', businessId, productsToAdd)
            .catch((error) => console.warn('Supabase product bulk create failed:', error));
        }
      },
      updateProduct: async (id, updates, businessId) => {
        // Update local state immediately
        set({
          products: get().products.map((p) => p.id === id ? { ...p, ...updates } : p),
        });

        if (businessId) {
          const updated = get().products.find((p) => p.id === id);
          if (updated) {
            supabaseData
              .upsertCollection('products', businessId, [updated])
              .catch((error) => console.warn('Supabase product update failed:', error));
          }
        }
      },
      deleteProduct: async (id, businessId) => {
        // Update local state immediately
        set({ products: get().products.filter((p) => p.id !== id) });

        if (businessId) {
          supabaseData
            .deleteByIds('products', businessId, [id])
            .catch((error) => console.warn('Supabase product delete failed:', error));
        }
      },
      addProductVariable: (variable) => set({ productVariables: [...get().productVariables, variable] }),
      updateProductVariable: (id, updates) => set({
        productVariables: get().productVariables.map((v) => v.id === id ? { ...v, ...updates } : v),
      }),
      deleteProductVariable: (id, businessId) => {
        set({ productVariables: get().productVariables.filter((v) => v.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('product_variables', businessId, [id])
          .catch((error) => console.warn('Supabase product variable delete failed:', error));
      },
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
      addOrder: async (order, businessId) => {
        const previousOrders = get().orders;
        set({ orders: [...previousOrders, order] });
        if (!businessId) {
          throw new Error('No business selected for order sync.');
        }
        try {
          await supabaseData.upsertCollection('orders', businessId, [order]);
        } catch (error) {
          set({ orders: previousOrders });
          console.warn('Supabase order add failed:', error);
          throw error;
        }
      },
      updateOrder: async (id, updates, businessId) => {
        set({
          orders: get().orders.map((o) => {
            if (o.id !== id) return o;
            const merged = { ...o, ...updates, updatedAt: new Date().toISOString() };
            // Auto-append to activity log when updatedBy is provided
            if (updates.updatedBy) {
              // Determine what was updated to create a specific action message
              let action = '';
              if (updates.status && updates.status !== o.status) {
                action = `Updated status to ${updates.status}`;
              } else if (updates.logistics) {
                action = 'Updated logistics';
              } else if (updates.prescription) {
                action = 'Updated prescription';
              } else if (updates.refund) {
                action = 'Processed refund';
              } else if (updates.customerName || updates.customerPhone || updates.deliveryAddress || updates.deliveryState) {
                action = 'Updated customer details';
              } else if (updates.items) {
                action = 'Updated order items';
              } else {
                // Fallback for other updates (notes, payment, etc.)
                action = 'Updated order';
              }

              const entry: OrderActivityEntry = {
                staffName: updates.updatedBy,
                action,
                date: new Date().toISOString(),
              };
              merged.activityLog = [...(o.activityLog || []), entry];
            }
            return merged;
          }),
        });
        if (businessId) {
          const updated = get().orders.find((o) => o.id === id);
          if (updated) {
            supabaseData
              .upsertCollection('orders', businessId, [updated])
              .catch((error) => console.warn('Supabase order update failed:', error));
          }
        }
      },
      deleteOrder: (id, businessId) => {
        // Update local state immediately
        set({ orders: get().orders.filter((o) => o.id !== id) });

        if (!businessId) return;
        supabaseData
          .deleteByIds('orders', businessId, [id])
          .catch((error) => console.warn('Supabase order delete failed:', error));
      },
      addOrderStatus: (status) => set({ orderStatuses: [...get().orderStatuses, status] }),
      updateOrderStatus: (id, updates) => set({
        orderStatuses: get().orderStatuses.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteOrderStatus: (id, businessId) => {
        set({ orderStatuses: get().orderStatuses.filter((s) => s.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('order_statuses', businessId, [id])
          .catch((error) => console.warn('Supabase order status delete failed:', error));
      },
      addSaleSource: (source) => set({ saleSources: [...get().saleSources, source] }),
      updateSaleSource: (id, updates) => set({
        saleSources: get().saleSources.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteSaleSource: (id, businessId) => {
        set({ saleSources: get().saleSources.filter((s) => s.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('sale_sources', businessId, [id])
          .catch((error) => console.warn('Supabase sale source delete failed:', error));
      },

      // Custom Services
      addCustomService: (service) => set({ customServices: [...get().customServices, service] }),
      updateCustomService: (id, updates) => set({
        customServices: get().customServices.map((s) => s.id === id ? { ...s, ...updates } : s),
      }),
      deleteCustomService: (id, businessId) => {
        set({ customServices: get().customServices.filter((s) => s.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('custom_services', businessId, [id])
          .catch((error) => console.warn('Supabase custom service delete failed:', error));
      },

      // Payment Methods
      addPaymentMethod: (method) => set({ paymentMethods: [...get().paymentMethods, method] }),
      updatePaymentMethod: (id, updates) => set({
        paymentMethods: get().paymentMethods.map((m) => m.id === id ? { ...m, ...updates } : m),
      }),
      deletePaymentMethod: (id, businessId) => {
        set({ paymentMethods: get().paymentMethods.filter((m) => m.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('payment_methods', businessId, [id])
          .catch((error) => console.warn('Supabase payment method delete failed:', error));
      },

      // Logistics Carriers
      addLogisticsCarrier: (carrier) => set({ logisticsCarriers: [...get().logisticsCarriers, carrier] }),
      updateLogisticsCarrier: (id, updates) => set({
        logisticsCarriers: get().logisticsCarriers.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteLogisticsCarrier: (id, businessId) => {
        set({ logisticsCarriers: get().logisticsCarriers.filter((c) => c.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('logistics_carriers', businessId, [id])
          .catch((error) => console.warn('Supabase logistics carrier delete failed:', error));
      },

      // Procurement
      addProcurement: (procurement, businessId) => {
        set({ procurements: [...get().procurements, procurement] });
        if (!businessId) return;
        supabaseData
          .upsertCollection('procurements', businessId, [procurement])
          .catch((error) => console.warn('Supabase procurement add failed:', error));
      },
      updateProcurement: (id, updates, businessId) => {
        set({
          procurements: get().procurements.map((p) => p.id === id ? { ...p, ...updates } : p),
        });
        if (!businessId) return;
        const updated = get().procurements.find((p) => p.id === id);
        if (!updated) return;
        supabaseData
          .upsertCollection('procurements', businessId, [updated])
          .catch((error) => console.warn('Supabase procurement update failed:', error));
      },
      deleteProcurement: (id, businessId) => {
        set({ procurements: get().procurements.filter((p) => p.id !== id) });
        if (!businessId) return;
        supabaseData
          .deleteByIds('procurements', businessId, [id])
          .catch((error) => console.warn('Supabase procurement delete failed:', error));
      },

      // Expenses
      addExpense: (expense, businessId) => {
        set({ expenses: [...get().expenses, expense] });
        if (!businessId) return;
        supabaseData
          .upsertCollection('expenses', businessId, [expense])
          .catch((error) => console.warn('Supabase expense add failed:', error));
      },
      updateExpense: (id, updates, businessId) => {
        set({
          expenses: get().expenses.map((e) => e.id === id ? { ...e, ...updates } : e),
        });
        if (!businessId) return;
        const updated = get().expenses.find((e) => e.id === id);
        if (!updated) return;
        supabaseData
          .upsertCollection('expenses', businessId, [updated])
          .catch((error) => console.warn('Supabase expense update failed:', error));
      },
      deleteExpense: (id, businessId) => {
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
        if (!businessId) return;
        supabaseData
          .deleteByIds('expenses', businessId, [id])
          .catch((error) => console.warn('Supabase expense delete failed:', error));
      },
      addExpenseRequest: (request, businessId) => {
        set({ expenseRequests: [...get().expenseRequests, request] });
        if (!businessId) return;
        supabaseData
          .upsertCollection('expense_requests', businessId, [request])
          .catch((error) => console.warn('Supabase expense request add failed:', error));
      },
      updateExpenseRequest: (id, updates, businessId) => {
        set({
          expenseRequests: get().expenseRequests.map((request) => (
            request.id === id
              ? { ...request, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() }
              : request
          )),
        });
        if (!businessId) return;
        const updated = get().expenseRequests.find((request) => request.id === id);
        if (!updated) return;
        supabaseData
          .upsertCollection('expense_requests', businessId, [updated])
          .catch((error) => console.warn('Supabase expense request update failed:', error));
      },
      deleteExpenseRequest: (id, businessId) => {
        set({ expenseRequests: get().expenseRequests.filter((request) => request.id !== id) });
        if (!businessId) return;
        supabaseData
          .deleteByIds('expense_requests', businessId, [id])
          .catch((error) => console.warn('Supabase expense request delete failed:', error));
      },
      addRefundRequest: async (request, businessId) => {
        const previousRefundRequests = get().refundRequests;
        set({ refundRequests: [...previousRefundRequests, request] });
        if (!businessId) return;
        try {
          await supabaseData.upsertCollection('refund_requests', businessId, [request]);
        } catch (error) {
          set({ refundRequests: previousRefundRequests });
          console.warn('Supabase refund request add failed:', error);
          throw error;
        }
      },
      updateRefundRequest: async (id, updates, businessId) => {
        const previousRefundRequests = get().refundRequests;
        const nextRefundRequests = previousRefundRequests.map((request) => (
          request.id === id
            ? { ...request, ...updates, updatedAt: updates.updatedAt ?? new Date().toISOString() }
            : request
        ));
        set({ refundRequests: nextRefundRequests });
        if (!businessId) return;
        const updated = nextRefundRequests.find((request) => request.id === id);
        if (!updated) return;
        try {
          await supabaseData.upsertCollection('refund_requests', businessId, [updated]);
        } catch (error) {
          set({ refundRequests: previousRefundRequests });
          console.warn('Supabase refund request update failed:', error);
          throw error;
        }
      },
      deleteRefundRequest: async (id, businessId) => {
        const previousRefundRequests = get().refundRequests;
        set({ refundRequests: previousRefundRequests.filter((request) => request.id !== id) });
        if (!businessId) return;
        try {
          await supabaseData.deleteByIds('refund_requests', businessId, [id]);
        } catch (error) {
          set({ refundRequests: previousRefundRequests });
          console.warn('Supabase refund request delete failed:', error);
          throw error;
        }
      },
      addExpenseCategory: (category) => set({ expenseCategories: [...get().expenseCategories, category] }),
      updateExpenseCategory: (id, updates) => set({
        expenseCategories: get().expenseCategories.map((c) => c.id === id ? { ...c, ...updates } : c),
      }),
      deleteExpenseCategory: (id, businessId) => {
        set({ expenseCategories: get().expenseCategories.filter((c) => c.id !== id) });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('expense_categories', businessId, [id])
          .catch((error) => console.warn('Supabase expense category delete failed:', error));
      },
      addFinanceSupplier: (supplier) => set({
        financeSuppliers: dedupeByName([...get().financeSuppliers, supplier]),
      }),
      updateFinanceSupplier: (id, updates) => set({
        financeSuppliers: get().financeSuppliers.map((supplier) => (
          supplier.id === id ? { ...supplier, ...updates } : supplier
        )),
      }),
      deleteFinanceSupplier: (id) => {
        set({ financeSuppliers: get().financeSuppliers.filter((supplier) => supplier.id !== id) });
      },
      addProcurementStatusOption: (status) => set({
        procurementStatusOptions: dedupeByName([...get().procurementStatusOptions, status])
          .sort((a, b) => a.order - b.order)
          .map((option, index) => ({ ...option, order: index + 1 })),
      }),
      updateProcurementStatusOption: (id, updates) => set({
        procurementStatusOptions: get().procurementStatusOptions
          .map((option) => (option.id === id ? { ...option, ...updates } : option))
          .sort((a, b) => a.order - b.order)
          .map((option, index) => ({ ...option, order: index + 1 })),
      }),
      deleteProcurementStatusOption: (id) => {
        set({
          procurementStatusOptions: get().procurementStatusOptions
            .filter((option) => option.id !== id)
            .sort((a, b) => a.order - b.order)
            .map((option, index) => ({ ...option, order: index + 1 })),
        });
      },
      addFixedCost: (cost) => set({
        fixedCosts: [...get().fixedCosts.filter((item) => item.id !== cost.id), cost],
      }),
      updateFixedCost: (id, updates) => set({
        fixedCosts: get().fixedCosts.map((cost) => (
          cost.id === id ? { ...cost, ...updates, updatedAt: new Date().toISOString() } : cost
        )),
      }),
      deleteFixedCost: (id) => {
        set({ fixedCosts: get().fixedCosts.filter((cost) => cost.id !== id) });
      },
      updateFinanceRules: (rules) => set({ financeRules: { ...get().financeRules, ...rules } }),
      addRevenueRule: (rule) => set({ financeRules: { ...get().financeRules, revenueRules: [...(get().financeRules.revenueRules ?? []), rule] } }),
      updateRevenueRule: (id, updates) => set({ financeRules: { ...get().financeRules, revenueRules: (get().financeRules.revenueRules ?? []).map((r) => r.id === id ? { ...r, ...updates } : r) } }),
      deleteRevenueRule: (id) => set({ financeRules: { ...get().financeRules, revenueRules: (get().financeRules.revenueRules ?? []).filter((r) => r.id !== id) } }),

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

      caseStatuses: DEFAULT_CASE_STATUS_OPTIONS,
      addCaseStatus: (status) => {
        const normalizedName = status.name.trim();
        if (!normalizedName) return;
        const normalizedStatus: CaseStatusOption = {
          ...status,
          name: normalizedName,
          color: status.color || '#6B7280',
          description: status.description?.trim(),
        };
        set({
          caseStatuses: [...get().caseStatuses, normalizedStatus],
        });
      },
      updateCaseStatus: (id, updates) => {
        set({
          caseStatuses: get().caseStatuses.map((existing) => (
            existing.id === id
              ? {
                ...existing,
                ...updates,
                name: updates.name?.trim() ?? existing.name,
                color: updates.color ?? existing.color,
                description: updates.description ?? existing.description,
              }
              : existing
          )),
        });
      },
      deleteCaseStatus: (id, businessId) => {
        const currentStatuses = get().caseStatuses;
        const removedStatus = currentStatuses.find((status) => status.id === id);
        if (!removedStatus) return;
        const remainingStatuses = currentStatuses.filter((status) => status.id !== id);
        const fallbackStatus = remainingStatuses[0]?.name ?? removedStatus.name ?? 'Open';
        set({
          caseStatuses: remainingStatuses,
          cases: get().cases.map((c) =>
            c.status === removedStatus.name ? { ...c, status: fallbackStatus } : c
          ),
        });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('case_statuses', businessId, [id])
          .catch((error) => console.warn('Supabase case status delete failed:', error));
      },

      // Resolution Types
      resolutionTypes: [
        { id: 'rt-1', name: 'Refund Issued', order: 1 },
        { id: 'rt-2', name: 'Credit Applied', order: 2 },
        { id: 'rt-3', name: 'Replacement Sent', order: 3 },
        { id: 'rt-4', name: 'Repair Completed', order: 4 },
        { id: 'rt-5', name: 'No Action Required', order: 5 },
        { id: 'rt-6', name: 'Other', order: 6 },
      ],
      addResolutionType: (type) => {
        set({ resolutionTypes: [...get().resolutionTypes, type] });
      },
      updateResolutionType: (id, updates) => {
        set({
          resolutionTypes: get().resolutionTypes.map((rt) =>
            rt.id === id
              ? {
                ...rt,
                ...updates,
                name: updates.name?.trim() ?? rt.name,
                description: updates.description ?? rt.description,
              }
              : rt
          ),
        });
      },
      deleteResolutionType: (id, businessId) => {
        const current = get().resolutionTypes;
        const removed = current.find((rt) => rt.id === id);
        if (!removed) return;
        const remaining = current.filter((rt) => rt.id !== id);
        const fallback = remaining[0]?.name ?? 'Other';
        set({
          resolutionTypes: remaining,
          cases: get().cases.map((c) =>
            c.resolution?.type === removed.name
              ? { ...c, resolution: { ...c.resolution, type: fallback } }
              : c
          ),
        });
        if (!businessId) return;
        supabaseSettings
          .deleteSettings('resolution_types', businessId, [id])
          .catch((error) => console.warn('Supabase resolution type delete failed:', error));
      },

      // Cases
      addCase: async (caseItem, businessId) => {
        const previousCases = get().cases;
        set({ cases: [...previousCases, caseItem] });
        if (!businessId) {
          throw new Error('No business selected for case sync.');
        }
        try {
          await supabaseData.upsertCollection('cases', businessId, [caseItem]);
        } catch (error) {
          set({ cases: previousCases });
          console.warn('Supabase case add failed:', error);
          throw error;
        }
      },

      updateCase: async (id, updates, businessId) => {
        set({
          cases: get().cases.map((c) => {
            if (c.id !== id) return c;
            const merged = { ...c, ...updates, updatedAt: new Date().toISOString() };

            // If timeline was explicitly provided in updates, use it as-is
            if (updates.timeline) {
              merged.timeline = updates.timeline;
            } else if (updates.updatedBy) {
              // Auto-append to timeline when updatedBy is provided but no explicit timeline
              const changes: string[] = [];
              if (updates.status && updates.status !== c.status) {
                changes.push(`Status → ${updates.status}`);
              }
              if (updates.priority && updates.priority !== c.priority) {
                changes.push(`Priority → ${updates.priority}`);
              }
              if (updates.assignedTo && updates.assignedTo !== c.assignedTo) {
                changes.push(`Assigned to ${updates.assignedTo}`);
              }
              if (updates.resolution && !c.resolution) {
                changes.push(`Resolution added: ${updates.resolution.type}`);
              }
              if (updates.type && updates.type !== c.type) {
                changes.push(`Type → ${updates.type}`);
              }
              if (updates.customerName && updates.customerName !== c.customerName) {
                changes.push(`Customer → ${updates.customerName}`);
              }
              if (updates.issueSummary && updates.issueSummary !== c.issueSummary) {
                changes.push('Issue summary updated');
              }
              if (updates.source && updates.source !== c.source) {
                changes.push(`Source → ${updates.source}`);
              }
              const action = changes.length > 0 ? changes.join(', ') : 'Case details updated';

              const timelineEntry: CaseTimelineEntry = {
                id: Math.random().toString(36).substring(2, 15),
                date: new Date().toISOString(),
                action,
                user: updates.updatedBy,
              };
              merged.timeline = [...(c.timeline || []), timelineEntry];
            }
            return merged;
          }),
        });
        if (businessId) {
          const updated = get().cases.find((c) => c.id === id);
          if (updated) {
            supabaseData
              .upsertCollection('cases', businessId, [updated])
              .catch((error) => console.warn('Supabase case update failed:', error));
          }
        }
      },

      deleteCase: (id, businessId) => {
        set({ cases: get().cases.filter((c) => c.id !== id) });
        if (!businessId) return;
        supabaseData
          .deleteByIds('cases', businessId, [id])
          .catch((error) => console.warn('Supabase case delete failed:', error));
      },

      getCasesForOrder: (orderId) => {
        return get().cases.filter((c) => c.orderId === orderId);
      },

      // Reset
      resetStore: () => set(initialState),
    }),
    {
      name: "fyll-storage",
      storage: createJSONStorage(() => storage),
      partialize: (state) => {
          const base = {
            themeMode: state.themeMode,
            userRole: state.userRole,
            lastDataSyncAt: state.lastDataSyncAt,
            lastFullDataSyncAt: state.lastFullDataSyncAt,
          useGlobalLowStockThreshold: state.useGlobalLowStockThreshold,
          globalLowStockThreshold: state.globalLowStockThreshold,
          autoCompleteOrders: state.autoCompleteOrders,
          autoCompleteAfterDays: state.autoCompleteAfterDays,
          autoCompleteFromStatus: state.autoCompleteFromStatus,
          autoCompleteToStatus: state.autoCompleteToStatus,
          orderAutomations: state.orderAutomations,
          categories: state.categories,
          customers: state.customers,
          products: state.products,
          orders: state.orders,
          restockLogs: state.restockLogs,
          procurements: state.procurements,
          expenses: state.expenses,
          expenseRequests: state.expenseRequests,
          refundRequests: state.refundRequests,
          cases: state.cases,
          productVariables: state.productVariables,
          orderStatuses: state.orderStatuses,
          saleSources: state.saleSources,
          customServices: state.customServices,
          paymentMethods: state.paymentMethods,
          logisticsCarriers: state.logisticsCarriers,
          expenseCategories: state.expenseCategories,
          financeSuppliers: state.financeSuppliers,
          procurementStatusOptions: state.procurementStatusOptions,
          fixedCosts: state.fixedCosts,
          financeRules: state.financeRules,
          auditLogs: state.auditLogs,
          caseStatuses: state.caseStatuses,
        };

        if (Platform.OS !== 'web') return base;

        return {
          ...base,
          products: state.products.map((product) => sanitizeProductForWebPersist(product)),
        };
      },
    }
  )
);

// Helper functions
export const generateProductId = generateId;
export const generateVariantBarcode = generateBarcode;
export const generateOrderNumber = () => `ORD-${String(Date.now()).slice(-6)}`;
export const generateCaseNumber = () => `CASE-${String(Date.now()).slice(-6)}`;
export const generateCaseId = generateId;

export default useFyllStore;
