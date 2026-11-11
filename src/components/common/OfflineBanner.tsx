import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { syncEngine, SyncState } from '../../lib/syncEngine';

export const OfflineBanner: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => {
    return syncEngine.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  if (syncState.isOnline) return null;

  return (
    <aside
      aria-label="حالة الاتصال"
      className="no-print bg-amber-500 text-slate-900 px-3 py-1.5 text-xs font-bold shadow-md flex items-center justify-between z-30 sticky top-[57px] md:top-[103px]"
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        <WifiOff className="w-3.5 h-3.5" />
        <span>
          أنت تعمل الآن دون اتصال بالإنترنت — جميع المبيعات والمخزون تحفظ على جهازك وستُزامن تلقائيًا فور عودة الشبكة.
        </span>
      </div>
    </aside>
  );
};
