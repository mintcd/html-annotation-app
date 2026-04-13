'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let mounted = true;

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (!mounted) return;
        console.log('Service worker registered:', registration);
      } catch (e) {
        console.warn('Service worker registration failed:', e);
      }
    }

    registerSW();

    return () => { mounted = false; };
  }, []);

  return null;
}