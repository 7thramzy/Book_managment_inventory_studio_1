import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for Offline Caching & Background Sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Ignore service worker registration errors in restricted iframe sandboxes
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
