export type UnitType = 'piece' | 'kg' | 'gram' | 'liter' | 'box' | 'pack';

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode: string;
  purchasePrice: number; // سعر الشراء دج
  sellingPrice: number;  // سعر البيع دج
  stockQuantity: number; // الكمية المتوفرة
  unit: UnitType;        // وحدة القياس
  minStockAlert: number; // حد التنبيه
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  barcode: string;
  unit: UnitType;
  unitPrice: number;      // سعر الوحدة دج
  purchasePrice: number;  // سعر الشراء لحساب الربح
  quantity: number;       // الكمية (بالقطع أو بالكيلوغرام/الغرام)
  weightGrams?: number;   // إن تم إدخاله بالغرامات
  total: number;          // quantity * unitPrice
  totalCost: number;      // quantity * purchasePrice
}

export type PaymentMethod = 'cash' | 'credit';
export type SaleStatus = 'completed' | 'returned' | 'cancelled';

export interface Sale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
  totalCost: number;
  profit: number;
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
  status: SaleStatus;
  paidAmount: number;
  remainingDebt: number;
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalDebt: number; // إجمالي الدين المتبقي
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  notes?: string;
  previousDebt: number;
  newDebt: number;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type ExpenseCategory =
  | 'electricity'
  | 'packaging'
  | 'transport'
  | 'rent'
  | 'wages'
  | 'maintenance'
  | 'waste'
  | 'other';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface TrashItem {
  id: string;
  entityType: 'product' | 'sale' | 'customer' | 'expense';
  entityId: string;
  name: string;
  details: string;
  data: any;
  deletedAt: string;
}

export interface StoreInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  currency: string;
  footerMessage: string;
}

export interface CashierTab {
  id: string;
  name: string;
  items: SaleItem[];
  selectedCustomerId?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: number;
}

export interface OutboxItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'product' | 'sale' | 'customer' | 'debtPayment' | 'expense' | 'trashItem' | 'storeInfo';
  data: any;
  timestamp: string;
}
