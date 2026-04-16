'use client';

import { useEffect } from 'react';
import syncWithServer from '../utils/sync';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let mounted = true;
    let messageHandler: ((ev: MessageEvent) => void) | null = null;

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (!mounted) return;
        console.log('Service worker registered:', registration);

        // Listen for messages from the service worker for debug/info
        try {
          messageHandler = (ev: MessageEvent) => {
            try { console.log('ServiceWorker message:', ev.data); } catch (e) { /* ignore */ }
          };
          navigator.serviceWorker.addEventListener('message', messageHandler);
        } catch (e) { /* ignore */ }

        // After registration, attempt an initial sync pull from the server
        try { await syncWithServer(); } catch (e) { console.warn('initial sync failed', e); }
      } catch (e) {
        console.warn('Service worker registration failed:', e);
      }
    }

    registerSW();

    return () => {
      mounted = false;
      try { if (messageHandler) navigator.serviceWorker.removeEventListener('message', messageHandler); } catch (e) { /* ignore */ }
    };
  }, []);

  return null;
}