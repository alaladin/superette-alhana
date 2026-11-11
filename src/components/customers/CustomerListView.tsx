import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  DollarSign,
  History,
  Phone,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import { Customer, DebtPayment, Sale } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface CustomerListViewProps {
  customers: Customer[];
  sales: Sale[];
  debtPayments: DebtPayment[];
  onSaveCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalDebt'> & { id?: string; totalDebt?: number }) => void;
  onRecordPayment: (customerId: string, amount: number, notes?: string) => void;
  onDeleteCustomer: (customerId: string) => void;
}

export const CustomerListView: React.FC<CustomerListViewProps> = ({
  customers,
  sales,
  debtPayments,
  onSaveCustomer,
  onRecordPayment,
  onDeleteCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithDebt, setOnlyWithDebt] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  // Form states for Add/Edit
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDebt, setInitialDebt] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Total stats
  const stats = useMemo(() => {
    let totalDebtSum = 0;
    let customersWithDebtCount = 0;

    customers.forEach(c => {
      totalDebtSum += c.totalDebt || 0;
      if (c.totalDebt > 0) customersWithDebtCount++;
    });

    return {
      totalCustomers: customers.length,
      totalDebtSum,
      customersWithDebtCount,
    };
  }, [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => {
        const matchesSearch =
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery);
        const matchesDebt = !onlyWithDebt || c.totalDebt > 0;
        return matchesSearch && matchesDebt;
      })
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [customers, searchQuery, onlyWithDebt]);

  const openAddModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone || '');
      setInitialDebt(customer.totalDebt || '');
      setNotes(customer.notes || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setInitialDebt('');
      setNotes('');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveCustomer({
      id: editingCustomer?.id,
      name: name.trim(),
      phone: phone.trim(),
      totalDebt: Number(initialDebt) || 0,
      notes: notes.trim(),
    });

    setIsAddModalOpen(false);
  };

  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ سداد صحيح.');
      return;
    }
    onRecordPayment(paymentCustomer.id, amount, paymentNotes.trim());
    toast.success(`تم تسجيل سداد ${formatCurrency(amount)} للزبون ${paymentCustomer.name}.`);
    setPaymentCustomer(null);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const handleDelete = (cust: Customer) => {
    setCustomerToDelete(cust);
  };

  const confirmDeleteCustomer = () => {
    if (customerToDelete) {
      onDeleteCustomer(customerToDelete.id);
      toast.info(`تم نقل الزبون «${customerToDelete.name}» إلى سلة المحذوفات.`);
      setCustomerToDelete(null);
    }
  };

  // Get selected customer transactions for ledger
  const customerLedger = useMemo(() => {
    if (!historyCustomer) return { creditSales: [], payments: [] };
    const creditSales = sales.filter(
      s => s.customerId === historyCustomer.id && s.paymentMethod === 'credit'
    );
    const payments = debtPayments.filter(
      p => p.customerId === historyCustomer.id && !p.isDeleted
    );
    return { creditSales, payments };
  }, [historyCustomer, sales, debtPayments]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Debt Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي الديون المستحقة على الزبائن:</span>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 mt-1 font-sans">
            {formatCurrency(stats.totalDebtSum)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">مبالغ يجب تحصيلها</span>
        </div>

        <div
          onClick={() => setOnlyWithDebt(!onlyWithDebt)}
          className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm flex flex-col justify-between ${
            stats.customersWithDebtCount > 0
              ? 'bg-amber-50/70 border-amber-300 text-amber-950 hover:bg-amber-100/60'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-xs font-bold text-amber-900">زبائن لديهم ديون جارية:</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1 font-sans">
            {stats.customersWithDebtCount}
          </div>
          <span className="text-[11px] text-amber-700">اضغط لتصفية من عليهم دين فقط</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي الزبائن المسجلين:</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-sans">
            {stats.totalCustomers}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">زبون في دفتر الحسابات</span>
        </div>
      </div>

      {/* Action and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => openAddModal()}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة زبون جديد</span>
        </button>

        <div className="relative flex-1 sm:w-72 max-w-md">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الزبون أو رقم هاتفه..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Customer List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">لا يوجد زبائن مطابقين</p>
            <p className="text-xs text-slate-400 mt-1">
              سجل زبائنك لربط فواتير الكريدي ومتابعة سجل السداد بدقة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">اسم الزبون</th>
                  <th className="py-3 px-3">رقم الهاتف</th>
                  <th className="py-3 px-3 text-center">الدين المستحق (الكريدي)</th>
                  <th className="py-3 px-3">ملاحظات</th>
                  <th className="py-3 px-4 text-left">إجراءات الدفع والتقرير</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const hasDebt = cust.totalDebt > 0;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{cust.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          تاريخ التسجيل: {formatDate(cust.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {cust.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">غير مسجل</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold font-sans ${
                            hasDebt
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {formatCurrency(cust.totalDebt)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                        {cust.notes || '-'}
                      </td>

                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Record Payment Button */}
                          {hasDebt && (
                            <button
                              onClick={() => {
                                setPaymentCustomer(cust);
                                setPaymentAmount(cust.totalDebt);
                              }}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                              title="تسديد دفعة كاملة أو جزئية"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>تسديد دفعة</span>
                            </button>
                          )}

                          {/* Ledger & History */}
                          <button
                            onClick={() => setHistoryCustomer(cust)}
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                            title="عرض كشف الحساب وفواتير الدين السابقة"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>كشف الحساب</span>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openAddModal(cust)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                            title="تعديل الزبون"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(cust)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="حذف الزبون"
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

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 text-right">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'تعديل بيانات الزبون' : 'إضافة زبون جديد'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد بلقاسم أو عمي السعيد"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0550 00 00 00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرصيد الافتتاحي للدين (دج): <span className="text-slate-400 font-normal">إن كان لديه دين سابق</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={initialDebt}
                  onChange={(e) => setInitialDebt(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0 دج"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات / عنوان:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: ساكن عمارة ب الطابق 2، زبون قديم..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow transition"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD DEBT PAYMENT MODAL */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 text-right">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">تسديد دفعة دين: {paymentCustomer.name}</h3>
              </div>
              <button
                onClick={() => setPaymentCustomer(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900">إجمالي الدين المستحق حاليًا:</span>
              <span className="font-black text-rose-700 text-lg font-sans">
                {formatCurrency(paymentCustomer.totalDebt)}
              </span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المسدد (دج):
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={paymentCustomer.totalDebt}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="أدخل المبلغ المسدد"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base font-bold text-center text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  autoFocus
                />
                {typeof paymentAmount === 'number' && (
                  <div className="mt-2 text-xs font-bold text-center text-emerald-700">
                    الدين المتبقي بعد هذا السداد: {formatCurrency(Math.max(0, paymentCustomer.totalDebt - paymentAmount))}
                  </div>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentAmount(paymentCustomer.totalDebt)}
                  className="flex-1 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  تسديد كامل الدين
                </button>
                {paymentCustomer.totalDebt > 1000 && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(1000)}
                    className="py-1.5 px-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    1,000 دج
                  </button>
                )}
                {paymentCustomer.totalDebt > 2000 && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(2000)}
                    className="py-1.5 px-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    2,000 دج
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة السداد:</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="مثال: تسديد نقدي في المحل"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow transition"
                >
                  تأكيد خصم الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER LEDGER & DEBT HISTORY MODAL */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 text-right my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">سجل الديون والدفعات: {historyCustomer.name}</h3>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Banner */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold">الرصيد المتبقي حاليًا:</span>
                <div className="text-xl font-black text-rose-700 font-sans">
                  {formatCurrency(historyCustomer.totalDebt)}
                </div>
              </div>
              <div className="text-xs text-slate-500 text-left">
                <span>هاتف: {historyCustomer.phone || 'غير مسجل'}</span>
              </div>
            </div>

            {/* History List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>فواتير الشراء بالدين ({customerLedger.creditSales.length}):</span>
                </h4>
                {customerLedger.creditSales.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">لا توجد فواتير دين مسجلة.</p>
                ) : (
                  <div className="space-y-2">
                    {customerLedger.creditSales.map(sale => (
                      <div key={sale.id} className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-800">{sale.invoiceNumber}</span>
                          <span className="text-rose-700 font-sans">{formatCurrency(sale.total)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between">
                          <span>{formatDate(sale.createdAt)}</span>
                          <span>{sale.items.length} سلع ({sale.items.map(i => i.name).slice(0, 2).join('، ')}...)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>دفعات السداد المسجلة ({customerLedger.payments.length}):</span>
                </h4>
                {customerLedger.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">لم يتم تسديد أي دفعات بعد.</p>
                ) : (
                  <div className="space-y-2">
                    {customerLedger.payments.map(pay => (
                      <div key={pay.id} className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-emerald-800">دفعة مسددة: {formatCurrency(pay.amount)}</span>
                          <span className="text-slate-500 font-normal">المتبقي بعدها: {formatCurrency(pay.newDebt)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between">
                          <span>{formatDate(pay.date)}</span>
                          <span>{pay.notes || 'تسديد نقدي'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-left">
              <button
                onClick={() => setHistoryCustomer(null)}
                className="py-2 px-5 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Customer Confirmation Modal */}
      <ConfirmModal
        isOpen={!!customerToDelete}
        title="حذف الزبون إلى سلة المحذوفات"
        message={
          customerToDelete?.totalDebt && customerToDelete.totalDebt > 0
            ? `تنبيه: هذا الزبون عليه دين متبقي قدره ${formatCurrency(customerToDelete.totalDebt)}. هل تريد بالتأكيد نقله لسلة المحذوفات؟ يمكن استرجاعه دائمًا.`
            : `هل أنت متأكد من حذف الزبون «${customerToDelete?.name || ''}» ونقله لسلة المحذوفات؟`
        }
        confirmLabel="حذف الزبون"
        onConfirm={confirmDeleteCustomer}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
};
