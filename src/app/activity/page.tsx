'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
import { getFriendlyErrorMessage } from '../../lib/error';
import { Device, FeedingHistory } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { PawSelect } from '../../components/PawSelect';
import { History, Activity, AlertTriangle, RefreshCw, Clock, Settings, CheckCircle, Info } from 'lucide-react';
import styles from './page.module.css';

export default function ActivityPage() {
  const { language, t } = useLanguage();
  const { 
    devices: sharedDevices, 
    devicesLoading, 
    fetchDevices: fetchSharedDevices,
    feedingHistories,
    deviceEvents,
    logsLoading,
    fetchLogsForDevice
  } = useApp();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0); // 0: History, 1: Events
  const [error, setError] = useState<string | null>(null);

  const devices = sharedDevices || [];

  // Fetch devices from context if not loaded
  useEffect(() => {
    if (!sharedDevices && !devicesLoading) {
      fetchSharedDevices();
    }
  }, [sharedDevices, devicesLoading, fetchSharedDevices]);

  // Set default selected device ID when devices list is loaded
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  // Fetch logs when device is selected and not loaded yet
  useEffect(() => {
    if (selectedDeviceId) {
      const hasCachedData = feedingHistories[selectedDeviceId] && deviceEvents[selectedDeviceId];
      if (!hasCachedData && !logsLoading) {
        fetchLogsForDevice(selectedDeviceId);
      }
    }
  }, [selectedDeviceId, feedingHistories, deviceEvents, logsLoading, fetchLogsForDevice]);

  const history = selectedDeviceId ? (feedingHistories[selectedDeviceId] || []) : [];
  const events = selectedDeviceId ? (deviceEvents[selectedDeviceId] || []) : [];

  const handleRefreshLogs = useCallback(async () => {
    if (selectedDeviceId) {
      setError(null);
      try {
        await fetchLogsForDevice(selectedDeviceId, true);
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err, 'activity.load_failed_err', t));
      }
    }
  }, [selectedDeviceId, fetchLogsForDevice, t]);

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

  const getStatusLabel = (status: string) => {
    if (!status) return t('common.unknown');
    const key = `common.status_${status.toLowerCase()}`;
    const val = t(key);
    return val === key ? status : val;
  };

  const getEventMessage = (event: any) => {
    const payload = event.payload || {};
    switch (event.eventType) {
      case 'feeding_completed': {
        const duration = payload.openDurationMs || 0;
        return t('activity.event_feeding_completed', { duration });
      }
      case 'device_error': {
        const errorVal = payload.error || 'System error';
        return t('activity.event_device_error', { error: errorVal });
      }
      case 'config_applied': {
        const version = payload.version || 0;
        return t('activity.event_config_applied', { version });
      }
      case 'device_status_updated':
        return t('activity.event_device_status_updated');
      default:
        if (event.message) return event.message;
        return t('activity.event_other');
    }
  };

  if (devicesLoading && !sharedDevices) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const hasData = history.length > 0 || events.length > 0;

  return (
    <div className={`${styles.pageContainer} container page-scroll-lock animate-fade-in`}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t('activity.title')}</h1>
          <p className={styles.subtitle}>{t('activity.subtitle')}</p>
        </div>
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
        <div className={styles.contentWrapper}>
          {/* Device Selector dropdown */}
          <div className={styles.selectorCard}>
            <label className={styles.selectorLabel}>{t('activity.select_device')}</label>
            <div className={styles.selectorRow}>
              <PawSelect
                value={selectedDeviceId}
                onChange={setSelectedDeviceId}
                options={devices.map((d) => ({
                  value: d.deviceId,
                  label: `${d.displayName || t('common.unknown')} (${d.deviceId.substring(0, 6)})`,
                }))}
                placeholder={t('common.select')}
                className={styles.deviceSelect}
              />
              {selectedDeviceId && (
                <PawButton
                  variant="outline"
                  onClick={handleRefreshLogs}
                  disabled={logsLoading}
                  className={styles.refreshBtn}
                  title={t('dashboard.refresh')}
                >
                  <RefreshCw className={logsLoading ? 'spinning' : ''} size={16} />
                </PawButton>
              )}
            </div>
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
          {logsLoading && !hasData ? (
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
                          {getStatusLabel(item.status)}
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
                  events.map((event) => {
                    const eventTypeClass = event.eventType === 'device_error' || 
                                           event.eventType === 'config_applied' || 
                                           event.eventType === 'feeding_completed' 
                                           ? styles[event.eventType] 
                                           : styles.eventDefault;
                    return (
                      <PawCard key={event.id} hoverable={false} className={styles.logCard}>
                        <div className={styles.eventRow}>
                          <div className={`${styles.eventIconWrapper} ${eventTypeClass}`}>
                            {event.eventType === 'device_error' && <AlertTriangle size={20} />}
                            {event.eventType === 'config_applied' && <Settings size={20} />}
                            {event.eventType === 'feeding_completed' && <CheckCircle size={20} />}
                            {event.eventType !== 'device_error' && event.eventType !== 'config_applied' && event.eventType !== 'feeding_completed' && <Info size={20} />}
                          </div>
                          <div className={styles.eventContent}>
                            <div className={styles.eventHeader}>
                              <span className={`${styles.eventBadge} ${eventTypeClass}`}>
                                {event.eventType === 'device_error' ? t('activity.event_type_error') : 
                                 event.eventType === 'config_applied' ? t('activity.event_type_config') : 
                                 event.eventType === 'feeding_completed' ? t('activity.event_type_feed') : t('activity.event_type_info')}
                              </span>
                              <span className={styles.eventTime}>{formatTime(event.createdAt)}</span>
                            </div>
                            <p className={styles.eventMessage}>{getEventMessage(event)}</p>
                          </div>
                        </div>
                      </PawCard>
                    );
                  })
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
