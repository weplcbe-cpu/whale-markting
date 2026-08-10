import { useEffect, useState } from 'react';

const browserIsOnline = () => typeof navigator === 'undefined' ? true : navigator.onLine;

export const useConnectivity = ({ onReconnect } = {}) => {
  const [isOnline, setIsOnline] = useState(browserIsOnline);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      onReconnect?.();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onReconnect]);

  return { isOnline, isOffline: !isOnline };
};

export const requireOnline = (isOnline, onOffline) => {
  if (isOnline) return true;
  onOffline?.("You're offline. Internet connection is required for this action.");
  return false;
};
