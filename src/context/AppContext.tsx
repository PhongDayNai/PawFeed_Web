'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse, Device, DashboardData } from '../lib/types';
import { authApi, deviceApi } from '../lib/api';
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
  // Shared values
  devices: Device[] | null;
  devicesLoading: boolean;
  fetchDevices: (isRefresh?: boolean) => Promise<void>;
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  fetchDashboardData: (isRefresh?: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkOffline, setNetworkOffline] = useState<boolean>(false);
  const [recentEvent, setRecentEvent] = useState<SseEventData | null>(null);

  // Shared state
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);

  // Shared state refs to prevent infinite loop in fetch callbacks
  const devicesRef = React.useRef<Device[] | null>(null);
  const dashboardDataRef = React.useRef<DashboardData | null>(null);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    dashboardDataRef.current = dashboardData;
  }, [dashboardData]);

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

  const fetchDevices = useCallback(async (isRefresh = false) => {
    if (!localStorage.getItem('accessToken')) return;
    if (!isRefresh && !devicesRef.current) {
      setDevicesLoading(true);
    }
    try {
      const res = await deviceApi.getDevices();
      setDevices(res.devices);
    } catch (err) {
      console.error('Failed to fetch devices', err);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (!localStorage.getItem('accessToken')) return;
    if (!isRefresh && !dashboardDataRef.current) {
      setDashboardLoading(true);
    }
    try {
      const dashboard = await deviceApi.getDashboard();
      setDashboardData(dashboard);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDevices();
      fetchDashboardData();
    } else {
      setDevices(null);
      setDashboardData(null);
    }
  }, [isAuthenticated, fetchDevices, fetchDashboardData]);

  // Listen for SSE updates when authenticated
  const { connected: sseConnected } = useSse((event) => {
    setRecentEvent(event);
    // Auto-clear recent event after 4 seconds to clear toasts
    setTimeout(() => {
      setRecentEvent((prev) => (prev && prev.id === event.id ? null : prev));
    }, 4000);
  });

  // Auto-refresh when relevant SSE events are received
  useEffect(() => {
    if (recentEvent && isAuthenticated) {
      if (['device_status_updated', 'feeding_completed', 'config_applied'].includes(recentEvent.type)) {
        fetchDashboardData(true);
        fetchDevices(true);
      }
    }
  }, [recentEvent, isAuthenticated, fetchDashboardData, fetchDevices]);

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
      setDevices(null);
      setDashboardData(null);
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
        devices,
        devicesLoading,
        fetchDevices,
        dashboardData,
        dashboardLoading,
        fetchDashboardData,
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
