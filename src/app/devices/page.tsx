'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { deviceApi } from '../../lib/api';
import { Device } from '../../lib/types';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { Smartphone, Plus, RefreshCw, Cpu, KeyRound, AlertTriangle, ChevronRight, Cookie } from 'lucide-react';
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

  const devices = sharedDevices || [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchSharedDevices(true);
    } catch (err: any) {
      setError(err.message || t('nav.toast_error', { message: err.message || '' }));
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
      setLinkError(err.message || t('link_device.link_failed_err'));
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
          <div className={styles.deviceList}>
            {devices.map((device) => (
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
