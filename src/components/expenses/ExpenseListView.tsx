import React, { useState, useMemo } from 'react';
import { Plus, Receipt, Trash2, Calendar, DollarSign, X } from 'lucide-react';
import { Expense, ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORY_LABELS, formatCurrency, formatDate } from '../../lib/formatters';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface ExpenseListViewProps {
  expenses: Expense[];
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({
  expenses,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('electricity');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Calculate monthly & total stats
  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let thisMonthTotal = 0;
    let allTimeTotal = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach(e => {
      allTimeTotal += e.amount;
      if (e.date && e.date.startsWith(currentMonth)) {
        thisMonthTotal += e.amount;
      }
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    return {
      thisMonthTotal,
      allTimeTotal,
      count: expenses.length,
      categoryTotals,
    };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        return selectedCategoryFilter === 'all' || e.category === selectedCategoryFilter;
      })
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [expenses, selectedCategoryFilter]);

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!title.trim() || !numAmount || numAmount <= 0) {
      toast.error('يرجى إدخال عنوان ومبلغ المصروف بشكل صحيح.');
      return;
    }

    onSaveExpense({
      title: title.trim(),
      category: category as ExpenseCategory,
      amount: numAmount,
      date: date || new Date().toISOString(),
      notes: notes.trim(),
    });

    toast.success('تم تسجيل المصروف بنجاح.');
    setIsAddModalOpen(false);
    setTitle('');
    setAmount('');
    setNotes('');
  };

  const handleDelete = (exp: Expense) => {
    setExpenseToDelete(exp);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      toast.info(`تم نقل «${expenseToDelete.title}» إلى سلة المحذوفات.`);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">مصاريف هذا الشهر:</span>
          <div className="text-2xl sm:text-3xl font-black text-rose-700 mt-1 font-sans">
            {formatCurrency(stats.thisMonthTotal)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">شهر {new Date().toLocaleDateString('ar-DZ', { month: 'long', year: 'numeric' })}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">إجمالي المصاريف المسجلة:</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-sans">
            {formatCurrency(stats.allTimeTotal)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">{stats.count} مصروف مسجل</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold">أكبر بند مصاريف:</span>
          <div className="text-lg font-bold text-slate-800 mt-1">
            {Object.keys(stats.categoryTotals).length > 0
              ? EXPENSE_CATEGORY_LABELS[Object.entries(stats.categoryTotals).sort((a, b) => b[1] - a[1])[0][0] as ExpenseCategory] || 'عام'
              : 'لا يوجد بعد'}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5">وفق إجمالي الدفعات</span>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل مصروف جديد</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-bold">تصنيف:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-700 text-xs focus:outline-none focus:border-emerald-600"
          >
            <option value="all">جميع التصنيفات</option>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">لا توجد مصاريف مسجلة</p>
            <p className="text-xs text-slate-400 mt-1">
              سجل فواتير الكهرباء، الأكياس، كراء المحل وغيرها لحساب الأرباح الصافية بدقة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">عنوان المصروف</th>
                  <th className="py-3 px-3">التصنيف</th>
                  <th className="py-3 px-3 font-sans">المبلغ</th>
                  <th className="py-3 px-3">التاريخ</th>
                  <th className="py-3 px-3">ملاحظات</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {exp.title}
                    </td>

                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {EXPENSE_CATEGORY_LABELS[exp.category] || 'عام'}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-black text-rose-700 text-sm font-sans">
                      {formatCurrency(exp.amount)}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      {exp.date ? exp.date.slice(0, 10) : formatDate(exp.createdAt)}
                    </td>

                    <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                      {exp.notes || '-'}
                    </td>

                    <td className="py-3 px-4 text-left">
                      <button
                        onClick={() => handleDelete(exp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="حذف المصروف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 text-right">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-base">تسجيل مصروف جديد</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  بيان المصروف: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء سونلغاز ثلاثية 1، أكياس بلاستيك..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ (دج): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-rose-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ:</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="رقم الوصل أو تفاصيل أخرى..."
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
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="حذف المصروف إلى سلة المحذوفات"
        message={`هل أنت متأكد من حذف مصروف «${expenseToDelete?.title || ''}»؟ يمكن استرجاعه دائمًا من سلة المحذوفات.`}
        confirmLabel="حذف المصروف"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
};
