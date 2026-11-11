import React, { useState, useEffect } from 'react';
import { PackagePlus, X, AlertCircle } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatQuantityWithUnit } from '../../lib/formatters';
import { toast } from '../../lib/toast';

interface StockReplenishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (productId: string, addedQty: number, newPurchasePrice?: number) => void;
}

export const StockReplenishmentModal: React.FC<StockReplenishmentModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  const [addedQty, setAddedQty] = useState<number | ''>('');
  const [updatePrice, setUpdatePrice] = useState(false);
  const [newPurchasePrice, setNewPurchasePrice] = useState<number | ''>('');

  useEffect(() => {
    if (product) {
      setAddedQty('');
      setUpdatePrice(false);
      setNewPurchasePrice(product.purchasePrice);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(addedQty);
    if (!qty || qty <= 0) {
      toast.error('يرجى إدخال كمية صحيحة مضافة.');
      return;
    }

    onConfirm(
      product.id,
      qty,
      updatePrice && typeof newPurchasePrice === 'number' ? newPurchasePrice : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 text-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">استلام بضاعة جديدة (تزويد المخزون)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info Summary */}
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-slate-900 text-sm">{product.name}</div>
            <div className="text-slate-500 mt-0.5">الصنف: {product.category}</div>
          </div>
          <div className="text-left font-sans">
            <span className="text-slate-400 block text-[10px]">المخزون الحالي:</span>
            <span className="font-bold text-slate-800 text-sm">
              {formatQuantityWithUnit(product.stockQuantity, product.unit)}
            </span>
          </div>
        </div>

        {/* Replenish Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              الكمية الواصلة الجديدة ({product.unit === 'kg' ? 'كغ' : 'قطع'}):
            </label>
            <input
              type="number"
              step="any"
              min="0.001"
              required
              value={addedQty}
              onChange={(e) => setAddedQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="مثال: +24 أو +10 كغ"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 text-center focus:outline-none focus:border-emerald-600 focus:bg-white"
              autoFocus
            />
            {typeof addedQty === 'number' && (
              <p className="text-[11px] text-emerald-700 font-bold mt-1 text-center">
                المخزون الجديد بعد الإضافة: {product.stockQuantity + addedQty} {product.unit === 'kg' ? 'كغ' : ''}
              </p>
            )}
          </div>

          {/* Update Purchase Price Checkbox */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updatePrice}
                onChange={(e) => setUpdatePrice(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-800">
                تغير سعر الشراء في هذه الدفعة؟ (تسجيل السعر الجديد)
              </span>
            </label>

            {updatePrice && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <label className="block text-xs text-slate-600 mb-1">
                  سعر الشراء الجديد للوحدة (دج):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required={updatePrice}
                  value={newPurchasePrice}
                  onChange={(e) => setNewPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition shadow"
            >
              تأكيد وتحديث المخزون
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
