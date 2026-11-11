import React from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  Receipt,
  TrendingUp,
  Cpu,
  QrCode,
  Trash2,
} from 'lucide-react';

interface NavigationProps {
  activeView: string;
  setActiveView: (view: string) => void;
  trashCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeView,
  setActiveView,
  trashCount,
}) => {
  const navItems = [
    { id: 'pos', label: 'الكاشير والمبيعات', shortLabel: 'الكاشير', icon: ShoppingCart },
    { id: 'products', label: 'المنتجات والمخزون', shortLabel: 'المنتجات', icon: Package },
    { id: 'customers', label: 'الزبائن والديون', shortLabel: 'الزبائن', icon: Users },
    { id: 'expenses', label: 'مصاريف المحل', shortLabel: 'المصاريف', icon: Receipt },
    { id: 'reports', label: 'التقارير والأرباح', shortLabel: 'التقارير', icon: TrendingUp },
    { id: 'pairing', label: 'ربط الأجهزة والإعدادات', shortLabel: 'الربط', icon: QrCode },
    { id: 'tests', label: 'فحص واختبارات النظام', shortLabel: 'الفحص', icon: Cpu },
  ];

  return (
    <>
      {/* Desktop Top Navigation Bar */}
      <nav className="no-print hidden md:block bg-white border-b border-slate-200 select-none shadow-xs sticky top-[57px] z-30">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Optimized for store phone usage) */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 select-none shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-safe">
        <div className="grid grid-cols-6 h-14 items-center">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex flex-col items-center justify-center h-full transition ${
                  isActive ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] mt-0.5 tracking-tighter truncate max-w-[54px]">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}

          {/* 6th item: Diagnostics / More */}
          <button
            onClick={() => setActiveView(activeView === 'pairing' ? 'tests' : 'pairing')}
            className={`flex flex-col items-center justify-center h-full transition ${
              activeView === 'pairing' || activeView === 'tests' || activeView === 'trash'
                ? 'text-emerald-600 font-black'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tighter">الإعدادات</span>
          </button>
        </div>
      </nav>
    </>
  );
};
