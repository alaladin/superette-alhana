type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastService {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn([...this.toasts]));
  }

  public show(message: string, type: ToastType = 'info', duration = 3500) {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const item: ToastItem = { id, type, message, duration };
    this.toasts.push(item);
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  public success(message: string, duration = 3500) {
    this.show(message, 'success', duration);
  }

  public error(message: string, duration = 4500) {
    this.show(message, 'error', duration);
  }

  public info(message: string, duration = 3500) {
    this.show(message, 'info', duration);
  }

  public remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }
}

export const toast = new ToastService();
