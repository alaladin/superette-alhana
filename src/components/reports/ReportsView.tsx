import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  RotateCcw,
  Printer,
  Calendar,
  Package,
  Award,
  Users,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Customer, DebtPayment, Expense, Product, Sale, StoreInfo } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface ReportsViewProps {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  debtPayments: DebtPayment[];
  storeInfo: StoreInfo;
  onReturnSale: (saleId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  sales,
  expenses,
  products,
  customers,
  debtPayments,
  storeInfo,
  onReturnSale,
}) => {
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('today');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  // Filter dates
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const date = s.createdAt.slice(0, 10);
      if (period === 'today') return date === todayStr;
      if (period === 'month') return s.createdAt.startsWith(currentMonthStr);
      return true;
    });
  }, [sales, period, todayStr, currentMonthStr]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const date = (e.date || e.createdAt).slice(0, 10);
      if (period === 'today') return date === todayStr;
      if (period === 'month') return (e.date || e.createdAt).startsWith(currentMonthStr);
      return true;
    });
  }, [expenses, period, todayStr, currentMonthStr]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let completedSalesRevenue = 0;
    let completedGrossProfit = 0;
    let cashSalesTotal = 0;
    let creditSalesTotal = 0;
    let completedCount = 0;
    let returnedCount = 0;

    filteredSales.forEach(s => {
      if (s.status === 'completed') {
        completedSalesRevenue += s.total;
        completedGrossProfit += s.profit;
        completedCount++;
        if (s.paymentMethod === 'cash') {
          cashSalesTotal += s.total;
        } else {
          creditSalesTotal += s.total;
        }
      } else {
        returnedCount++;
      }
    });

    const expensesTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = completedGrossProfit - expensesTotal;

    // Inventory value
    let totalStockCost = 0;
    let totalStockRetail = 0;
    products.forEach(p => {
      totalStockCost += p.stockQuantity * p.purchasePrice;
      totalStockRetail += p.stockQuantity * p.sellingPrice;
    });

    // Total outstanding debt
    const totalDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);

    return {
      completedSalesRevenue,
      completedGrossProfit,
      expensesTotal,
      netProfit,
      cashSalesTotal,
      creditSalesTotal,
      completedCount,
      returnedCount,
      totalStockCost,
      totalStockRetail,
      totalDebt,
    };
  }, [filteredSales, filteredExpenses, products, customers]);

  // Top Selling Products calculation
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number; unit: string }>();

    filteredSales
      .filter(s => s.status === 'completed')
      .forEach(s => {
        s.items.forEach(item => {
          const existing = map.get(item.productId) || {
            name: item.name,
            quantity: 0,
            revenue: 0,
            unit: item.unit,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          map.set(item.productId, existing);
        });
      });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [filteredSales]);

  const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);

  const handleReturnClick = (sale: Sale) => {
    setSaleToReturn(sale);
  };

  const confirmReturnSale = () => {
    if (saleToReturn) {
      onReturnSale(saleToReturn.id);
      toast.success(`تم تسجيل إرجاع الفاتورة ${saleToReturn.invoiceNumber} وإعادة السلع للمخزون.`);
      setSaleToReturn(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Time Period Filter Tabs */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <span className="font-bold text-sm text-slate-800">الفترة الزمنية للتقرير:</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-xl transition ${
              period === 'today'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            اليوم ({todayStr})
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-xl transition ${
              period === 'month'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            هذا الشهر ({currentMonthStr})
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-xl transition ${
              period === 'all'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            كل الأوقات (شامل)
          </button>
        </div>
      </div>

      {/* Primary Financial Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي المبيعات المحققة:</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-sans">
            {formatCurrency(metrics.completedSalesRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span>نقدًا: {formatCurrency(metrics.cashSalesTotal)}</span>
            <span>دين: {formatCurrency(metrics.creditSalesTotal)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between ${
          metrics.netProfit >= 0 ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50 border-rose-300'
        }`}>
          <span className="text-xs font-bold text-slate-700">صافي الأرباح (بعد المصاريف):</span>
          <div className={`text-xl sm:text-2xl font-black mt-1 font-sans ${
            metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {formatCurrency(metrics.netProfit)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            ربح البضاعة: +{formatCurrency(metrics.completedGrossProfit)}
          </span>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">مصاريف المحل:</span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1 font-sans">
            {formatCurrency(metrics.expensesTotal)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">{filteredExpenses.length} بنود مصروفات</span>
        </div>

        {/* Outstanding Debts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي ديون الزبائن المستحقة:</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1 font-sans">
            {formatCurrency(metrics.totalDebt)}
          </div>
          <span className="text-[11px] text-amber-600 font-medium mt-1">قيمة مستحقة للتحصيل</span>
        </div>
      </div>

      {/* Top Selling Products Leaderboard */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-sm sm:text-base text-slate-900">
            المنتجات الأكثر مبيعًا خلال هذه الفترة:
          </h3>
        </div>

        {topProducts.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            لا توجد مبيعات مكتملة مسجلة في هذه الفترة بعد.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {topProducts.map((p, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-150 bg-slate-50 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-900 truncate max-w-[120px]">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    الكمية المباعة: <strong>{p.quantity} {p.unit === 'kg' ? 'كغ' : ''}</strong>
                  </div>
                </div>
                <div className="text-left font-black text-xs text-emerald-700 font-sans">
                  {formatCurrency(p.revenue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sales Invoices Ledger & Cancellation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              سجل فواتير البيع ({filteredSales.length})
            </h3>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            لا توجد فواتير بيع في هذه الفترة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-3">التاريخ والوقت</th>
                  <th className="py-3 px-3">طريقة الدفع</th>
                  <th className="py-3 px-3">عدد السلع</th>
                  <th className="py-3 px-3">المجموع الصافي</th>
                  <th className="py-3 px-3">الربح</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                      {sale.invoiceNumber}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      {formatDate(sale.createdAt)}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        sale.paymentMethod === 'credit'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {sale.paymentMethod === 'credit' ? `دين (${sale.customerName || 'عام'})` : 'نقدًا'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-700">
                      {sale.items.length} سلع
                    </td>

                    <td className="py-3 px-3 font-bold font-sans text-slate-900 text-sm">
                      {formatCurrency(sale.total)}
                    </td>

                    <td className="py-3 px-3 font-sans font-bold text-emerald-700">
                      +{formatCurrency(sale.profit)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        sale.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {sale.status === 'completed' ? 'مكتملة' : sale.status === 'returned' ? 'مرتجع' : 'ملغاة'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold transition"
                          title="عرض وطباعة الفاتورة"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>

                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleReturnClick(sale)}
                            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-xs font-bold transition"
                            title="إرجاع البضاعة وإلغاء الفاتورة"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إرجاع</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={!!selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
        sale={selectedSaleForReceipt}
        storeInfo={storeInfo}
      />

      {/* Return Sale Confirmation Modal */}
      <ConfirmModal
        isOpen={!!saleToReturn}
        title="تأكيد إرجاع الفاتورة"
        message={`هل أنت متأكد من تسجيل إرجاع الفاتورة «${saleToReturn?.invoiceNumber || ''}»؟ سيتم إعادة السلع تلقائيًا إلى المخزون وتعديل رصيد الزبون إن كانت بالدين.`}
        confirmLabel="إرجاع الفاتورة"
        onConfirm={confirmReturnSale}
        onCancel={() => setSaleToReturn(null)}
      />
    </div>
  );
};
