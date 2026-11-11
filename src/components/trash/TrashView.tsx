import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, Users, Receipt } from 'lucide-react';
import { TrashItem } from '../../types';
import { formatDate } from '../../lib/formatters';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../../lib/toast';

interface TrashViewProps {
  trashItems: TrashItem[];
  onRestore: (trashItemId: string) => void;
  onPermanentDelete: (trashItemId: string) => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  trashItems,
  onRestore,
  onPermanentDelete,
}) => {
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<TrashItem | null>(null);

  const getIcon = (type: TrashItem['entityType']) => {
    switch (type) {
      case 'product':
        return <Package className="w-4 h-4 text-emerald-600" />;
      case 'customer':
        return <Users className="w-4 h-4 text-amber-600" />;
      case 'expense':
        return <Receipt className="w-4 h-4 text-rose-600" />;
      default:
        return <Trash2 className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeLabel = (type: TrashItem['entityType']) => {
    switch (type) {
      case 'product':
        return 'سلعة / منتج';
      case 'customer':
        return 'زبون';
      case 'expense':
        return 'مصروف';
      default:
        return 'عنصر';
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <span>سلة المحذوفات (الحذف القابل للاسترجاع)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            جميع العناصر المحذوفة تبقى محفوظة هنا ويمكن استرجاعها بضغطة زر دون فقدان أي بيانات.
          </p>
        </div>
        <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
          {trashItems.length} عنصر محذوف
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {trashItems.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 text-xs">
            سلة المحذوفات فارغة حاليًا. لا توجد عناصر محذوفة.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trashItems.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl mt-0.5">{getIcon(item.entityType)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/70 text-slate-700">
                        {getTypeLabel(item.entityType)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.details}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      تاريخ الحذف: {formatDate(item.deletedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      onRestore(item.id);
                      toast.success(`تم استرجاع «${item.name}» إلى القائمة النشطة بنجاح.`);
                    }}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استرجاع للنشط</span>
                  </button>

                  <button
                    onClick={() => setItemToPermanentDelete(item)}
                    className="flex items-center gap-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition"
                    title="حذف نهائي لا رجعة فيه"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف نهائي</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToPermanentDelete}
        title="حذف نهائي لا رجعة فيه"
        message={`تحذير نهائي: هل تريد بالتأكيد حذف «${itemToPermanentDelete?.name || ''}» نهائيًا من الوجود؟ لن يمكن استرجاعه بعد ذلك أبدًا.`}
        confirmLabel="تأكيد الحذف النهائي"
        onConfirm={() => {
          if (itemToPermanentDelete) {
            onPermanentDelete(itemToPermanentDelete.id);
            toast.info(`تم حذف «${itemToPermanentDelete.name}» نهائيًا.`);
            setItemToPermanentDelete(null);
          }
        }}
        onCancel={() => setItemToPermanentDelete(null)}
      />
    </div>
  );
};
