'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { Home, PlusCircle, User, LogOut, Wifi, WifiOff, Bell, Loader } from 'lucide-react';
import styles from './Header.module.css';

export function Header() {
  const { user, isAuthenticated, logout, sseConnected, networkOffline, recentEvent } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Auto-redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login' && pathname !== '/register') {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);

  // Handle SSE Toast notifications
  useEffect(() => {
    if (!recentEvent) return;

    if (recentEvent.type === 'device_status_updated') {
      const isOnline = recentEvent.online;
      setToast({
        message: `Device ${recentEvent.deviceId.substring(0, 6)} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`,
        type: isOnline ? 'success' : 'error',
      });
    } else if (recentEvent.type === 'feeding_completed') {
      setToast({
        message: `Feeding completed! Source: ${recentEvent.source}, Duration: ${recentEvent.openDurationMs / 1000}s`,
        type: 'success',
      });
    } else if (recentEvent.type === 'device_error') {
      setToast({
        message: `Error: ${recentEvent.errorMessage}`,
        type: 'error',
      });
    } else if (recentEvent.type === 'config_applied') {
      setToast({
        message: `Config version ${recentEvent.version} applied to device!`,
        type: 'success',
      });
    }

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [recentEvent]);

  if (!isAuthenticated) return null;

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Offline Banner */}
      {networkOffline && (
        <div className={styles.offlineBanner}>
          <WifiOff size={16} />
          <span>You are currently offline. Working with cached data.</span>
        </div>
      )}

      {/* SSE Connection State Banner */}
      {!networkOffline && !sseConnected && (
        <div className={styles.syncBanner}>
          <Loader size={14} className={styles.spinning} />
          <span>Connecting to realtime server...</span>
        </div>
      )}

      {/* Desktop Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.headerContent}>
          <Link href="/dashboard" className={styles.logo}>
            🐾 Paw<span>Feed</span>
          </Link>

          <nav className={styles.desktopNav}>
            <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`}>
              <Home size={18} />
              Dashboard
            </Link>
            <Link href="/devices/link" className={`${styles.navItem} ${isActive('/devices/link') ? styles.active : ''}`}>
              <PlusCircle size={18} />
              Link Device
            </Link>
            <Link href="/account" className={`${styles.navItem} ${isActive('/account') ? styles.active : ''}`}>
              <User size={18} />
              Account
            </Link>
          </nav>

          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.fullName || user?.email}</span>
            <button onClick={logout} className={`${styles.logoutBtn} glass`}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className={`${styles.mobileBottomNav} glass`}>
        <Link href="/dashboard" className={`${styles.mobileNavItem} ${isActive('/dashboard') ? styles.mobileActive : ''}`}>
          <Home size={22} />
          <span>Home</span>
        </Link>
        <Link href="/devices/link" className={`${styles.mobileNavItem} ${isActive('/devices/link') ? styles.mobileActive : ''}`}>
          <PlusCircle size={22} />
          <span>Link</span>
        </Link>
        <Link href="/account" className={`${styles.mobileNavItem} ${isActive('/account') ? styles.mobileActive : ''}`}>
          <User size={22} />
          <span>Account</span>
        </Link>
        <button onClick={logout} className={styles.mobileNavItem}>
          <LogOut size={22} />
          <span>Logout</span>
        </button>
      </nav>

      {/* Toast Notification Popup */}
      {toast && (
        <div className={`${styles.toast} glass ${styles[toast.type]} animate-fade-in`}>
          <Bell size={18} className={styles.toastIcon} />
          <div className={styles.toastText}>{toast.message}</div>
        </div>
      )}
    </>
  );
}
