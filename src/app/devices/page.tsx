'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
import { getFriendlyErrorMessage } from '../../lib/error';
import { Device } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { Smartphone, Plus, RefreshCw, Cpu, KeyRound, AlertTriangle, ChevronRight, Cookie, Search, Wifi, WifiOff } from 'lucide-react';
import styles from './page.module.css';

export default function DevicesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { devices: sharedDevices, devicesLoading, fetchDevices: fetchSharedDevices } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states for linking device
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [machineCode, setMachineCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const devices = sharedDevices || [];

  // Sync status filter from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get('status');
      if (statusParam === 'online' || statusParam === 'offline') {
        setFilterStatus(statusParam);
      }
    }
  }, []);

  const handleFilterChange = (status: 'all' | 'online' | 'offline') => {
    setFilterStatus(status);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (status === 'all') {
        params.delete('status');
      } else {
        params.set('status', status);
      }
      const newSearch = params.toString();
      router.replace(`/devices${newSearch ? `?${newSearch}` : ''}`);
    }
  };

  // Filter devices list
  const filteredDevices = devices.filter((device) => {
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'online' && device.online) ||
      (filterStatus === 'offline' && !device.online);

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (device.displayName || '').toLowerCase().includes(query) ||
      device.deviceId.toLowerCase().includes(query) ||
      device.machineCode.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  // Count devices for filters
  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.online).length;
  const offlineCount = devices.filter((d) => !d.online).length;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchSharedDevices(true);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'devices.load_failed_err', t));
    } finally {
      setRefreshing(false);
    }
  }, [fetchSharedDevices, t]);

  useEffect(() => {
    if (!sharedDevices && !devicesLoading) {
      fetchSharedDevices();
    }
  }, [sharedDevices, devicesLoading, fetchSharedDevices]);

  const handleLinkDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineCode || !pairingCode) return;

    setLinking(true);
    setLinkError(null);
    try {
      await deviceApi.linkDevice(machineCode, pairingCode);
      setShowLinkModal(false);
      setMachineCode('');
      setPairingCode('');
      fetchSharedDevices(true); // reload list
    } catch (err: any) {
      setLinkError(getFriendlyErrorMessage(err, 'link_device.link_failed_err', t));
    } finally {
      setLinking(false);
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

  return (
    <>
      <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '800px', minHeight: 'calc(100vh - 120px)' }}>
        {/* Title Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>{t('devices.title')}</h1>
            <p className={styles.subtitle}>{t('devices.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <PawButton variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
            </PawButton>
            {devices.length > 0 && (
              <PawButton variant="secondary" onClick={() => setShowLinkModal(true)}>
                <Plus size={16} />
                {t('devices.add_feeder_btn')}
              </PawButton>
            )}
          </div>
        </div>

        {error && (
          <div className={styles.errorAlert} style={{ marginBottom: '24px' }}>
            <AlertTriangle size={20} />
            <span>{error}</span>
            <PawButton variant="outline" onClick={() => fetchSharedDevices()} style={{ marginLeft: 'auto' }}>
              {t('common.retry')}
            </PawButton>
          </div>
        )}

        {devices.length === 0 ? (
          <div className={styles.emptyContainer}>
            <PawCard hoverable={false} className={styles.emptyCard}>
              <Smartphone size={64} className={styles.emptyIcon} />
              <h3>{t('devices.no_devices')}</h3>
              <p>{t('dashboard.no_feeders_desc')}</p>
              <PawButton
                variant="secondary"
                onClick={() => setShowLinkModal(true)}
                style={{ marginTop: '24px' }}
              >
                <Plus size={16} />
                {t('devices.add_feeder_btn')}
              </PawButton>
            </PawCard>
          </div>
        ) : (
          <>
            {/* Search and Filter Controls */}
            <div className={styles.controlsRow}>
              <div className={styles.searchBox}>
                <Search className={styles.searchIcon} size={18} />
                <input
                  type="text"
                  placeholder={t('devices.search_placeholder')}
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className={styles.filterTabs}>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filterStatus === 'all' ? styles.activeFilter : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  <Smartphone size={14} />
                  <span>{t('devices.filter_all')}</span>
                  <span className={styles.filterCount}>{totalCount}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filterStatus === 'online' ? styles.activeFilter : ''}`}
                  onClick={() => handleFilterChange('online')}
                >
                  <Wifi size={14} style={{ color: filterStatus === 'online' ? '#4caf50' : 'inherit' }} />
                  <span>{t('common.online')}</span>
                  <span className={styles.filterCount}>{onlineCount}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.filterBtn} ${filterStatus === 'offline' ? styles.activeFilter : ''}`}
                  onClick={() => handleFilterChange('offline')}
                >
                  <WifiOff size={14} style={{ color: filterStatus === 'offline' ? '#f44336' : 'inherit' }} />
                  <span>{t('common.offline')}</span>
                  <span className={styles.filterCount}>{offlineCount}</span>
                </button>
              </div>
            </div>

            {filteredDevices.length === 0 ? (
              <div className={styles.emptyContainer} key="empty_results">
                <PawCard hoverable={false} className={styles.emptyCard}>
                  <AlertTriangle size={64} className={styles.emptyIcon} />
                  <h3>{t('devices.no_results_title')}</h3>
                  <p>{t('devices.no_results_desc')}</p>
                  <PawButton
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      handleFilterChange('all');
                    }}
                    style={{ marginTop: '24px' }}
                  >
                    {t('devices.clear_filters')}
                  </PawButton>
                </PawCard>
              </div>
            ) : (
              <div className={styles.deviceList} key={`${filterStatus}_${searchQuery}`}>
                {filteredDevices.map((device) => (
                  <PawCard key={device.deviceId} className={styles.deviceCard}>
                    <div className={styles.cardHeader}>
                      <div>
                        <h3 className={styles.deviceName}>{device.displayName || t('common.unknown')}</h3>
                        <span className={styles.deviceId}>{device.deviceId}</span>
                      </div>
                      <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`}>
                        {device.online ? t('common.online') : t('common.offline')}
                      </span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.detailRow}>
                        <span>{t('device_detail.machine_code')}:</span>
                        <strong>{device.machineCode}</strong>
                      </div>
                      <div className={styles.detailRow}>
                        <span>{t('device_detail.firmware_version')}:</span>
                        <strong>{device.firmwareVersion || 'N/A'}</strong>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <PawButton
                        variant="outline"
                        onClick={() => router.push(`/devices/${device.deviceId}`)}
                        className={styles.actionBtn}
                      >
                        {t('common.details')}
                        <ChevronRight size={16} />
                      </PawButton>
                      <PawButton
                        variant="secondary"
                        onClick={() => router.push(`/devices/${device.deviceId}/feed`)}
                        disabled={!device.online}
                        className={styles.actionBtn}
                      >
                        {t('common.feed_now')}
                        <Cookie size={16} />
                      </PawButton>
                    </div>
                  </PawCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Link Feeder Modal */}
      {showLinkModal && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <h3>{t('link_device.title')}</h3>
            <p className={styles.modalDesc}>{t('link_device.desc')}</p>
            
            <form onSubmit={handleLinkDevice}>
              <div className="form-group" style={{ margin: '16px 0 12px 0' }}>
                <label className="form-label">{t('link_device.machine_code')}</label>
                <div className={styles.inputWrapper}>
                  <Cpu className={styles.inputIcon} size={18} />
                  <input
                    type="text"
                    placeholder="e.g. PF-982314-B"
                    className="input-field"
                    style={{ paddingLeft: '44px' }}
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value)}
                    disabled={linking}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: '12px 0 24px 0' }}>
                <label className="form-label">{t('link_device.pairing_code')}</label>
                <div className={styles.inputWrapper}>
                  <KeyRound className={styles.inputIcon} size={18} />
                  <input
                    type="text"
                    placeholder="e.g. 439012"
                    className="input-field"
                    style={{ paddingLeft: '44px' }}
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    disabled={linking}
                    required
                  />
                </div>
              </div>

              {linkError && (
                <div className={styles.errorAlert} style={{ margin: '12px 0' }}>
                  <AlertTriangle size={16} />
                  <span>{linkError}</span>
                </div>
              )}

              <div className={styles.modalActions}>
                <PawButton type="button" variant="outline" onClick={() => {
                  setShowLinkModal(false);
                  setLinkError(null);
                }} disabled={linking}>
                  {t('common.cancel')}
                </PawButton>
                <PawButton type="submit" variant="primary" loading={linking}>
                  {t('link_device.pair_btn')}
                </PawButton>
              </div>
            </form>
          </PawCard>
        </div>
      )}
    </>
  );
}
