import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Per AI Studio runtime environment constraints:
// HMR is disabled or restricted in sandboxed proxies, suppress WebSocket reconnection notices.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (msg.includes('WebSocket') || msg.includes('closed without opened')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('WebSocket') || msg.includes('closed without opened')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
