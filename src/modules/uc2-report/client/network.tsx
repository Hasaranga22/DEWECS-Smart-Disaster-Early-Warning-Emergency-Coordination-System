'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  simulateOffline: boolean;
  setSimulateOffline: (offline: boolean) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  simulateOffline: false,
  setSimulateOffline: () => {},
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ 
      isOnline: simulateOffline ? false : isOnline, 
      simulateOffline, 
      setSimulateOffline 
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkStatus = () => useContext(NetworkContext);
