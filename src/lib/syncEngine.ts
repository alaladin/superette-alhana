import { storage } from './storage';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  isPaired: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  syncError: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private isPaired: boolean = true;
  private syncError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private timer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.sync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Periodic background sync every 15 seconds if online
      this.timer = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.sync();
        }
      }, 15000);

      // Trigger initial sync
      setTimeout(() => this.sync(), 500);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public getState(): SyncState {
    const queue = storage.getOutboxQueue();
    const lastSync = storage.getState().lastSyncTimestamp;
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      isPaired: this.isPaired,
      lastSyncedAt: lastSync || null,
      pendingCount: queue.length,
      syncError: this.syncError,
    };
  }

  /**
   * Run full bidirectional synchronization
   */
  public async sync(): Promise<boolean> {
    if (this.isSyncing || !this.isOnline) return false;

    this.isSyncing = true;
    this.syncError = null;
    this.notify();

    try {
      const shopKey = storage.getShopKey();

      // Step 1: Push pending local changes to server if any
      const state = storage.getState();
      const outbox = storage.getOutboxQueue();

      if (outbox.length > 0) {
        // Snapshot the queue and payload before awaiting the network. New edits made
        // during this request remain queued and are not acknowledged accidentally.
        const outboxSnapshot = outbox.map(item => ({ ...item }));
        const pushPayload = {
          products: state.products.map(item => ({ ...item })),
          sales: state.sales.map(item => ({ ...item })),
          customers: state.customers.map(item => ({ ...item })),
          debtPayments: state.debtPayments.map(item => ({ ...item })),
          expenses: state.expenses.map(item => ({ ...item })),
          trashItems: state.trashItems.map(item => ({ ...item })),
          storeInfo: { ...state.storeInfo },
          outboxQueue: outboxSnapshot,
        };

        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-shop-key': shopKey,
          },
          body: JSON.stringify(pushPayload),
        });

        if (pushRes.status === 401) {
          this.isPaired = false;
          this.syncError = 'الجهاز غير مقترن بسوبيرات الهناء. يلزم مسح رمز QR.';
          this.isSyncing = false;
          this.notify();
          return false;
        }

        if (!pushRes.ok) {
          throw new Error(`خطأ في رفع البيانات (${pushRes.status})`);
        }

        // Acknowledge only the queue entries included in this request.
        storage.clearOutboxQueue(outboxSnapshot.map(item => item.id));
      }

      // Step 2: Pull latest data from server
      const pullRes = await fetch('/api/sync/pull', {
        headers: {
          'x-shop-key': shopKey,
        },
      });

      if (pullRes.status === 401) {
        this.isPaired = false;
        this.syncError = 'الجهاز غير مقترن بسوبيرات الهناء. يلزم مسح رمز QR.';
        this.isSyncing = false;
        this.notify();
        return false;
      }

      if (!pullRes.ok) {
        throw new Error(`خطأ في استقبال البيانات (${pullRes.status})`);
      }

      const serverData = await pullRes.json();
      storage.applyServerSync(serverData);
      storage.setLastSync(new Date().toISOString());

      this.isPaired = true;
      this.syncError = null;
      this.isSyncing = false;
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Sync attempt failed (will retry automatically):', err);
      this.syncError = err.message || 'فشلت المزامنة مؤقتًا';
      this.isSyncing = false;
      this.notify();
      return false;
    }
  }

  /**
   * Pair device using scanned or typed Shop Key
   */
  public async pairWithShopKey(key: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/pair/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopKey: key.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        storage.setShopKey(key.trim());
        if (data.storeInfo) {
          storage.updateStoreInfo(data.storeInfo);
        }
        this.isPaired = true;
        this.syncError = null;
        this.notify();
        await this.sync();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || 'مفتاح الربط غير صحيح.' };
      }
    } catch (err: any) {
      return { success: false, message: 'تعذر الاتصال بالخادم: ' + (err.message || 'خطأ في الشبكة') };
    }
  }
}

export const syncEngine = new SyncEngine();
