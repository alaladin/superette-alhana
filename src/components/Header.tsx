import React, { useState, useEffect } from 'react';
import {
  Store,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Trash2,
  Cpu,
  Smartphone,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { StoreInfo } from '../types';
import { syncEngine, SyncState } from '../lib/syncEngine';
import { PWAInstallButton } from './common/PWAInstallButton';
import { storage } from '../lib/storage';

interface HeaderProps {
  storeInfo: StoreInfo;
  activeView: string;
  setActiveView: (view: string) => void;
  trashCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  storeInfo,
  activeView,
  setActiveView,
  trashCount,
}) => {
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = () => {
    syncEngine.sync();
  };

  return (
    <header className="no-print bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 select-none shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        
        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveView('pos')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
              <span>{storeInfo.name}</span>
              <span className="hidden sm:inline-block text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                الجزائر
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden xs:block">{storeInfo.tagline}</p>
          </div>
        </div>

        {/* Status Indicators & Fast Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* PWA In-App Install Button */}
          <PWAInstallButton />

          {/* Sync & Online Status Pill */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-xs">
            {syncState.isOnline ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline text-[11px] font-semibold text-slate-300">متصل بالمحل</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دون اتصال (يعمل محليًا)</span>
              </div>
            )}

            {/* Sync trigger button */}
            <button
              onClick={handleManualSync}
              disabled={syncState.isSyncing}
              className="mr-1.5 p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
              title="مزامنة فورية الآن"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Pending sync outbox badge */}
            {syncState.pendingCount > 0 && (
              <span
                className="bg-amber-500 text-slate-900 font-black text-[10px] px-1.5 py-0.2 rounded-full mr-1"
                title={`${syncState.pendingCount} تعديلات ستُزامن عند الاتصال`}
              >
                {syncState.pendingCount}
              </span>
            )}
          </div>

          {/* Device Pairing Button */}
          <button
            onClick={() => setActiveView('pairing')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeView === 'pairing'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="ربط جهاز جديد عبر QR وإعدادات المحل"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">ربط الأجهزة</span>
          </button>

          {/* Trash Bin */}
          <button
            onClick={() => setActiveView('trash')}
            className={`relative p-2 rounded-xl transition ${
              activeView === 'trash'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title="سلة المحذوفات"
          >
            <Trash2 className="w-4 h-4" />
            {trashCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
