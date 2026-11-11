import React, { useRef } from 'react';
import { Download, Printer, Share2, CheckCircle2, X } from 'lucide-react';
import { Sale, StoreInfo } from '../../types';
import { formatCurrency, formatDate, formatQuantityWithUnit } from '../../lib/formatters';
import { toast } from '../../lib/toast';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  storeInfo: StoreInfo;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  storeInfo,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    // Generate text/markdown receipt format that can be saved or shared
    let content = `==============================\n`;
    content += `        ${storeInfo.name}        \n`;
    content += `   ${storeInfo.tagline || 'تسيير المحل والمبيعات'}   \n`;
    content += `الهاتف: ${storeInfo.phone} | ${storeInfo.address}\n`;
    content += `==============================\n`;
    content += `رقم الفاتورة: ${sale.invoiceNumber}\n`;
    content += `التاريخ: ${formatDate(sale.createdAt)}\n`;
    content += `طريقة الدفع: ${sale.paymentMethod === 'credit' ? `دين على الزبون (${sale.customerName || 'غير محدد'})` : 'نقدًا'}\n`;
    content += `------------------------------\n`;
    content += `السلعة          الكمية   السعر    المجموع\n`;
    content += `------------------------------\n`;

    sale.items.forEach(item => {
      const q = formatQuantityWithUnit(item.quantity, item.unit);
      content += `${item.name}\n                ${q} × ${item.unitPrice} = ${item.total} دج\n`;
    });

    content += `==============================\n`;
    content += `المجموع الإجمالي: ${formatCurrency(sale.total)}\n`;
    if (sale.paymentMethod === 'credit') {
      content += `المبلغ المسجل كدين: ${formatCurrency(sale.remainingDebt)}\n`;
    }
    content += `==============================\n`;
    content += `${storeInfo.footerMessage}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `فاتورة-${sale.invoiceNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareText = `فاتورة من ${storeInfo.name}\nرقم: ${sale.invoiceNumber}\nالمجموع: ${formatCurrency(sale.total)}\nالتاريخ: ${formatDate(sale.createdAt)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `فاتورة ${sale.invoiceNumber} - ${storeInfo.name}`,
          text: shareText,
        });
      } catch {
        // user dismissed share
      }
    } else {
      navigator.clipboard?.writeText(shareText);
      toast.success('تم نسخ تفاصيل الفاتورة إلى الحافظة.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-slate-200">
        
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">تم إتمام الفاتورة بنجاح</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div className="p-4 sm:p-6 bg-white text-slate-900">
          <div
            ref={receiptRef}
            className="printable-receipt border-2 border-dashed border-slate-300 rounded-xl p-4 bg-amber-50/20 text-slate-800 text-xs sm:text-sm font-mono leading-relaxed"
          >
            {/* Store Brand Header */}
            <div className="text-center pb-3 border-b border-slate-300">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 font-sans tracking-tight">
                {storeInfo.name}
              </h2>
              <p className="text-xs text-slate-600 font-sans mt-0.5">{storeInfo.tagline}</p>
              <p className="text-[11px] text-slate-500 font-sans mt-1">
                {storeInfo.address} • هاتف: {storeInfo.phone}
              </p>
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-slate-200 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الفاتورة:</span>
                <span className="font-bold text-slate-900">{sale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">التاريخ والوقت:</span>
                <span>{formatDate(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className={`font-bold ${sale.paymentMethod === 'credit' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {sale.paymentMethod === 'credit' ? `دين على الزبون (${sale.customerName || 'عام'})` : 'نقدًا'}
                </span>
              </div>
              {sale.status !== 'completed' && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>الحالة:</span>
                  <span>{sale.status === 'returned' ? 'مرتجع' : 'ملغاة'}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2">
              <table className="w-full text-right text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="pb-1 text-right font-bold">السلعة</th>
                    <th className="pb-1 text-center font-bold">الكمية/الوزن</th>
                    <th className="pb-1 text-center font-bold">السعر</th>
                    <th className="pb-1 text-left font-bold">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1.5 font-medium text-slate-900 max-w-[120px] truncate">
                        {item.name}
                      </td>
                      <td className="py-1.5 text-center text-slate-600">
                        {formatQuantityWithUnit(item.quantity, item.unit)}
                      </td>
                      <td className="py-1.5 text-center text-slate-600">
                        {item.unitPrice}
                      </td>
                      <td className="py-1.5 text-left font-bold text-slate-900">
                        {item.total} دج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Calculation */}
            <div className="pt-2 border-t-2 border-slate-900 space-y-1">
              <div className="flex justify-between text-sm sm:text-base font-black text-slate-900">
                <span>المجموع الصافي:</span>
                <span className="text-emerald-700 font-sans">{formatCurrency(sale.total)}</span>
              </div>
              {sale.paymentMethod === 'credit' && (
                <div className="flex justify-between text-xs font-bold text-amber-800 bg-amber-100/60 p-1.5 rounded">
                  <span>المبلغ المسجل كدين:</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
              )}
            </div>

            {/* Store Greeting Footer */}
            <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-600 font-sans space-y-1">
              <p className="font-semibold">{storeInfo.footerMessage}</p>
              <p className="text-[10px] text-slate-400">سوبيرات الهناء ترحب بكم دائمًا</p>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden in Print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow active:scale-95 transition text-xs sm:text-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
            <button
              onClick={handleDownloadText}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl shadow active:scale-95 transition text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span>حفظ الفاتورة</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold py-2 px-3 rounded-xl transition text-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة الفاتورة</span>
            </button>
            <button
              onClick={onClose}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-xl transition text-xs"
            >
              فاتورة جديدة (كاشير)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
