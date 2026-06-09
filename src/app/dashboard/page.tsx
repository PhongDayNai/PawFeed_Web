'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { deviceApi } from '../../lib/api';
import { DashboardData, Device, FeedingHistory } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import {
  Smartphone,
  Wifi,
  WifiOff,
  Cookie,
  RefreshCw,
  Plus,
  ArrowRight,
  ChevronRight,
  History,
  Activity,
  AlertCircle
} from 'lucide-react';
import styles from './page.module.css';

export default function DashboardPage() {
  const { recentEvent, networkOffline } = useApp();
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
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      return date.toLocaleString('vi-VN', {
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
    if (!source) return 'Unknown';
    switch (source.toUpperCase()) {
      case 'REMOTE': return 'App / Web (Remote)';
      case 'SCHEDULE': return 'Feeding Schedule';
      case 'MANUAL': return 'Feeder Button';
      case 'TEST': return 'Test Mode';
      default: return source;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '32px 24px', animation: 'fadeInUp 0.4s ease' }}>
      {/* Header Row */}
      <div className={styles.dashboardHeader}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Overview of your smart feeding network</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <PawButton
            variant="outline"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className={styles.actionBtn}
          >
            <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
            Refresh
          </PawButton>
          <PawButton
            variant="secondary"
            onClick={() => router.push('/devices/link')}
            className={styles.actionBtn}
          >
            <Plus size={16} />
            Link Feeder
          </PawButton>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <AlertCircle size={20} />
          <div>
            <h4>Error Loading Dashboard</h4>
            <p>{error}</p>
          </div>
          <PawButton variant="outline" onClick={() => fetchDashboardData()} style={{ marginLeft: 'auto' }}>
            Retry
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
                <span>Total Feeders</span>
              </div>
              <div className={styles.cardValue}>{data.deviceCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.greenGradient} glass`}>
              <div className={styles.cardInfo}>
                <Wifi size={24} />
                <span>Online Feeders</span>
              </div>
              <div className={styles.cardValue}>{data.onlineCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.grayGradient} glass`}>
              <div className={styles.cardInfo}>
                <WifiOff size={24} />
                <span>Offline Feeders</span>
              </div>
              <div className={styles.cardValue}>{data.offlineCount}</div>
            </div>

            <div className={`${styles.summaryCard} ${styles.orangeGradient} glass`}>
              <div className={styles.cardInfo}>
                <Cookie size={24} />
                <span>Total Feedings</span>
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
                Recent Feeders
              </h2>

              {data.recentDevices.length === 0 ? (
                <PawCard hoverable={false} className={styles.emptyState}>
                  <Smartphone size={48} className={styles.emptyIcon} />
                  <h3>No Feeders Linked</h3>
                  <p>Link your first smart pet feeder to start managing schedules and feeding remotely.</p>
                  <PawButton variant="secondary" onClick={() => router.push('/devices/link')} style={{ marginTop: '16px' }}>
                    Link Now
                  </PawButton>
                </PawCard>
              ) : (
                <div className={styles.list}>
                  {data.recentDevices.map((device) => (
                    <PawCard key={device.deviceId} className={styles.deviceCard}>
                      <div className={styles.deviceInfo}>
                        <div className={styles.deviceMeta}>
                          <h3 className={styles.deviceName}>{device.displayName || 'Unnamed Feeder'}</h3>
                          <span className={styles.deviceId}>{device.deviceId}</span>
                        </div>
                        <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`}>
                          {device.online ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className={styles.deviceDetails}>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Code:</span>
                          <span className={styles.detailVal}>{device.machineCode}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Last seen:</span>
                          <span className={styles.detailVal}>{formatTime(device.lastSeenAt)}</span>
                        </div>
                      </div>

                      <div className={styles.deviceActions}>
                        <PawButton
                          variant="outline"
                          onClick={() => router.push(`/devices/${device.deviceId}`)}
                          className={styles.deviceBtn}
                        >
                          Details
                          <ChevronRight size={16} />
                        </PawButton>
                        <PawButton
                          variant="secondary"
                          onClick={() => router.push(`/devices/${device.deviceId}/feed`)}
                          disabled={!device.online}
                          className={styles.deviceBtn}
                        >
                          Feed Now
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
                Recent Feeding History
              </h2>

              {data.recentFeedingHistories.length === 0 ? (
                <PawCard hoverable={false} className={styles.emptyState}>
                  <Cookie size={48} className={styles.emptyIcon} />
                  <h3>No Feeding History</h3>
                  <p>Trigger a quick feed or configure a schedule to start tracking pet meals.</p>
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
                          {history.status}
                        </span>
                      </div>
                      <div className={styles.historyBody}>
                        <span>Dispensing time: <strong>{history.openDurationMs / 1000}s</strong></span>
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
