import React, { useState, useEffect } from 'react';
import { Camera, X, Plus, Save } from 'lucide-react';
import { Product, UnitType } from '../../types';
import { UNIT_LABELS } from '../../lib/formatters';
import { BarcodeScannerModal } from '../pos/BarcodeScannerModal';
import { toast } from '../../lib/toast';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  initialProduct?: Product | null;
}

const COMMON_CATEGORIES = [
  'ألبان ومشتقاتها',
  'مواد غذائية عامة',
  'خضر وفواكه',
  'مشروبات ومياه',
  'بسكويت ومقرمشات',
  'عجائن وبقوليات',
  'منظفات وعناية منزلية',
  'توابل وبهارات',
  'زيوت ومعلبات',
  'أخرى',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState<UnitType>('piece');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(5);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name);
      if (COMMON_CATEGORIES.includes(initialProduct.category)) {
        setCategory(initialProduct.category);
        setCustomCategory('');
      } else {
        setCategory('custom');
        setCustomCategory(initialProduct.category);
      }
      setBarcode(initialProduct.barcode || '');
      setPurchasePrice(initialProduct.purchasePrice);
      setSellingPrice(initialProduct.sellingPrice);
      setStockQuantity(initialProduct.stockQuantity);
      setUnit(initialProduct.unit);
      setMinStockAlert(initialProduct.minStockAlert);
    } else {
      setName('');
      setCategory(COMMON_CATEGORIES[0]);
      setCustomCategory('');
      setBarcode('');
      setPurchasePrice('');
      setSellingPrice('');
      setStockQuantity('');
      setUnit('piece');
      setMinStockAlert(5);
    }
  }, [initialProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم المنتج.');
      return;
    }
    const finalCategory = category === 'custom' ? customCategory.trim() || 'عام' : category;

    onSave({
      id: initialProduct?.id,
      name: name.trim(),
      category: finalCategory,
      barcode: barcode.trim(),
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      unit,
      minStockAlert: Number(minStockAlert) || 5,
    });

    onClose();
  };

  const generateRandomBarcode = () => {
    // Generate clean 10-digit barcode
    const randomCode = '613' + Math.floor(1000000 + Math.random() * 9000000);
    setBarcode(randomCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200 text-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <h3 className="font-bold text-base sm:text-lg">
            {initialProduct ? 'تعديل بيانات السلعة' : 'إضافة سلعة جديدة للمخزون'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم المنتج / السلعة: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: حليب الصومام 1 لتر، أو بطاطا عين الدفلى"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          {/* Barcode with Scanner Trigger */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">الباركود (رقم السلعة):</label>
              <button
                type="button"
                onClick={generateRandomBarcode}
                className="text-[11px] text-emerald-700 hover:underline"
              >
                توليد باركود تلقائي
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="امسح الباركود أو أدخله هنا..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono tracking-wider text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                title="مسح بالكاميرا"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>مسح</span>
              </button>
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الصنف / القسم:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="custom">+ صنف مخصص جديد...</option>
              </select>
              {category === 'custom' && (
                <input
                  type="text"
                  placeholder="اكتب اسم الصنف الجديد"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وحدة القياس:</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
              >
                <option value="piece">قطعة / حبة</option>
                <option value="kg">وزن: كيلوغرام (كغ)</option>
                <option value="gram">وزن: غرام</option>
                <option value="liter">حجم: لتر</option>
                <option value="box">علبة</option>
                <option value="pack">حزمة / باقة</option>
              </select>
            </div>
          </div>

          {/* Pricing: Purchase price & Selling price */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سعر الشراء (دج): <span className="text-slate-400 font-normal">لحساب الربح</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1">
                سعر البيع (دج): <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Profit margin badge */}
            {typeof sellingPrice === 'number' && typeof purchasePrice === 'number' && (
              <div className="col-span-2 text-xs text-emerald-700 font-bold flex justify-between pt-1 border-t border-emerald-200/60">
                <span>هامش الربح المتوقع للوحدة:</span>
                <span>{(sellingPrice - purchasePrice).toFixed(2)} دج</span>
              </div>
            )}
          </div>

          {/* Stock Quantity & Min Alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الكمية الحالية في المخزون:
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                حد تنبيه نقص المخزون:
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="5"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs sm:text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow transition"
            >
              <Save className="w-4 h-4" />
              <span>{initialProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Barcode Scanner Modal for easy camera scan */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setBarcode(code)}
      />
    </div>
  );
};
