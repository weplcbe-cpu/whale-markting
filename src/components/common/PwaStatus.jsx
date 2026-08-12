import React, { useCallback } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../../context/AppContext';
import { useConnectivity } from '../../hooks/useConnectivity';

const PwaStatusInner = () => {
  const { currentUser, refreshAllData } = useApp();
  const refreshAfterReconnect = useCallback(() => {
    if (currentUser?.id) refreshAllData().catch(() => undefined);
  }, [currentUser?.id, refreshAllData]);
  const { isOffline } = useConnectivity({ onReconnect: refreshAfterReconnect });
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  return <div className="pwa-status-region" aria-live="polite">
    {isOffline && <div className="pwa-status pwa-status--offline" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <span>You're offline. Internet connection is required for live company data.</span>
    </div>}
    {needRefresh && <div className="pwa-status pwa-status--update" role="status">
      <RefreshCw size={18} aria-hidden="true" />
      <strong>New version available</strong>
      <span className="pwa-status__actions">
        <button type="button" onClick={() => setNeedRefresh(false)}><X size={15} /> Later</button>
        <button type="button" className="pwa-status__primary" onClick={() => updateServiceWorker(true)}>Update Now</button>
      </span>
    </div>}
  </div>;
};

export const PwaStatus = () => {
  // Prevent service worker registration and PWA update UI inside native Capacitor shells.
  // The native app uses bundled assets and updates via the App Store/Play Store.
  if (Capacitor.isNativePlatform()) {
    return null;
  }
  return <PwaStatusInner />;
};
