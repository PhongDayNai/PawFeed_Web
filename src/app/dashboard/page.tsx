'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
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
  const { recentEvent } = useApp();
  const { language, t } = useLanguage();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const dashboard = await deviceApi.getDashboard();
      setData(dashboard);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('nav.toast_error', { message: err.message || '' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refresh dashboard automatically when relevant SSE events are received!
  useEffect(() => {
    if (recentEvent) {
      if (['device_status_updated', 'feeding_completed', 'config_applied'].includes(recentEvent.type)) {
        fetchDashboardData(true);
      }
    }
  }, [recentEvent, fetchDashboardData]);

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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('dashboard.loading_dashboard')}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '32px 24px', animation: 'fadeInUp 0.4s ease' }}>
      {/* Header Row */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.title}>{t('dashboard.title')}</h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <PawButton
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className={styles.actionBtn}
          >
            <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
            {t('dashboard.refresh')}
          </PawButton>
          <PawButton
            variant="secondary"
            onClick={() => router.push('/devices/link')}
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
          <div className={styles.summaryGrid}>
            <div className={`${styles.summaryCard} ${styles.blueGradient} glass`}>
              <div className={styles.cardInfo}>
                <Smartphone size={24} />
                <span>{t('dashboard.total_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.deviceCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.greenGradient} glass`}>
              <div className={styles.cardInfo}>
                <Wifi size={24} />
                <span>{t('dashboard.online_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.onlineCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.grayGradient} glass`}>
              <div className={styles.cardInfo}>
                <WifiOff size={24} />
                <span>{t('dashboard.offline_feeders')}</span>
              </div>
              <div className={styles.cardValue}>{data.offlineCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.orangeGradient} glass`}>
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
                  <PawButton variant="secondary" onClick={() => router.push('/devices/link')} style={{ marginTop: '16px' }}>
                    {t('dashboard.link_now')}
                  </PawButton>
                </PawCard>
              ) : (
                <div className={styles.list}>
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
                <div className={styles.list}>
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
                        <span className={styles.historyId}>ID: #{history.id}</span>
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
