'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
import { Device, FeedingHistory } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { History, Activity, AlertTriangle, RefreshCw, Clock, Settings, CheckCircle, Info } from 'lucide-react';
import styles from './page.module.css';

export default function ActivityPage() {
  const { language, t } = useLanguage();

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<number>(0); // 0: History, 1: Events
  
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [history, setHistory] = useState<FeedingHistory[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const fetchDevices = useCallback(async () => {
    setLoadingDevices(true);
    setError(null);
    try {
      const res = await deviceApi.getDevices();
      setDevices(res.devices);
      if (res.devices.length > 0) {
        setSelectedDeviceId(res.devices[0].deviceId);
      }
    } catch (err: any) {
      setError(err.message || t('activity.no_devices'));
    } finally {
      setLoadingDevices(false);
    }
  }, [t]);

  const fetchLogs = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    setLoadingLogs(true);
    setError(null);
    try {
      const histRes = await deviceApi.getFeedingHistory(deviceId);
      setHistory(histRes.feedingHistory || []);

      try {
        const evRes = await deviceApi.getDeviceEvents(deviceId, 1, 50);
        setEvents(evRes.events || []);
      } catch (e) {
        console.warn('Failed to fetch events', e);
        setEvents([]);
      }
    } catch (err: any) {
      setError(err.message || t('nav.toast_error', { message: err.message || '' }));
    } finally {
      setLoadingLogs(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (selectedDeviceId) {
      fetchLogs(selectedDeviceId);
    }
  }, [selectedDeviceId, fetchLogs]);

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

  if (loadingDevices) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '720px', minHeight: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t('activity.title')}</h1>
          <p className={styles.subtitle}>{t('activity.subtitle')}</p>
        </div>
        {selectedDeviceId && (
          <PawButton variant="outline" onClick={() => fetchLogs(selectedDeviceId)} disabled={loadingLogs}>
            <RefreshCw className={loadingLogs ? 'spinning' : ''} size={16} />
          </PawButton>
        )}
      </div>

      {devices.length === 0 ? (
        <div className={styles.emptyContainer}>
          <PawCard hoverable={false} className={styles.emptyCard}>
            <History size={64} className={styles.emptyIcon} />
            <h3>{t('activity.no_devices')}</h3>
            <p>{t('activity.no_devices')}</p>
          </PawCard>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Device Selector dropdown */}
          <div className={styles.selectorCard}>
            <label className={styles.selectorLabel}>{t('activity.select_device')}</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className={styles.deviceSelect}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.displayName || t('common.unknown')} ({d.deviceId.substring(0, 6)})
                </option>
              ))}
            </select>
          </div>

          {/* Tabs header */}
          <div className={styles.tabsRow}>
            <button
              onClick={() => setActiveTab(0)}
              className={`${styles.tabBtn} ${activeTab === 0 ? styles.activeTab : ''}`}
            >
              <History size={16} />
              {t('activity.tab_history')}
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`${styles.tabBtn} ${activeTab === 1 ? styles.activeTab : ''}`}
            >
              <Activity size={16} />
              {t('activity.tab_events')}
            </button>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Logs Content */}
          {loadingLogs ? (
            <div className={styles.loadingLogs}>
              <RefreshCw className="spinning" size={30} />
              <p>{t('common.loading')}</p>
            </div>
          ) : (
            <div className={styles.logsList}>
              {activeTab === 0 ? (
                /* Feeding History Tab */
                history.length === 0 ? (
                  <p className={styles.noLogsText}>{t('activity.no_logs')}</p>
                ) : (
                  history.map((item) => (
                    <PawCard key={item.id} hoverable={false} className={styles.logCard}>
                      <div className={styles.logHeader}>
                        <span className={styles.logSource}>{getSourceLabel(item.source)}</span>
                        <span className={styles.logTime}>{formatTime(item.startedAt)}</span>
                      </div>
                      <div className={styles.logBody}>
                        <span>{t('dashboard.dispensing_time')} <strong>{item.openDurationMs / 1000}s</strong></span>
                        <span className={`badge ${item.status === 'completed' ? 'badge-online' : 'badge-warning'}`}>
                          {item.status === 'completed' ? t('common.done') : item.status}
                        </span>
                      </div>
                    </PawCard>
                  ))
                )
              ) : (
                /* Device Events Tab */
                events.length === 0 ? (
                  <p className={styles.noLogsText}>{t('activity.no_logs')}</p>
                ) : (
                  events.map((event) => (
                    <PawCard key={event.id} hoverable={false} className={styles.logCard}>
                      <div className={styles.eventRow}>
                        <div className={styles.eventIconWrapper}>
                          {event.eventType === 'device_error' && <AlertTriangle size={18} color="var(--error)" />}
                          {event.eventType === 'config_applied' && <Settings size={18} color="var(--primary)" />}
                          {event.eventType === 'feeding_completed' && <CheckCircle size={18} color="var(--success)" />}
                          {event.eventType !== 'device_error' && event.eventType !== 'config_applied' && event.eventType !== 'feeding_completed' && <Info size={18} color="var(--text-muted)" />}
                        </div>
                        <div className={styles.eventContent}>
                          <p className={styles.eventMessage}>{event.message}</p>
                          <span className={styles.eventTime}>{formatTime(event.createdAt)}</span>
                        </div>
                      </div>
                    </PawCard>
                  ))
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
