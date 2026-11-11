import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Barcode,
  Camera,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  UserCheck,
  Scale,
  Receipt,
  RotateCcw,
  Sparkles,
  Users,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CashierTab, Customer, PaymentMethod, Product, Sale, SaleItem, StoreInfo } from '../../types';
import { storage } from '../../lib/storage';
import { formatCurrency, formatQuantityWithUnit, UNIT_LABELS } from '../../lib/formatters';
import { playErrorBeep, playSuccessBeep } from '../../lib/barcodeAudio';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface CashierViewProps {
  storeInfo: StoreInfo;
  onRefreshData?: () => void;
}

export const CashierView: React.FC<CashierViewProps> = ({ storeInfo, onRefreshData }) => {
  // Multi-tab state: allows multiple customers served simultaneously
  const [tabs, setTabs] = useState<CashierTab[]>([
    { id: 'tab_1', name: 'زبون 1', items: [], paymentMethod: 'cash', createdAt: Date.now() },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_1');

  // Search & input
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // Modals
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [weightModalItem, setWeightModalItem] = useState<{ index: number; item: SaleItem } | null>(null);
  const [customWeightInput, setCustomWeightInput] = useState<string>('');
  const [weightUnitChoice, setWeightUnitChoice] = useState<'kg' | 'gram'>('kg');
  
  // Checkout / Payment Modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isNewCustomerModal, setIsNewCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load latest products and customers
  const loadData = () => {
    setAllProducts(storage.getProducts());
    setAllCustomers(storage.getCustomers());
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  // Subtotal & totals of current active tab
  const tabTotals = useMemo(() => {
    if (!activeTab) return { subtotal: 0, count: 0 };
    const subtotal = activeTab.items.reduce((sum, item) => sum + item.total, 0);
    const count = activeTab.items.reduce((sum, item) => sum + (item.unit === 'kg' ? 1 : item.quantity), 0);
    return { subtotal, count };
  }, [activeTab]);

  // Filter products for quick search & categories
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProducts.slice(0, 18);
    return allProducts.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allProducts, searchQuery]);

  // Add Item to active tab
  const handleAddItem = (product: Product, quantity = 1, weightGrams?: number) => {
    if (!activeTab) return;

    let qty = quantity;
    if (product.unit === 'kg' && weightGrams) {
      qty = weightGrams / 1000;
    }

    // Check if item already exists in current tab
    const existingIdx = activeTab.items.findIndex(i => i.productId === product.id);

    let updatedItems: SaleItem[];
    if (existingIdx >= 0 && product.unit !== 'kg') {
      // increase quantity for piece items
      updatedItems = activeTab.items.map((item, idx) => {
        if (idx === existingIdx) {
          const newQty = item.quantity + qty;
          const newTotal = Math.round(newQty * item.unitPrice * 100) / 100;
          const newTotalCost = Math.round(newQty * item.purchasePrice * 100) / 100;
          return { ...item, quantity: newQty, total: newTotal, totalCost: newTotalCost };
        }
        return item;
      });
    } else {
      // add as new line
      const total = Math.round(qty * product.sellingPrice * 100) / 100;
      const totalCost = Math.round(qty * product.purchasePrice * 100) / 100;
      const newItem: SaleItem = {
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        unitPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        quantity: qty,
        weightGrams: weightGrams,
        total,
        totalCost,
      };
      updatedItems = [newItem, ...activeTab.items];
    }

    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, items: updatedItems } : t))
    );

    playSuccessBeep();
    setSearchQuery('');
  };

  // Barcode scanned from camera or scanner
  const handleBarcodeScanned = (barcode: string) => {
    const clean = barcode.trim();
    const matched = allProducts.find(p => p.barcode === clean);
    if (matched) {
      if (matched.unit === 'kg') {
        // Keep the weighed item pending until the user confirms its actual weight.
        setWeightModalItem({
          index: activeTab?.items.length ?? 0,
          item: {
            productId: matched.id,
            name: matched.name,
            barcode: matched.barcode,
            unit: 'kg',
            unitPrice: matched.sellingPrice,
            purchasePrice: matched.purchasePrice,
            quantity: 1,
            total: matched.sellingPrice,
            totalCost: matched.purchasePrice,
          },
        });
        setCustomWeightInput('1');
        setWeightUnitChoice('kg');
      } else {
        handleAddItem(matched, 1);
      }
    } else {
      playErrorBeep();
      toast.error(`السلعة غير مسجلة في المخزون بالباركود (${clean}). يمكنك إضافتها أولاً من قسم المنتجات.`);
    }
  };

  // Modify line item quantity
  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (!activeTab || newQty <= 0) return;
    const updated = activeTab.items.map((item, idx) => {
      if (idx === index) {
        const roundedQty = Math.round(newQty * 1000) / 1000;
        const total = Math.round(roundedQty * item.unitPrice * 100) / 100;
        const totalCost = Math.round(roundedQty * item.purchasePrice * 100) / 100;
        return { ...item, quantity: roundedQty, weightGrams: item.unit === 'kg' ? Math.round(roundedQty * 1000) : item.weightGrams, total, totalCost };
      }
      return item;
    });
    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, items: updated } : t))
    );
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (!activeTab) return;
    const updated = activeTab.items.filter((_, idx) => idx !== index);
    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, items: updated } : t))
    );
  };

  // Multi-Tab management
  const handleAddTab = () => {
    const newTabNum = tabs.length + 1;
    const newTab: CashierTab = {
      id: 'tab_' + Date.now(),
      name: `زبون ${newTabNum}`,
      items: [],
      paymentMethod: 'cash',
      createdAt: Date.now(),
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Just clear current tab
      setTabs([{ id: 'tab_1', name: 'زبون 1', items: [], paymentMethod: 'cash', createdAt: Date.now() }]);
      setActiveTabId('tab_1');
      return;
    }
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleClearCurrentTab = () => {
    if (!activeTab || activeTab.items.length === 0) return;
    setShowClearConfirm(true);
  };

  const confirmClearTab = () => {
    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, items: [] } : t))
    );
    setShowClearConfirm(false);
    toast.info('تم تفريغ الفاتورة بنجاح.');
  };

  // Complete checkout
  const handleCompleteSale = (paymentMethod: PaymentMethod, customerId?: string) => {
    if (!activeTab || activeTab.items.length === 0) {
      toast.error('الفاتورة فارغة! يرجى إضافة سلع أولاً.');
      return;
    }

    const customer = customerId ? allCustomers.find(c => c.id === customerId) : undefined;

    let sale: Sale;
    try {
      sale = storage.createSale({
        items: activeTab.items,
        paymentMethod,
        customerId,
        customerName: customer?.name,
      });
    } catch (error: any) {
      toast.error(error?.message || 'تعذر إتمام عملية البيع.');
      loadData();
      return;
    }

    // Celebratory effect
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    // Refresh memory products & customers
    loadData();
    if (onRefreshData) onRefreshData();

    // Show receipt modal
    setCompletedSale(sale);
    setIsReceiptOpen(true);
    setIsCheckoutModalOpen(false);

    // Reset current tab
    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, items: [] } : t))
    );
  };

  // Weight edit submit
  const handleApplyWeight = () => {
    if (!weightModalItem) return;
    const rawVal = parseFloat(customWeightInput);
    if (isNaN(rawVal) || rawVal <= 0) {
      toast.error('يرجى إدخال وزن صحيح');
      return;
    }
    const finalKg = Math.round((weightUnitChoice === 'gram' ? rawVal / 1000 : rawVal) * 1000) / 1000;
    if (!activeTab) return;
    const target = weightModalItem.item;
    const updatedItem: SaleItem = {
      ...target,
      quantity: finalKg,
      weightGrams: Math.round(finalKg * 1000),
      total: Math.round(finalKg * target.unitPrice * 100) / 100,
      totalCost: Math.round(finalKg * target.purchasePrice * 100) / 100,
    };
    if (weightModalItem.index < activeTab.items.length && activeTab.items[weightModalItem.index]?.productId === target.productId) {
      const updated = activeTab.items.map((item, idx) => idx === weightModalItem.index ? updatedItem : item);
      setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, items: updated } : t));
    } else {
      setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, items: [updatedItem, ...t.items] } : t));
    }
    playSuccessBeep();
    setSearchQuery('');
    setWeightModalItem(null);
  };

  // Quick create new customer
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    const cust = storage.saveCustomer({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      totalDebt: 0,
    });
    setAllCustomers(storage.getCustomers());
    setSelectedCustomerId(cust.id);
    setIsNewCustomerModal(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-3 sm:gap-4 max-w-7xl mx-auto">
      
      {/* LEFT / TOP: MULTI-TAB INVOICE CART */}
      <div className="w-full lg:w-5/12 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[460px] lg:h-[calc(100vh-140px)]">
        
        {/* Tabs Bar: Switch between simultaneous customers */}
        <div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 overflow-x-auto text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1.5 px-2 text-emerald-400">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">الفواتير:</span>
          </div>

          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTab.id;
            const tabItemsCount = tab.items.length;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition select-none ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <span>{tab.name || `زبون ${idx + 1}`}</span>
                {tabItemsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-emerald-800 text-white' : 'bg-slate-700 text-emerald-300'}`}>
                    {tabItemsCount}
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddTab}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="فتح فاتورة لزبون آخر"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>زبون جديد</span>
          </button>
        </div>

        {/* Tab Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTab.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Receipt className="w-12 h-12 text-slate-300 mb-2 stroke-[1.5]" />
              <p className="font-bold text-slate-600">فاتورة {activeTab.name} فارغة</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                امسح الباركود بالكاميرا أو ابحث عن السلعة بالاسم في القائمة المقابلة.
              </p>
            </div>
          ) : (
            activeTab.items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 bg-slate-50/70 hover:bg-slate-50 transition"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4>
                    {item.unit === 'kg' && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        وزن
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>السعر: {formatCurrency(item.unitPrice)}</span>
                    <span>•</span>
                    <span className="font-medium text-slate-700">
                      {formatQuantityWithUnit(item.quantity, item.unit)}
                    </span>
                  </div>
                </div>

                {/* Quantity & Weight Adjuster */}
                <div className="flex items-center gap-1 sm:gap-2">
                  {item.unit === 'kg' ? (
                    <button
                      onClick={() => {
                        setWeightModalItem({ index, item });
                        setCustomWeightInput(String(item.quantity));
                        setWeightUnitChoice('kg');
                      }}
                      className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-amber-100 transition"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>{item.quantity} كغ</span>
                    </button>
                  ) : (
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                      <button
                        onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                        className="p-1 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                        className="p-1 hover:bg-slate-100 text-slate-600 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Line Total */}
                  <div className="w-16 sm:w-20 text-left font-black text-sm text-emerald-700 font-sans">
                    {formatCurrency(item.total)}
                  </div>

                  {/* Delete Item */}
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="حذف السلعة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tab Bottom Footer / Checkout Bar */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs text-slate-400">إجمالي الفاتورة:</span>
              <div className="text-2xl font-black text-emerald-400 tracking-tight font-sans">
                {formatCurrency(tabTotals.subtotal)}
              </div>
            </div>
            {activeTab.items.length > 0 && (
              <button
                onClick={handleClearCurrentTab}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إلغاء وتفريغ</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCompleteSale('cash')}
              disabled={activeTab.items.length === 0}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-extrabold py-3 px-3 rounded-xl shadow active:scale-95 transition text-sm"
            >
              <DollarSign className="w-4 h-4" />
              <span>دفع نقدًا (كاش)</span>
            </button>

            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={activeTab.items.length === 0}
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white font-extrabold py-3 px-3 rounded-xl shadow active:scale-95 transition text-sm"
            >
              <UserCheck className="w-4 h-4" />
              <span>تسجيل كدين (كريدي)</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT / BOTTOM: FAST SEARCH, BARCODE SCAN & PRODUCT GRID */}
      <div className="w-full lg:w-7/12 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[460px] lg:h-[calc(100vh-140px)]">
        
        {/* Top Search & Barcode Header */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم السلعة، الباركود، أو الصنف..."
                className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Camera Barcode Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm shadow transition"
              title="مسح الباركود بكاميرا الهاتف"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">مسح الباركود</span>
              <span className="sm:hidden">كاميرا</span>
            </button>
          </div>
        </div>

        {/* Product Catalog Tiles */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">لا توجد سلع مطابقة</p>
              <p className="text-xs text-slate-400 mt-1">
                {allProducts.length === 0
                  ? 'لم تقم بإضافة منتجات بعد. توجه لقسم المنتجات أو استخدم معالج الإعداد الأولي.'
                  : 'جرب البحث بكلمة أخرى أو برقم باركود مختلف.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredProducts.map((product) => {
                const isLowStock = product.stockQuantity <= product.minStockAlert;
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (product.unit === 'kg') {
                        setWeightModalItem({
                          index: activeTab.items.length,
                          item: {
                            productId: product.id,
                            name: product.name,
                            barcode: product.barcode,
                            unit: 'kg',
                            unitPrice: product.sellingPrice,
                            purchasePrice: product.purchasePrice,
                            quantity: 1,
                            total: product.sellingPrice,
                            totalCost: product.purchasePrice,
                          },
                        });
                        setCustomWeightInput('1');
                        setWeightUnitChoice('kg');
                      } else {
                        handleAddItem(product, 1);
                      }
                    }}
                    className="relative flex flex-col justify-between text-right p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 active:scale-[0.98] transition shadow-sm group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="truncate max-w-[80px]">{product.category}</span>
                        {product.unit === 'kg' ? (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold">
                            كغ
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {UNIT_LABELS[product.unit] || 'قطعة'}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 line-clamp-2">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <span className="font-black text-sm sm:text-base text-emerald-700 font-sans">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isLowStock ? 'text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded' : 'text-slate-400'
                        }`}
                        title="المخزون المتوفر"
                      >
                        {product.stockQuantity} {product.unit === 'kg' ? 'كغ' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* WEIGHING MODAL (FOR KG & GRAMS) */}
      {weightModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-right">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">إدخال الوزن: {weightModalItem.item.name}</h3>
              </div>
              <button
                onClick={() => setWeightModalItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              سعر الكيلوغرام: <strong>{formatCurrency(weightModalItem.item.unitPrice)}</strong>
            </p>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setWeightUnitChoice('kg')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                  weightUnitChoice === 'kg'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                بالكيلوغرام (كغ)
              </button>
              <button
                type="button"
                onClick={() => setWeightUnitChoice('gram')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                  weightUnitChoice === 'gram'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                بالغرام (غ)
              </button>
            </div>

            {/* Quick Presets for fast shop checkout */}
            <div className="grid grid-cols-4 gap-1.5 mb-3 text-xs font-bold">
              {weightUnitChoice === 'kg' ? (
                <>
                  <button onClick={() => setCustomWeightInput('0.25')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">0.25 كغ</button>
                  <button onClick={() => setCustomWeightInput('0.50')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">0.5 كغ</button>
                  <button onClick={() => setCustomWeightInput('1.00')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">1 كغ</button>
                  <button onClick={() => setCustomWeightInput('2.00')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">2 كغ</button>
                </>
              ) : (
                <>
                  <button onClick={() => setCustomWeightInput('250')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">250 غ</button>
                  <button onClick={() => setCustomWeightInput('500')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">500 غ</button>
                  <button onClick={() => setCustomWeightInput('750')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">750 غ</button>
                  <button onClick={() => setCustomWeightInput('1000')} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700">1000 غ</button>
                </>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                الوزن {weightUnitChoice === 'kg' ? 'بالكيلوغرام (يدعم الكسور 0.350)': 'بالغرامات'}:
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={customWeightInput}
                onChange={(e) => setCustomWeightInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-center text-lg font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                autoFocus
              />
              {/* Calculated price preview */}
              <div className="mt-2 text-center text-xs font-bold text-emerald-700">
                المجموع: {formatCurrency(
                  (parseFloat(customWeightInput) || 0) * 
                  (weightUnitChoice === 'gram' ? weightModalItem.item.unitPrice / 1000 : weightModalItem.item.unitPrice)
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setWeightModalItem(null)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleApplyWeight}
                className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition"
              >
                تطبيق الوزن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT AS CREDIT MODAL (CUSTOMER PICKER) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-right max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900">تسجيل الفاتورة كدين على زبون</h3>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              المبلغ المطلوب تسجيله: <strong className="text-emerald-700">{formatCurrency(tabTotals.subtotal)}</strong>
            </p>

            {/* Customer Search / Filter */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="ابحث عن اسم الزبون أو رقم الهاتف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-56 min-h-[140px] border border-slate-200 rounded-xl p-2 mb-3">
              {allCustomers
                .filter(c =>
                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  c.phone.includes(customerSearch)
                )
                .map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-amber-100 border border-amber-300 text-amber-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{cust.name}</div>
                        <div className="text-[10px] text-slate-500">{cust.phone || 'بدون هاتف'}</div>
                      </div>
                      <div className="text-left font-sans">
                        <span className="text-[10px] text-slate-400 block">الدين الحالي:</span>
                        <span className="font-bold text-rose-600">{formatCurrency(cust.totalDebt)}</span>
                      </div>
                    </div>
                  );
                })}

              {allCustomers.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  لا يوجد زبائن مسجلين بعد. أضف زبونًا جديدًا بالأسفل.
                </div>
              )}
            </div>

            {/* Quick Add Customer Trigger */}
            {!isNewCustomerModal ? (
              <button
                type="button"
                onClick={() => setIsNewCustomerModal(true)}
                className="flex items-center justify-center gap-1.5 w-full py-2 mb-3 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة زبون جديد سريعًا</span>
              </button>
            ) : (
              <form onSubmit={handleCreateCustomer} className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3 space-y-2">
                <h4 className="text-xs font-bold text-slate-800">بيانات الزبون الجديد:</h4>
                <input
                  type="text"
                  placeholder="اسم الزبون (مثال: عمي السعيد)"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="رقم الهاتف (اختياري)"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold"
                  >
                    حفظ واختيار
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModal(false)}
                    className="py-1.5 px-3 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}

            {/* Confirm Credit Sale */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!selectedCustomerId}
                onClick={() => handleCompleteSale('credit', selectedCustomerId)}
                className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs transition"
              >
                تأكيد وتسجيل الدين
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        storeInfo={storeInfo}
      />

      {/* Clear Tab Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="تفريغ الفاتورة"
        message={`هل أنت متأكد من تفريغ جميع سلع فاتورة «${activeTab.name}»؟`}
        confirmLabel="تفريغ الفاتورة"
        onConfirm={confirmClearTab}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};
