import {
  Customer,
  DebtPayment,
  Expense,
  OutboxItem,
  Product,
  Sale,
  SaleItem,
  StoreInfo,
  TrashItem,
} from '../types';
import { calculateItemCost, calculateItemTotal } from './formatters';

const STORAGE_KEY_PREFIX = 'elhanaa_pos_';

export interface LocalState {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  debtPayments: DebtPayment[];
  expenses: Expense[];
  trashItems: TrashItem[];
  storeInfo: StoreInfo;
  shopKey: string;
  outboxQueue: OutboxItem[];
  lastSyncTimestamp: string;
  version: number;
}

const DEFAULT_STORE_INFO: StoreInfo = {
  name: 'سوبيرات الهناء',
  tagline: 'تسيير المحل ونقاط البيع',
  address: 'الجزائر العاصمة',
  phone: '0550 00 00 00',
  currency: 'دج',
  footerMessage: 'شكرًا لزيارتكم سوبيرات الهناء - نتشرف بخدمتكم دائمًا!',
};

class StorageService {
  private memoryState: LocalState;

  constructor() {
    this.memoryState = this.loadFromDisk();
  }

  private loadFromDisk(): LocalState {
    if (typeof window === 'undefined') return this.getEmptyState();

    const readJson = <T,>(key: string, fallback: T, isValid: (value: any) => boolean): T => {
      const storageKey = STORAGE_KEY_PREFIX + key;
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed as T;
        throw new Error('Unexpected stored data shape');
      } catch (error) {
        // Keep the original bytes for manual recovery; do not discard other collections.
        try { localStorage.setItem(storageKey + '.corruptBackup', raw); } catch (backupError) {
          console.error(`Could not preserve damaged local data for ${key}:`, backupError);
        }
        console.error(`Invalid local data for ${key}; using a safe in-memory fallback. Original data was preserved.`, error);
        return fallback;
      }
    };

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pairKeyFromUrl = urlParams.get('pair') || urlParams.get('shop_key');
      if (pairKeyFromUrl) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'shopKey', pairKeyFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const products = readJson<Product[]>('products', [], Array.isArray);
      const sales = readJson<Sale[]>('sales', [], Array.isArray);
      const customers = readJson<Customer[]>('customers', [], Array.isArray);
      const debtPayments = readJson<DebtPayment[]>('debtPayments', [], Array.isArray);
      const expenses = readJson<Expense[]>('expenses', [], Array.isArray);
      const trashItems = readJson<TrashItem[]>('trashItems', [], Array.isArray);
      const storeInfo = readJson<StoreInfo>('storeInfo', { ...DEFAULT_STORE_INFO }, value => !!value && typeof value === 'object' && !Array.isArray(value));
      const outboxQueue = readJson<OutboxItem[]>('outboxQueue', [], Array.isArray);
      const shopKey = localStorage.getItem(STORAGE_KEY_PREFIX + 'shopKey') || '';
      const lastSyncTimestamp = localStorage.getItem(STORAGE_KEY_PREFIX + 'lastSyncTimestamp') || '';
      const parsedVersion = Number.parseInt(localStorage.getItem(STORAGE_KEY_PREFIX + 'version') || '1', 10);

