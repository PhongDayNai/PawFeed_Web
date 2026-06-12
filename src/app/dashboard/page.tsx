'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
import { getFriendlyErrorMessage } from '../../lib/error';
import { DashboardData } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import {
  Smartphone,
  Wifi,
  WifiOff,
  Cookie,
  RefreshCw,
  Plus,
  ChevronRight,
  History,
  Activity,
  AlertCircle
} from 'lucide-react';
import styles from './page.module.css';

export default function DashboardPage() {
  const { dashboardData, dashboardLoading, fetchDashboardData } = useApp();
  const { language, t } = useLanguage();
  const router = useRouter();

  const data = dashboardData;

  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const feedersListRef = React.useRef<HTMLDivElement>(null);
  const historyListRef = React.useRef<HTMLDivElement>(null);
  const summaryGridRef = React.useRef<HTMLDivElement>(null);
  const scrollOffsetRef = React.useRef(0);
  const touchStartYRef = React.useRef(0);
  const lastProgressRef = React.useRef(0);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      
      if (window.innerWidth > 992) {
        if (lastProgressRef.current !== 0) {
          lastProgressRef.current = 0;
          if (dashboardRef.current) {
            dashboardRef.current.style.setProperty('--scroll-progress', '0');
          }
        }
        if (summaryGridRef.current) {
          summaryGridRef.current.classList.remove(styles.scrolled);
        }
        return;
      }
      
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const scrolled = scrollY > 40;
      const progress = scrolled ? 1 : 0;
      
      if (lastProgressRef.current !== progress) {
        lastProgressRef.current = progress;
        if (dashboardRef.current) {
          dashboardRef.current.style.setProperty('--scroll-progress', String(progress));
        }
        if (summaryGridRef.current) {
          if (scrolled) {
            summaryGridRef.current.classList.add(styles.scrolled);
          } else {
            summaryGridRef.current.classList.remove(styles.scrolled);
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchDashboardData(true);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err, 'dashboard.error_loading', t));
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardData, t]);

  useEffect(() => {
    if (!dashboardData && !dashboardLoading) {
      fetchDashboardData();
    }
  }, [dashboardData, dashboardLoading, fetchDashboardData]);

  /*
   * Compute the per-card translate offsets needed to morph 2x2 -> 1x4.
   * The card's WIDTH/HEIGHT snap to 1x4 values via CSS (no transition - one
   * layout pass). Only the POSITION morphs smoothly, via `transform: translate`,
   * which is GPU-composited. The translate amounts are expressed as a
   * percentage of the card's EXPANDED size (50% wide × 110px tall), so the
   * CSS percentage resolves to the correct pixel offset at any viewport width.
   */
  useEffect(() => {
    const computeCardTransforms = () => {
      const grid = summaryGridRef.current;
      if (!grid) return;

      const w = grid.clientWidth;
      if (w === 0) return;

      // Constants kept in sync with page.module.css (mobile @media).
      const GAP = 12;
      const EXPANDED_H = 110;
      const COLLAPSED_H = 50;
      const COLLAPSED_GRID_H = 80;
      // Vertical position is handled directly by CSS top: 15px on .scrolled .summaryCard.
      // JS only needs to compute horizontal --tx offsets.
      const COLLAPSED_TOP = (COLLAPSED_GRID_H - COLLAPSED_H) / 2; // = 15px

      // 2x2 and 1x4 cell widths derived from the current grid width.
      const cellW2x2 = (w - GAP) / 2;
      const cellW1x4 = (w - GAP * 3) / 4;

      // 2x2 anchor positions in grid pixels (top-left of each cell).
      // Use COLLAPSED_TOP for all top values so --ty computes to 0
      // (vertical offset is handled by CSS, not transform).
      const pos2x2 = [
        { left: 0, top: COLLAPSED_TOP },
        { left: cellW2x2 + GAP, top: COLLAPSED_TOP },
        { left: 0, top: COLLAPSED_TOP },
        { left: cellW2x2 + GAP, top: COLLAPSED_TOP },
      ];

      // 1x4 anchor positions in grid pixels.
      const pos1x4 = [
        { left: 0, top: COLLAPSED_TOP },
        { left: cellW1x4 + GAP, top: COLLAPSED_TOP },
        { left: (cellW1x4 + GAP) * 2, top: COLLAPSED_TOP },
        { left: (cellW1x4 + GAP) * 3, top: COLLAPSED_TOP },
      ];

      const cards = grid.querySelectorAll<HTMLElement>(`.${styles.summaryCard}`);
      cards.forEach((card, i) => {
        if (i >= 4) return;
        // Only apply horizontal translation via --tx.
        // Vertical (--ty) is always 0 since CSS top handles it.
        const tx = pos1x4[i].left - pos2x2[i].left;
        card.style.setProperty('--tx', `${tx}px`);
        card.style.setProperty('--ty', '0px');
      });
    };

    computeCardTransforms();
    window.addEventListener('resize', computeCardTransforms);
    return () => window.removeEventListener('resize', computeCardTransforms);
  }, [dashboardData]);

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    const handleWheel = (e: WheelEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth <= 992) return;
      const delta = e.deltaY;
      const currentOffset = scrollOffsetRef.current;
      
      const feedersList = feedersListRef.current;
      const historyList = historyListRef.current;

      const targetList = e.composedPath().find(
        el => el === feedersList || el === historyList
      ) as HTMLDivElement | undefined;

      const scrollTop = targetList ? targetList.scrollTop : 0;

      if (delta > 0) {
        if (currentOffset < 100) {
          e.preventDefault();
          const nextOffset = Math.min(100, currentOffset + delta * 0.4);
          scrollOffsetRef.current = nextOffset;
          dashboard.style.setProperty('--scroll-progress', String(nextOffset / 100));
        }
      } else if (delta < 0) {
        if (scrollTop <= 2 && currentOffset > 0) {
          e.preventDefault();
          const nextOffset = Math.max(0, currentOffset + delta * 0.4);
          scrollOffsetRef.current = nextOffset;
          dashboard.style.setProperty('--scroll-progress', String(nextOffset / 100));
          if (targetList) targetList.scrollTop = 0;
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth <= 992) return;
      const touchY = e.touches[0].clientY;
      const delta = touchStartYRef.current - touchY;
      touchStartYRef.current = touchY;

      const currentOffset = scrollOffsetRef.current;
      const feedersList = feedersListRef.current;
      const historyList = historyListRef.current;

      const targetList = e.composedPath().find(
        el => el === feedersList || el === historyList
      ) as HTMLDivElement | undefined;

      const scrollTop = targetList ? targetList.scrollTop : 0;

      if (delta > 0) {
        if (currentOffset < 100) {
          if (e.cancelable) e.preventDefault();
          const nextOffset = Math.min(100, currentOffset + delta * 0.8);
          scrollOffsetRef.current = nextOffset;
          dashboard.style.setProperty('--scroll-progress', String(nextOffset / 100));
        }
      } else if (delta < 0) {
        if (scrollTop <= 2 && currentOffset > 0) {
          if (e.cancelable) e.preventDefault();
          const nextOffset = Math.max(0, currentOffset + delta * 0.8);
          scrollOffsetRef.current = nextOffset;
          dashboard.style.setProperty('--scroll-progress', String(nextOffset / 100));
          if (targetList) targetList.scrollTop = 0;
        }
      }
    };

    dashboard.addEventListener('wheel', handleWheel, { passive: false });
    dashboard.addEventListener('touchstart', handleTouchStart, { passive: true });
    dashboard.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      dashboard.removeEventListener('wheel', handleWheel);
      dashboard.removeEventListener('touchstart', handleTouchStart);
      dashboard.removeEventListener('touchmove', handleTouchMove);
    };
  }, [dashboardData]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString(language === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getSourceLabel = (source: string) => {
    if (!source) return t('common.unknown');
    switch (source.toUpperCase()) {
      case 'REMOTE': return t('dashboard.source_remote');
      case 'SCHEDULE': return t('dashboard.source_schedule');
      case 'MANUAL': return t('dashboard.source_manual');
      case 'TEST': return t('dashboard.source_test');
      default: return source;
    }
  };

  if (dashboardLoading && !data) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('dashboard.loading_dashboard')}</p>
      </div>
    );
  }

  return (
    <div className={`container ${styles.dashboardPage}`} ref={dashboardRef} style={{ padding: '32px 24px', animation: 'fadeInUp 0.4s ease' }}>
      {/* Header Row */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.title}>{t('dashboard.title')}</h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <PawButton
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className={styles.actionBtn}
          >
            <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
            {t('dashboard.refresh')}
          </PawButton>
          <PawButton
            variant="secondary"
            onClick={() => router.push('/devices')}
            className={styles.actionBtn}
          >
            <Plus size={16} />
            {t('dashboard.link_feeder')}
          </PawButton>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <AlertCircle size={20} />
          <div>
            <h4>{t('dashboard.error_loading')}</h4>
            <p>{error}</p>
          </div>
          <PawButton variant="outline" onClick={() => fetchDashboardData()} style={{ marginLeft: 'auto' }}>
            {t('common.retry')}
          </PawButton>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards Grid */}
          <div className={styles.summaryGrid} ref={summaryGridRef}>
            <div
              className={`${styles.summaryCard} ${styles.blueGradient}`}
              onClick={() => router.push('/devices')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push('/devices');
                }
              }}
            >
              <div className={styles.cardInfo}>
                <Smartphone size={24} />
                <span>{t('dashboard.total_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.deviceCount}</div>
            </div>

            <div
              className={`${styles.summaryCard} ${styles.greenGradient}`}
              onClick={() => router.push('/devices?status=online')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push('/devices?status=online');
                }
              }}
            >
              <div className={styles.cardInfo}>
                <Wifi size={24} />
                <span>{t('dashboard.online_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.onlineCount}</div>
            </div>

            <div
              className={`${styles.summaryCard} ${styles.grayGradient}`}
              onClick={() => router.push('/devices?status=offline')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push('/devices?status=offline');
                }
              }}
            >
              <div className={styles.cardInfo}>
                <WifiOff size={24} />
                <span>{t('dashboard.offline_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.offlineCount}</div>
            </div>

            <div
              className={`${styles.summaryCard} ${styles.orangeGradient}`}
              onClick={() => router.push('/activity')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push('/activity');
                }
              }}
            >
              <div className={styles.cardInfo}>
                <Cookie size={24} />
                <span>{t('dashboard.total_feedings')}</span>
              </div>
              <div className={styles.cardValue}>{data.feedingCount}</div>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className={styles.contentGrid}>
            {/* Feeders List Section */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <Activity size={18} />
                {t('dashboard.recent_feeders')}
              </h2>

              {data.recentDevices.length === 0 ? (
                <PawCard hoverable={false} className={styles.emptyState}>
                  <Smartphone size={48} className={styles.emptyIcon} />
                  <h3>{t('dashboard.no_feeders_title')}</h3>
                  <p>{t('dashboard.no_feeders_desc')}</p>
                  <PawButton variant="secondary" onClick={() => router.push('/devices')} style={{ marginTop: '16px' }}>
                    {t('dashboard.link_now')}
                  </PawButton>
                </PawCard>
              ) : (
                <div className={styles.list} ref={feedersListRef}>
                  {data.recentDevices.map((device) => (
                    <PawCard key={device.deviceId} className={styles.deviceCard}>
                      <div className={styles.deviceInfo}>
                        <div className={styles.deviceMeta}>
                          <h3 className={styles.deviceName}>{device.displayName || t('common.unknown')}</h3>
                          <span className={styles.deviceId}>{device.deviceId}</span>
                        </div>
                        <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`}>
                          {device.online ? t('common.online') : t('common.offline')}
                        </span>
                      </div>

                      <div className={styles.deviceDetails}>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>{t('common.code')}:</span>
                          <span className={styles.detailVal}>{device.machineCode}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>{t('common.last_seen')}:</span>
                          <span className={styles.detailVal}>{formatTime(device.lastSeenAt)}</span>
                        </div>
                      </div>

                      <div className={styles.deviceActions}>
                        <PawButton
                          variant="outline"
                          onClick={() => router.push(`/devices/${device.deviceId}`)}
                          className={styles.deviceBtn}
                        >
                          {t('common.details')}
                          <ChevronRight size={16} />
                        </PawButton>
                        <PawButton
                          variant="secondary"
                          onClick={() => router.push(`/devices/${device.deviceId}/feed`)}
                          disabled={!device.online}
                          className={styles.deviceBtn}
                        >
                          {t('common.feed_now')}
                          <Cookie size={16} />
                        </PawButton>
                      </div>
                    </PawCard>
                  ))}
                </div>
              )}
            </div>

            {/* Feeding History Section */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <History size={18} />
                {t('dashboard.recent_feeding_history')}
              </h2>

              {data.recentFeedingHistories.length === 0 ? (
                <PawCard hoverable={false} className={styles.emptyState}>
                  <Cookie size={48} className={styles.emptyIcon} />
                  <h3>{t('dashboard.no_history_title')}</h3>
                  <p>{t('dashboard.no_history_desc')}</p>
                </PawCard>
              ) : (
                <div className={styles.list} ref={historyListRef}>
                  {data.recentFeedingHistories.map((history) => (
                    <PawCard key={history.id} className={styles.historyCard}>
                      <div className={styles.historyHeader}>
                        <div className={styles.historyMeta}>
                          <span className={styles.historySource}>{getSourceLabel(history.source)}</span>
                          <span className={styles.historyTime}>{formatTime(history.startedAt)}</span>
                        </div>
                        <span className={`badge ${history.status === 'completed' ? 'badge-online' : 'badge-warning'}`}>
                          {history.status === 'completed' ? t('common.done') : history.status}
                        </span>
                      </div>
                      <div className={styles.historyBody}>
                        <span>{t('dashboard.dispensing_time')} <strong>{history.openDurationMs / 1000}s</strong></span>
                      </div>
                    </PawCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
