import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  PackagePlus,
  AlertTriangle,
  Camera,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatQuantityWithUnit, UNIT_LABELS } from '../../lib/formatters';
import { ProductFormModal } from './ProductFormModal';
import { StockReplenishmentModal } from './StockReplenishmentModal';
import { InitialStockSetupWizard } from './InitialStockSetupWizard';
import { BarcodeScannerModal } from '../pos/BarcodeScannerModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface ProductListViewProps {
  products: Product[];
  onSaveProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onReplenishStock: (productId: string, addedQty: number, newPurchasePrice?: number) => void;
  onDeleteProduct: (productId: string) => void;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  products,
  onSaveProduct,
  onReplenishStock,
  onDeleteProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Statistics
  const stats = useMemo(() => {
    let totalStockCount = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      totalStockCount += p.stockQuantity;
      totalCostValue += p.stockQuantity * p.purchasePrice;
      totalRetailValue += p.stockQuantity * p.sellingPrice;
      if (p.stockQuantity <= p.minStockAlert) {
        lowStockCount++;
      }
    });

    return {
      totalProducts: products.length,
      totalStockCount,
      totalCostValue,
      totalRetailValue,
      lowStockCount,
    };
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesLowStock = !onlyLowStock || p.stockQuantity <= p.minStockAlert;

        return matchesSearch && matchesCategory && matchesLowStock;
      })
      .sort((a, b) => {
        if (sortBy === 'stock') return a.stockQuantity - b.stockQuantity;
        if (sortBy === 'price') return b.sellingPrice - a.sellingPrice;
        return a.name.localeCompare(b.name, 'ar');
      });
  }, [products, searchQuery, selectedCategory, onlyLowStock, sortBy]);

  const handleBarcodeScanned = (barcode: string) => {
    setSearchQuery(barcode.trim());
    setIsScannerOpen(false);
  };

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDeleteProduct = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete.id);
      toast.info(`تم نقل «${productToDelete.name}» إلى سلة المحذوفات.`);
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي السلع المسجلة:</span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-sans">{stats.totalProducts}</div>
          <span className="text-[11px] text-slate-400 mt-0.5">صنف مختلف</span>
        </div>

        <div
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`p-3.5 rounded-2xl border cursor-pointer transition shadow-sm flex flex-col justify-between ${
            stats.lowStockCount > 0
              ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100/70'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">تنبيهات انخفاض المخزون:</span>
            {stats.lowStockCount > 0 && <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />}
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1 font-sans">{stats.lowStockCount}</div>
          <span className="text-[11px] text-amber-700">اضغط لعرضها وتزويدها</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">قيمة المخزون (سعر الشراء):</span>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-sans">
            {formatCurrency(stats.totalCostValue)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">رأس المال المجمد بالسلع</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">قيمة المخزون المتوقعة (بيع):</span>
          <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1 font-sans">
            {formatCurrency(stats.totalRetailValue)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">
            ربح متوقع: +{formatCurrency(stats.totalRetailValue - stats.totalCostValue)}
          </span>
        </div>
      </div>

      {/* Main Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سلعة جديدة</span>
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold px-3 py-2.5 rounded-xl text-xs sm:text-sm transition"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">معالج المخزون الأولي</span>
            <span className="sm:hidden">إعداد أولي</span>
          </button>
        </div>

        {/* Search & Camera scan */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الباركود..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
            title="البحث بمسح الباركود بالكاميرا"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">مسح</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setSelectedCategory('all');
              setOnlyLowStock(false);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold transition ${
              selectedCategory === 'all' && !onlyLowStock
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            جميع السلع ({products.length})
          </button>

          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold transition ${
              onlyLowStock
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>المخزون المنخفض ({stats.lowStockCount})</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setOnlyLowStock(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl font-medium transition ${
                selectedCategory === cat && !onlyLowStock
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort by */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 text-[11px]">ترتيب:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-slate-700 font-bold text-xs focus:outline-none"
          >
            <option value="name">أبجديًا</option>
            <option value="stock">المخزون (الأقل أولاً)</option>
            <option value="price">السعر (الأعلى أولاً)</option>
          </select>
        </div>
      </div>

      {/* Products Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">لا توجد سلع مطابقة للبحث أو التصفية</p>
            <p className="text-xs text-slate-400 mt-1">
              أضف سلعك يدويًا أو عبر معالج المخزون الأولي لتبدأ البيع فورًا.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">السلعة</th>
                  <th className="py-3 px-3">الصنف</th>
                  <th className="py-3 px-3">الباركود</th>
                  <th className="py-3 px-3">سعر الشراء</th>
                  <th className="py-3 px-3">سعر البيع</th>
                  <th className="py-3 px-3 text-center">المخزون المتوفر</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod) => {
                  const isLow = prod.stockQuantity <= prod.minStockAlert;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                      {/* Name & Unit */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          الوحدة: {UNIT_LABELS[prod.unit]}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {prod.category}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                        {prod.barcode || <span className="text-slate-300">بدون</span>}
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3 px-3 font-sans text-slate-600">
                        {formatCurrency(prod.purchasePrice)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 font-sans font-bold text-emerald-800 text-sm">
                        {formatCurrency(prod.sellingPrice)}
                      </td>

                      {/* Stock Quantity with alert indicator */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 font-bold font-sans">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs ${
                              isLow
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {formatQuantityWithUnit(prod.stockQuantity, prod.unit)}
                          </span>
                        </div>
                        {isLow && (
                          <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                            أقل من الحد ({prod.minStockAlert})
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Replenish stock button */}
                          <button
                            onClick={() => setReplenishProduct(prod)}
                            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                            title="استلام شحنة جديدة وتزويد المخزون"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>تزويد</span>
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => {
                              setEditingProduct(prod);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="تعديل السلعة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button (recoverable) */}
                          <button
                            onClick={() => handleDeleteClick(prod)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف إلى سلة المحذوفات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Add / Edit Modal */}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={onSaveProduct}
        initialProduct={editingProduct}
      />

      {/* Stock Replenishment Modal */}
      <StockReplenishmentModal
        isOpen={!!replenishProduct}
        onClose={() => setReplenishProduct(null)}
        product={replenishProduct}
        onConfirm={onReplenishStock}
      />

      {/* Initial Stock Setup Wizard */}
      <InitialStockSetupWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onAddProduct={(p) => onSaveProduct(p)}
        currentProductsCount={products.length}
      />

      {/* Barcode Camera Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Delete Product Confirmation Modal */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="حذف سلعة إلى سلة المحذوفات"
        message={`هل أنت متأكد من حذف سلعة «${productToDelete?.name || ''}»؟ يمكن استرجاعها دائمًا من سلة المحذوفات دون فقدان أي بيانات.`}
        confirmLabel="حذف إلى المحذوفات"
        onConfirm={confirmDeleteProduct}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};
