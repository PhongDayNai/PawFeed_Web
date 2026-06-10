'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { getFriendlyErrorMessage } from '../lib/error';
import { Home, User, LogOut, WifiOff, Bell, Loader, Globe, Smartphone, History, RefreshCw } from 'lucide-react';
import styles from './Header.module.css';

export function Header() {
  const { user, isAuthenticated, logout, sseConnected, networkOffline, recentEvent, devicesLoading, dashboardLoading } = useApp();
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
  };

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
        message: t(isOnline ? 'nav.toast_online' : 'nav.toast_offline', {
          id: recentEvent.deviceId.substring(0, 6),
        }),
        type: isOnline ? 'success' : 'error',
      });
    } else if (recentEvent.type === 'feeding_completed') {
      const sourceKey = `dashboard.source_${recentEvent.source.toLowerCase()}`;
      const sourceName = t(sourceKey);
      setToast({
        message: t('nav.toast_feeding_completed', {
          source: sourceName,
          duration: recentEvent.openDurationMs / 1000,
        }),
        type: 'success',
      });
    } else if (recentEvent.type === 'device_error') {
      const friendlyMsg = getFriendlyErrorMessage({ message: recentEvent.errorMessage }, 'errors.unknown', t);
      setToast({
        message: t('nav.toast_error', { message: friendlyMsg }),
        type: 'error',
      });
    } else if (recentEvent.type === 'config_applied') {
      setToast({
        message: t('nav.toast_config_applied', { version: recentEvent.version }),
        type: 'success',
      });
    }

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [recentEvent, t]);

  if (!isAuthenticated) return null;

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Offline Banner */}
      {networkOffline && (
        <div className={styles.offlineBanner}>
          <WifiOff size={16} />
          <span>{t('nav.offline_banner')}</span>
        </div>
      )}

      {/* SSE Connection State Banner */}
      {!networkOffline && !sseConnected && (
        <div className={styles.syncBanner}>
          <Loader size={14} className={styles.spinning} />
          <span>{t('nav.syncing_banner')}</span>
        </div>
      )}

      {/* Background Syncing Indicator */}
      {!networkOffline && sseConnected && (devicesLoading || dashboardLoading) && (
        <div className={styles.syncIndicator}>
          <RefreshCw size={14} className={styles.spinning} />
          <span>{t('device_detail.syncing')}</span>
        </div>
      )}

      {/* Desktop Header */}
      <header className={`${styles.header} glass`}>
        <div className={styles.headerTop}>
          <Link href="/dashboard" className={styles.logo}>
            🐾 Paw<span>Feed</span>
          </Link>

          <div className={styles.rightSection}>
            <button onClick={toggleLanguage} className={styles.langToggle} title="Switch language">
              <Globe size={14} style={{ marginRight: '6px' }} />
              {language === 'en' ? 'EN' : 'VI'}
            </button>

            <div className={styles.userSection}>
              <span className={styles.userName}>{user?.fullName || user?.email}</span>
              <button onClick={logout} className={`${styles.logoutBtn} glass`}>
                <LogOut size={16} />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>

        <nav className={styles.desktopNav}>
          <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`}>
            <Home size={18} />
            {t('nav.dashboard')}
          </Link>
          <Link href="/devices" className={`${styles.navItem} ${isActive('/devices') ? styles.active : ''}`}>
            <Smartphone size={18} />
            {t('devices.title')}
          </Link>
          <Link href="/activity" className={`${styles.navItem} ${isActive('/activity') ? styles.active : ''}`}>
            <History size={18} />
            {t('activity.title')}
          </Link>
          <Link href="/account" className={`${styles.navItem} ${isActive('/account') ? styles.active : ''}`}>
            <User size={18} />
            {t('nav.account')}
          </Link>
        </nav>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className={`${styles.mobileBottomNav} glass`}>
        <Link href="/dashboard" className={`${styles.mobileNavItem} ${isActive('/dashboard') ? styles.mobileActive : ''}`}>
          <Home size={22} />
          <span>{t('nav.dashboard')}</span>
        </Link>
        <Link href="/devices" className={`${styles.mobileNavItem} ${isActive('/devices') ? styles.mobileActive : ''}`}>
          <Smartphone size={22} />
          <span>{t('devices.title')}</span>
        </Link>
        <Link href="/activity" className={`${styles.mobileNavItem} ${isActive('/activity') ? styles.mobileActive : ''}`}>
          <History size={22} />
          <span>{t('activity.title')}</span>
        </Link>
        <Link href="/account" className={`${styles.mobileNavItem} ${isActive('/account') ? styles.mobileActive : ''}`}>
          <User size={22} />
          <span>{t('nav.account')}</span>
        </Link>
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