      return {
        products, sales, customers, debtPayments, expenses, trashItems,
        storeInfo: { ...DEFAULT_STORE_INFO, ...storeInfo },
        shopKey, outboxQueue, lastSyncTimestamp,
        version: Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1,
      };
    } catch (error) {
      // Storage access itself may be blocked; this does not erase browser data.
      console.error('Failed to access local storage; using temporary in-memory state:', error);
      return this.getEmptyState();
    }
  }

  private getEmptyState(): LocalState {
    return {
      products: [],
      sales: [],
      customers: [],
      debtPayments: [],
      expenses: [],
      trashItems: [],
      storeInfo: DEFAULT_STORE_INFO,
      shopKey: '',
      outboxQueue: [],
      lastSyncTimestamp: '',
      version: 1,
    };
  }

  private persist(key: keyof LocalState, value: any) {
    if (typeof window === 'undefined') return;
    try {
      if (typeof value === 'string' || typeof value === 'number') {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, String(value));
      } else {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
      }
    } catch (e) {
      console.error(`Persist error for ${key}:`, e);
    }
  }

  public getState(): LocalState {
    return this.memoryState;
  }

  public createStateSnapshot(): string {
    return JSON.stringify(this.memoryState);
  }

  public restoreStateSnapshot(snapshot: string): void {
    const restored = JSON.parse(snapshot) as LocalState;
    this.memoryState = restored;
    (Object.keys(restored) as (keyof LocalState)[]).forEach(key => this.persist(key, restored[key]));
  }

  public restoreBackupData(data: Parameters<StorageService['applyServerSync']>[0]): void {
    this.applyServerSync(data);
    const state = this.memoryState;
    for (const item of data.products || []) this.queueOutbox('update', 'product', item);
    for (const item of data.sales || []) this.queueOutbox('update', 'sale', item);
    for (const item of data.customers || []) this.queueOutbox('update', 'customer', item);
    for (const item of data.debtPayments || []) this.queueOutbox('update', 'debtPayment', item);
    for (const item of data.expenses || []) this.queueOutbox('update', 'expense', item);
    for (const item of data.trashItems || []) this.queueOutbox('update', 'trashItem', item);
    if (data.storeInfo) this.queueOutbox('update', 'storeInfo', state.storeInfo);
  }

  public setShopKey(key: string) {
    this.memoryState.shopKey = key;
    this.persist('shopKey', key);
  }

  public getShopKey(): string {
    return this.memoryState.shopKey;
  }

  public updateStoreInfo(info: Partial<StoreInfo>) {
    this.memoryState.storeInfo = { ...this.memoryState.storeInfo, ...info };
    this.persist('storeInfo', this.memoryState.storeInfo);
    this.queueOutbox('update', 'storeInfo', this.memoryState.storeInfo);
  }

  // --- Products ---

  public getProducts(includeDeleted = false): Product[] {
    if (includeDeleted) return this.memoryState.products;
    return this.memoryState.products.filter(p => !p.isDeleted);
  }

  public findProductByBarcode(barcode: string): Product | undefined {
    const clean = barcode.trim();
    if (!clean) return undefined;
    return this.getProducts().find(p => p.barcode === clean);
  }

  public saveProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Product {
    const now = new Date().toISOString();
    let product: Product;

    if (productData.id) {
      // update
      const existingIdx = this.memoryState.products.findIndex(p => p.id === productData.id);
      if (existingIdx >= 0) {
        product = {
          ...this.memoryState.products[existingIdx],
          ...productData,
          id: productData.id,
          updatedAt: now,
        };
        this.memoryState.products[existingIdx] = product;
      } else {
        product = {
          ...productData,
          id: productData.id,
          createdAt: now,
          updatedAt: now,
        };
        this.memoryState.products.push(product);
      }
    } else {
      // create new
      product = {
        ...productData,
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        createdAt: now,
        updatedAt: now,
      };
      this.memoryState.products.push(product);
    }

    this.persist('products', this.memoryState.products);
    this.queueOutbox('update', 'product', product);
    return product;
  }

  /**
   * Replenish stock when new shipment arrives, with optional purchase price update
   */
  public replenishProductStock(productId: string, addedQuantity: number, newPurchasePrice?: number): Product | undefined {
    const product = this.memoryState.products.find(p => p.id === productId && !p.isDeleted);
    if (!product || !Number.isFinite(addedQuantity) || addedQuantity <= 0 ||
        (newPurchasePrice !== undefined && (!Number.isFinite(newPurchasePrice) || newPurchasePrice <= 0))) return undefined;

    const now = new Date().toISOString();
    product.stockQuantity = Math.round((product.stockQuantity + addedQuantity) * 1000) / 1000;
    if (newPurchasePrice !== undefined && newPurchasePrice > 0) {
      product.purchasePrice = newPurchasePrice;
    }
    product.updatedAt = now;

    this.persist('products', this.memoryState.products);
    this.queueOutbox('update', 'product', product);
    return product;
  }

  public softDeleteProduct(productId: string): boolean {
    const product = this.memoryState.products.find(p => p.id === productId);
    if (!product) return false;

    const now = new Date().toISOString();
    product.isDeleted = true;
    product.deletedAt = now;
    product.updatedAt = now;

    // Add to trash
    const trashItem: TrashItem = {
      id: 'trash_' + Date.now(),
      entityType: 'product',
      entityId: product.id,
      name: product.name,
      details: `الباركود: ${product.barcode || 'بدون'} | المخزون: ${product.stockQuantity} ${product.unit}`,
      data: { ...product },
      deletedAt: now,
    };
    this.memoryState.trashItems.unshift(trashItem);

    this.persist('products', this.memoryState.products);
    this.persist('trashItems', this.memoryState.trashItems);
    this.queueOutbox('update', 'product', product);
    this.queueOutbox('create', 'trashItem', trashItem);
    return true;
  }

  // --- Sales ---

  public getSales(includeDeleted = false): Sale[] {
    if (includeDeleted) return this.memoryState.sales;
    return this.memoryState.sales.filter(s => !s.isDeleted);
  }

  /**
   * Record a new POS sale
   * - Deducts stock for each sold item
   * - Computes line items, totals, profit
   * - If on credit, updates customer totalDebt
   */
  public createSale(params: {
    items: SaleItem[];
    paymentMethod: 'cash' | 'credit';
    customerId?: string;
    customerName?: string;
    notes?: string;
  }): Sale {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new Error('لا يمكن إتمام فاتورة فارغة.');
    }
    if (params.paymentMethod === 'credit' && !params.customerId) {
      throw new Error('يجب اختيار زبون عند تسجيل البيع بالدين.');
    }

    // Validate the complete cart before changing any stock or customer balance.
    const requiredByProduct = new Map<string, number>();
    for (const item of params.items) {
      if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) || item.unitPrice < 0 ||
          !Number.isFinite(item.purchasePrice) || item.purchasePrice < 0) {
        throw new Error(`بيانات السلعة غير صالحة: ${item.name || item.productId || 'غير معروف'}`);
      }
      const product = this.memoryState.products.find(p => p.id === item.productId && !p.isDeleted);
      if (!product) throw new Error(`السلعة غير موجودة أو محذوفة: ${item.name}`);
      if (item.unit !== product.unit || !Number.isFinite(product.stockQuantity) || product.stockQuantity < 0) {
        throw new Error(`بيانات المخزون أو وحدة القياس غير صالحة للسلعة: ${product.name}`);
      }
      requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + item.quantity);
    }

    for (const [productId, required] of requiredByProduct) {
      const product = this.memoryState.products.find(p => p.id === productId)!;
      if (required - product.stockQuantity > 0.000001) {
        throw new Error(`المخزون غير كافٍ للسلعة «${product.name}». المتوفر: ${product.stockQuantity} ${product.unit}، المطلوب: ${required} ${product.unit}.`);
      }
    }

    if (params.paymentMethod === 'credit') {
      const customer = this.memoryState.customers.find(c => c.id === params.customerId && !c.isDeleted);
      if (!customer) throw new Error('الزبون المحدد غير موجود أو محذوف.');
    }

    const now = new Date().toISOString();
    const invoiceNumber = `INV-${now.replace(/[-:T.Z]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    let subtotal = 0;
    let totalCost = 0;

    const processedItems: SaleItem[] = params.items.map(item => {
      const lineTotal = calculateItemTotal(item.unitPrice, item.quantity);
      const lineCost = calculateItemCost(item.purchasePrice, item.quantity);
      subtotal += lineTotal;
      totalCost += lineCost;
      return { ...item, total: lineTotal, totalCost: lineCost };
    });

    // Apply stock deductions only after every cart line has passed validation.
    for (const [productId, required] of requiredByProduct) {
      const product = this.memoryState.products.find(p => p.id === productId)!;
      product.stockQuantity = Math.round((product.stockQuantity - required) * 1000) / 1000;
      product.updatedAt = now;
      this.queueOutbox('update', 'product', product);
    }

    const total = Math.round(subtotal * 100) / 100;
    const roundedCost = Math.round(totalCost * 100) / 100;
    const profit = Math.round((total - roundedCost) * 100) / 100;
    const isCredit = params.paymentMethod === 'credit';
    const customer = isCredit ? this.memoryState.customers.find(c => c.id === params.customerId)! : undefined;
    if (customer) {
      customer.totalDebt = Math.round((customer.totalDebt + total) * 100) / 100;
      customer.updatedAt = now;
      this.persist('customers', this.memoryState.customers);
      this.queueOutbox('update', 'customer', customer);
    }

    const sale: Sale = {
      id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      invoiceNumber,
      createdAt: now,
      updatedAt: now,
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      total,
      totalCost: roundedCost,
      profit,
      paymentMethod: params.paymentMethod,
      customerId: params.customerId,
      customerName: params.customerName || customer?.name,
      status: 'completed',
      paidAmount: isCredit ? 0 : total,
      remainingDebt: isCredit ? total : 0,
      notes: params.notes,
    };

    this.memoryState.sales.unshift(sale);
    this.persist('sales', this.memoryState.sales);
    this.persist('products', this.memoryState.products);
    this.queueOutbox('create', 'sale', sale);
    return sale;
  }

  /**
   * Return or cancel an invoice:
   * - Re-adds items to stock
   * - If credit, reduces customer debt
   * - Updates status to 'returned' or 'cancelled'
   */
  public returnOrCancelSale(saleId: string, isFullCancel: boolean = false): Sale | undefined {
    const sale = this.memoryState.sales.find(s => s.id === saleId);
    if (!sale || sale.status !== 'completed') return undefined;

    const now = new Date().toISOString();

    // Re-stock all items
    for (const item of sale.items) {
      const prod = this.memoryState.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stockQuantity = Math.round((prod.stockQuantity + item.quantity) * 1000) / 1000;
        prod.updatedAt = now;
        this.queueOutbox('update', 'product', prod);
      }
    }

    // Adjust debt if it was credit
    if (sale.paymentMethod === 'credit' && sale.customerId) {
      const customer = this.memoryState.customers.find(c => c.id === sale.customerId);
      if (customer) {
        customer.totalDebt = Math.max(0, Math.round((customer.totalDebt - sale.total) * 100) / 100);
        customer.updatedAt = now;
        this.persist('customers', this.memoryState.customers);
        this.queueOutbox('update', 'customer', customer);
      }
    }

    sale.status = isFullCancel ? 'cancelled' : 'returned';
    sale.updatedAt = now;

    this.persist('sales', this.memoryState.sales);
    this.persist('products', this.memoryState.products);
    this.queueOutbox('update', 'sale', sale);

    return sale;
  }

  // --- Customers & Debts ---

  public getCustomers(includeDeleted = false): Customer[] {
    if (includeDeleted) return this.memoryState.customers;
    return this.memoryState.customers.filter(c => !c.isDeleted);
  }

  public saveCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalDebt'> & { id?: string; totalDebt?: number }): Customer {
    const now = new Date().toISOString();
    let customer: Customer;

    if (customerData.id) {
      const idx = this.memoryState.customers.findIndex(c => c.id === customerData.id);
      if (idx >= 0) {
        customer = {
          ...this.memoryState.customers[idx],
          ...customerData,
          updatedAt: now,
        };
        this.memoryState.customers[idx] = customer;
      } else {
        customer = {
          id: customerData.id,
          name: customerData.name,
          phone: customerData.phone || '',
          totalDebt: customerData.totalDebt || 0,
          notes: customerData.notes || '',
          createdAt: now,
          updatedAt: now,
        };
        this.memoryState.customers.push(customer);
      }
    } else {
      customer = {
        id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: customerData.name,
        phone: customerData.phone || '',
        totalDebt: customerData.totalDebt || 0,
        notes: customerData.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      this.memoryState.customers.push(customer);
    }

    this.persist('customers', this.memoryState.customers);
    this.queueOutbox('update', 'customer', customer);
    return customer;
  }

  public softDeleteCustomer(customerId: string): boolean {
    const customer = this.memoryState.customers.find(c => c.id === customerId && !c.isDeleted);
    if (!customer) return false;
    const now = new Date().toISOString();
    customer.isDeleted = true;
    customer.deletedAt = now;
    customer.updatedAt = now;
    const trashItem: TrashItem = {
      id: 'trash_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      entityType: 'customer',
      entityId: customer.id,
      name: customer.name,
      details: `الهاتف: ${customer.phone || 'بدون'} | الدين: ${customer.totalDebt} دج`,
      data: { ...customer },
      deletedAt: now,
    };
    this.memoryState.trashItems.unshift(trashItem);
    this.persist('customers', this.memoryState.customers);
    this.persist('trashItems', this.memoryState.trashItems);
    this.queueOutbox('update', 'customer', customer);
    this.queueOutbox('create', 'trashItem', trashItem);
    return true;
  }

  /**
   * Record debt repayment (تسديد دفعة دين)
   */
  public recordDebtPayment(customerId: string, amount: number, notes?: string): DebtPayment | undefined {
    const customer = this.memoryState.customers.find(c => c.id === customerId);
    if (!customer || !Number.isFinite(amount) || amount <= 0) return undefined;

    const now = new Date().toISOString();
    const previousDebt = customer.totalDebt;
    const newDebt = Math.max(0, Math.round((previousDebt - amount) * 100) / 100);

    customer.totalDebt = newDebt;
    customer.updatedAt = now;

    const payment: DebtPayment = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      customerId: customer.id,
      customerName: customer.name,
      amount,
      date: now,
      notes: notes || '',
      previousDebt,
      newDebt,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryState.debtPayments.unshift(payment);
    this.persist('customers', this.memoryState.customers);
    this.persist('debtPayments', this.memoryState.debtPayments);

    this.queueOutbox('update', 'customer', customer);
    this.queueOutbox('create', 'debtPayment', payment);

    return payment;
  }

  public getCustomerDebtHistory(customerId: string) {
    const sales = this.getSales().filter(s => s.customerId === customerId && s.paymentMethod === 'credit');
    const payments = this.memoryState.debtPayments.filter(p => p.customerId === customerId && !p.isDeleted);
    return { sales, payments };
  }

  // --- Expenses ---

  public getExpenses(includeDeleted = false): Expense[] {
    if (includeDeleted) return this.memoryState.expenses;
    return this.memoryState.expenses.filter(e => !e.isDeleted);
  }

  public saveExpense(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Expense {
    const now = new Date().toISOString();
    let expense: Expense;

    if (data.id) {
      const idx = this.memoryState.expenses.findIndex(e => e.id === data.id);
      if (idx >= 0) {
        expense = {
          ...this.memoryState.expenses[idx],
          ...data,
          updatedAt: now,
        };
        this.memoryState.expenses[idx] = expense;
      } else {
        expense = {
          ...data,
          id: data.id,
          createdAt: now,
          updatedAt: now,
        };
        this.memoryState.expenses.push(expense);
      }
    } else {
      expense = {
        ...data,
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        createdAt: now,
        updatedAt: now,
      };
      this.memoryState.expenses.unshift(expense);
    }

    this.persist('expenses', this.memoryState.expenses);
    this.queueOutbox('update', 'expense', expense);
    return expense;
  }

  public softDeleteExpense(expenseId: string): boolean {
    const exp = this.memoryState.expenses.find(e => e.id === expenseId);
    if (!exp) return false;

    const now = new Date().toISOString();
    exp.isDeleted = true;
    exp.deletedAt = now;
    exp.updatedAt = now;

    const trashItem: TrashItem = {
      id: 'trash_' + Date.now(),
      entityType: 'expense',
      entityId: exp.id,
      name: exp.title,
      details: `المبلغ: ${exp.amount} دج | التصنيف: ${exp.category}`,
      data: { ...exp },
      deletedAt: now,
    };
    this.memoryState.trashItems.unshift(trashItem);

    this.persist('expenses', this.memoryState.expenses);
    this.persist('trashItems', this.memoryState.trashItems);
    this.queueOutbox('update', 'expense', exp);
    this.queueOutbox('create', 'trashItem', trashItem);
    return true;
  }

  // --- Trash / Recovery System ---

  public getTrashItems(): TrashItem[] {
    return this.memoryState.trashItems;
  }

  public restoreTrashItem(trashItemId: string): boolean {
    const idx = this.memoryState.trashItems.findIndex(t => t.id === trashItemId);
    if (idx === -1) return false;

    const trash = this.memoryState.trashItems[idx];
    const now = new Date().toISOString();

    if (trash.entityType === 'product') {
      const prod = this.memoryState.products.find(p => p.id === trash.entityId);
      if (prod) {
        prod.isDeleted = false;
        prod.deletedAt = undefined;
        prod.updatedAt = now;
        this.queueOutbox('update', 'product', prod);
      }
    } else if (trash.entityType === 'customer') {
      const cust = this.memoryState.customers.find(c => c.id === trash.entityId);
      if (cust) {
        cust.isDeleted = false;
        cust.deletedAt = undefined;
        cust.updatedAt = now;
        this.queueOutbox('update', 'customer', cust);
      }
    } else if (trash.entityType === 'expense') {
      const exp = this.memoryState.expenses.find(e => e.id === trash.entityId);
      if (exp) {
        exp.isDeleted = false;
        exp.deletedAt = undefined;
        exp.updatedAt = now;
        this.queueOutbox('update', 'expense', exp);
      }
    }

    this.memoryState.trashItems.splice(idx, 1);
    this.persist('products', this.memoryState.products);
    this.persist('customers', this.memoryState.customers);
    this.persist('expenses', this.memoryState.expenses);
    this.persist('trashItems', this.memoryState.trashItems);
    this.queueOutbox('delete', 'trashItem', { id: trashItemId });
    return true;
  }

  public permanentlyDeleteTrashItem(trashItemId: string): boolean {
    const idx = this.memoryState.trashItems.findIndex(t => t.id === trashItemId);
    if (idx === -1) return false;

    const trash = this.memoryState.trashItems[idx];
    if (trash.entityType === 'product') {
      this.memoryState.products = this.memoryState.products.filter(p => p.id !== trash.entityId);
      this.queueOutbox('delete', 'product', { id: trash.entityId });
      this.persist('products', this.memoryState.products);
    } else if (trash.entityType === 'customer') {
      this.memoryState.customers = this.memoryState.customers.filter(c => c.id !== trash.entityId);
      this.queueOutbox('delete', 'customer', { id: trash.entityId });
      this.persist('customers', this.memoryState.customers);
    } else if (trash.entityType === 'expense') {
      this.memoryState.expenses = this.memoryState.expenses.filter(e => e.id !== trash.entityId);
      this.queueOutbox('delete', 'expense', { id: trash.entityId });
      this.persist('expenses', this.memoryState.expenses);
    }

    this.memoryState.trashItems.splice(idx, 1);
    this.persist('trashItems', this.memoryState.trashItems);
    this.queueOutbox('delete', 'trashItem', { id: trashItemId });
    return true;
  }

  // --- Outbox Queue & Server Merging ---

  private queueOutbox(action: OutboxItem['action'], entityType: OutboxItem['entityType'], data: any) {
    const item: OutboxItem = {
      id: 'out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      action,
      entityType,
      data,
      timestamp: new Date().toISOString(),
    };
    this.memoryState.outboxQueue.push(item);
    this.persist('outboxQueue', this.memoryState.outboxQueue);
  }

  public getOutboxQueue(): OutboxItem[] {
    return this.memoryState.outboxQueue;
  }

  public clearOutboxQueue(processedIds?: string[]) {
    if (!processedIds) {
      this.memoryState.outboxQueue = [];
    } else {
      const processed = new Set(processedIds);
      this.memoryState.outboxQueue = this.memoryState.outboxQueue.filter(item => !processed.has(item.id));
    }
    this.persist('outboxQueue', this.memoryState.outboxQueue);
  }

  public setLastSync(timestamp: string) {
    this.memoryState.lastSyncTimestamp = timestamp;
    this.persist('lastSyncTimestamp', timestamp);
  }

  /**
   * Apply updates received from server to local state with timestamp conflict resolution
   */
  public applyServerSync(serverData: {
    products?: Product[];
    sales?: Sale[];
    customers?: Customer[];
    debtPayments?: DebtPayment[];
    expenses?: Expense[];
    trashItems?: TrashItem[];
    deletedEntities?: Array<{ entityType: string; id: string; deletedAt?: string }>;
    storeInfo?: StoreInfo;
    shopKey?: string;
  }) {
    const mergeEntities = <T extends { id: string; updatedAt?: string; createdAt?: string }>(localList: T[], incomingList: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of localList) {
        map.set(item.id, item);
      }
      for (const incoming of incomingList) {
        const existing = map.get(incoming.id);
        if (!existing) {
          map.set(incoming.id, incoming);
        } else {
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
          if (incomingTime >= existingTime) {
            map.set(incoming.id, incoming);
          }
        }
      }
      return Array.from(map.values());
    };

    if (serverData.products) {
      this.memoryState.products = mergeEntities(this.memoryState.products, serverData.products);
      this.persist('products', this.memoryState.products);
    }
    if (serverData.sales) {
      this.memoryState.sales = mergeEntities(this.memoryState.sales, serverData.sales);
      this.persist('sales', this.memoryState.sales);
    }
    if (serverData.customers) {
      this.memoryState.customers = mergeEntities(this.memoryState.customers, serverData.customers);
      this.persist('customers', this.memoryState.customers);
    }
    if (serverData.debtPayments) {
      this.memoryState.debtPayments = mergeEntities(this.memoryState.debtPayments, serverData.debtPayments);
      this.persist('debtPayments', this.memoryState.debtPayments);
    }
    if (serverData.expenses) {
      this.memoryState.expenses = mergeEntities(this.memoryState.expenses, serverData.expenses);
      this.persist('expenses', this.memoryState.expenses);
    }
    if (serverData.trashItems) {
      this.memoryState.trashItems = mergeEntities(this.memoryState.trashItems, serverData.trashItems);
      this.persist('trashItems', this.memoryState.trashItems);
    }
    if (serverData.deletedEntities?.length) {
      const deleted = new Map(serverData.deletedEntities.map(item => [`${item.entityType}:${item.id}`, true]));
      const filterDeleted = <T extends { id: string }>(items: T[], type: string) => items.filter(item => !deleted.has(`${type}:${item.id}`));
      this.memoryState.products = filterDeleted(this.memoryState.products, 'product');
      this.memoryState.sales = filterDeleted(this.memoryState.sales, 'sale');
      this.memoryState.customers = filterDeleted(this.memoryState.customers, 'customer');
      this.memoryState.debtPayments = filterDeleted(this.memoryState.debtPayments, 'debtPayment');
      this.memoryState.expenses = filterDeleted(this.memoryState.expenses, 'expense');
      this.memoryState.trashItems = filterDeleted(this.memoryState.trashItems, 'trashItem');
      this.persist('products', this.memoryState.products);
      this.persist('sales', this.memoryState.sales);
      this.persist('customers', this.memoryState.customers);
      this.persist('debtPayments', this.memoryState.debtPayments);
      this.persist('expenses', this.memoryState.expenses);
      this.persist('trashItems', this.memoryState.trashItems);
    }

    if (serverData.storeInfo) {
      this.memoryState.storeInfo = serverData.storeInfo;
      this.persist('storeInfo', serverData.storeInfo);
    }
    if (serverData.shopKey && !this.memoryState.shopKey) {
      this.memoryState.shopKey = serverData.shopKey;
      this.persist('shopKey', serverData.shopKey);
    }
  }

  /**
   * Reset entire local storage cleanly
   */
  public resetAllData() {
    this.memoryState = this.getEmptyState();
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY_PREFIX));
      for (const k of keys) {
        localStorage.removeItem(k);
      }
    }
  }
}

export const storage = new StorageService();
