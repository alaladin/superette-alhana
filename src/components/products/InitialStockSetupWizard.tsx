import React, { useState } from 'react';
import { Sparkles, Camera, Plus, CheckCircle, ArrowRight, Package, X } from 'lucide-react';
import { Product, UnitType } from '../../types';
import { formatCurrency, formatQuantityWithUnit, UNIT_LABELS } from '../../lib/formatters';
import { BarcodeScannerModal } from '../pos/BarcodeScannerModal';

interface InitialStockSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  currentProductsCount: number;
}

export const InitialStockSetupWizard: React.FC<InitialStockSetupWizardProps> = ({
  isOpen,
  onClose,
  onAddProduct,
  currentProductsCount,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('مواد غذائية عامة');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState<UnitType>('piece');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(5);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [sessionAddedCount, setSessionAddedCount] = useState(0);

  if (!isOpen) return null;

  const handleAddAndNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddProduct({
      name: name.trim(),
      category: category.trim() || 'عام',
      barcode: barcode.trim(),
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      unit,
      minStockAlert: Number(minStockAlert) || 5,
    });

    setSessionAddedCount(prev => prev + 1);

    // Clear form for next item
    setName('');
    setBarcode('');
    setPurchasePrice('');
    setSellingPrice('');
    setStockQuantity('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200 text-right">
        {/* Wizard Header */}
        <div className="p-5 bg-gradient-to-l from-emerald-800 to-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-base sm:text-lg">معالج إدخال المخزون الأولي للمحل</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-emerald-100 mt-1">
            سجّل السلع المتوفرة حاليًا في المحل لحساب رأس المال والمخزون الحقيقي قبل بدء البيع.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg w-fit">
            <Package className="w-4 h-4 text-emerald-300" />
            <span>السلع المسجلة بالمحل: {currentProductsCount} سلعة</span>
            {sessionAddedCount > 0 && (
              <span className="text-amber-300">({sessionAddedCount} جديدة الآن)</span>
            )}
          </div>
        </div>

        {/* Wizard Step Form */}
        <form onSubmit={handleAddAndNext} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم السلعة: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: سكر 1 كغ، زيت إيليو 2 لتر، جبن لافاش كيري..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الباركود:</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="رقم الباركود"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="p-2 bg-slate-800 text-emerald-400 rounded-lg text-xs"
                  title="مسح بالكاميرا"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وحدة القياس:</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
              >
                <option value="piece">قطعة / حبة</option>
                <option value="kg">وزن (كغ)</option>
                <option value="gram">وزن (غرام)</option>
                <option value="liter">لتر</option>
                <option value="box">علبة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 bg-emerald-50/40 rounded-xl border border-emerald-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الشراء:</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0 دج"
                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">سعر البيع:</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0 دج"
                className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-xs font-bold text-emerald-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الكمية الحالية:</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة السلعة والانتقال للتالية</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              إنهاء المعالج
            </button>
          </div>
        </form>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setBarcode(code)}
      />
    </div>
  );
};
