'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
          // Installation through the browser menu remains available if registration fails.
        });
      } else {
        void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
          registrations.filter(registration => {
            const worker = registration.active || registration.waiting || registration.installing;
            return worker && new URL(worker.scriptURL).pathname === '/sw.js';
          }).map(registration => registration.unregister()),
        )).catch(() => {});
        if ('caches' in window) void caches.keys().then(keys => Promise.all(
          keys.filter(key => key.startsWith('vynx-static-') || key.startsWith('vynx-pwa-')).map(key => caches.delete(key)),
        )).catch(() => {});
      }
    }
  }, []);

  return null;
}
