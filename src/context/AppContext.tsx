'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../lib/types';
import { authApi } from '../lib/api';
import { useSse, SseEventData } from '../lib/useSse';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sseConnected: boolean;
  networkOffline: boolean;
  recentEvent: SseEventData | null;
  login: (credentials: Record<string, string>) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  updateUserFullName: (name: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkOffline, setNetworkOffline] = useState<boolean>(false);
  const [recentEvent, setRecentEvent] = useState<SseEventData | null>(null);

  // Initialize Auth from localStorage
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (accessToken && storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);

    // Monitor network connectivity
    const handleOnline = () => setNetworkOffline(false);
    const handleOffline = () => setNetworkOffline(true);

    if (typeof window !== 'undefined') {
      setNetworkOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for SSE updates when authenticated
  const { connected: sseConnected } = useSse((event) => {
    setRecentEvent(event);
    // Auto-clear recent event after 4 seconds to clear toasts
    setTimeout(() => {
      setRecentEvent((prev) => (prev && prev.id === event.id ? null : prev));
    }, 4000);
  });

  const login = async (credentials: Record<string, string>) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(credentials);
      setUser(res.user);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: Record<string, string>) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      setUser(res.user);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserFullName = (name: string) => {
    if (user) {
      setUser({ ...user, fullName: name });
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        sseConnected: isAuthenticated && sseConnected,
        networkOffline,
        recentEvent,
        login,
        register,
        logout,
        updateUserFullName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
