'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';
import { deviceApi } from '../../../lib/api';
import { Device, DeviceStatus, MqttStatus, Schedule } from '../../../lib/types';
import { PawCard } from '../../../components/PawCard';
import { PawButton } from '../../../components/PawButton';
import {
  ArrowLeft,
  Settings,
  Cpu,
  Activity,
  Wifi,
  Clock,
  Unlink,
  AlertTriangle,
  RefreshCw,
  FolderDown,
  CalendarDays,
  Utensils
} from 'lucide-react';
import styles from './page.module.css';

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;
  
  const { user, recentEvent } = useApp();
  const { t } = useLanguage();

  const [device, setDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [mqtt, setMqtt] = useState<MqttStatus | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);

  const [showWifiConfig, setShowWifiConfig] = useState(false);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [generatingConfig, setGeneratingConfig] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [changeWifi, setChangeWifi] = useState(false);

  const [showUnlink, setShowUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchDetails = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const devRes = await deviceApi.getDevice(deviceId);
      setDevice(devRes.device);
      setNewName(devRes.device.displayName || '');

      try {
        const statRes = await deviceApi.getDeviceStatus(deviceId);
        setStatus(statRes);
      } catch (e) {
        console.warn('Failed to fetch status', e);
      }

      try {
        const mqttRes = await deviceApi.getMqttStatus(deviceId);
        setMqtt(mqttRes);
      } catch (e) {
        console.warn('Failed to fetch MQTT status', e);
      }

      try {
        const schedRes = await deviceApi.getSchedule(deviceId);
        setSchedule(schedRes.schedule);
      } catch (e) {
        console.warn('Failed to fetch Schedule', e);
      }

      try {
        const configRes = await deviceApi.getCurrentConfig(deviceId);
        setCurrentConfig(configRes);
      } catch (e) {
        console.warn('Failed to fetch current config', e);
      }
    } catch (err: any) {
      setError(err.message || t('nav.toast_error', { message: err.message || '' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId, t]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    if (showWifiConfig) {
      const hasWifi = !!currentConfig?.wifiSsid;
      setChangeWifi(!hasWifi);
      if (hasWifi) {
        setWifiSsid(currentConfig.wifiSsid);
        setWifiPassword('');
      } else {
        setWifiSsid('');
        setWifiPassword('');
      }
    }
  }, [showWifiConfig, currentConfig]);

  // Handle SSE realtime updates
  useEffect(() => {
    if (recentEvent && recentEvent.deviceId === deviceId) {
      if (recentEvent.type === 'device_status_updated') {
        setDevice((prev) => prev ? { ...prev, online: recentEvent.online } : null);
        setStatus(recentEvent as unknown as DeviceStatus);
      } else if (recentEvent.type === 'config_applied') {
        fetchDetails(true); // reload to get matching versions
      }
    }
  }, [recentEvent, deviceId, fetchDetails]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setUpdatingName(true);
    try {
      const updated = await deviceApi.updateDeviceName(deviceId, newName);
      setDevice(updated);
      setShowEditName(false);
    } catch (err: any) {
      alert(err.message || t('nav.toast_error', { message: err.message || '' }));
    } finally {
      setUpdatingName(false);
    }
  };

  const handleWifiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changeWifi && (!wifiSsid || !wifiPassword)) return;
    setGeneratingConfig(true);
    try {
      const { configId, content } = changeWifi
        ? await deviceApi.createConfigFile(deviceId, wifiSsid, wifiPassword)
        : await deviceApi.regenerateConfigFile(deviceId);
      
      // Trigger local download of file with name = deviceId
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = deviceId; // file name without extension
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Call confirm endpoint
      await deviceApi.confirmConfigFile(deviceId, configId);
      setShowWifiConfig(false);
      alert(t('device_detail.wifi_success'));
    } catch (err: any) {
      alert(err.message || t('nav.toast_error', { message: err.message || '' }));
    } finally {
      setGeneratingConfig(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await deviceApi.unlinkDevice(deviceId);
      router.replace('/dashboard');
    } catch (err: any) {
      alert(err.message || t('nav.toast_error', { message: err.message || '' }));
      setUnlinking(false);
    }
  };

  const formatUptime = (sec: number | null) => {
    if (sec === null || sec === undefined) return 'N/A';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="container" style={{ padding: '32px 24px' }}>
        <PawCard hoverable={false} className={styles.errorCard}>
          <AlertTriangle size={48} color="var(--error)" />
          <h3>{t('dashboard.error_loading')}</h3>
          <p>{error || t('common.unknown')}</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <PawButton variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} /> {t('common.back')}
            </PawButton>
            <PawButton variant="primary" onClick={() => fetchDetails()}>
              {t('common.retry')}
            </PawButton>
          </div>
        </PawCard>
      </div>
    );
  }

  const isScheduleSynced = status && schedule && status.activeConfigVersion === schedule.version;

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '800px' }}>
      {/* Back Header */}
      <div className={styles.detailHeader}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          <ArrowLeft size={20} />
          {t('common.back')}
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <PawButton variant="outline" onClick={() => fetchDetails(true)} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
          </PawButton>
          <PawButton variant="outline" onClick={() => {
            setNewName(device.displayName || '');
            setShowEditName(true);
          }}>
            <Settings size={16} />
            {t('device_detail.rename')}
          </PawButton>
        </div>
      </div>

      {/* Main Info Card */}
      <PawCard hoverable={false} className={styles.mainCard}>
        <div className={styles.mainHeader}>
          <div>
            <h1 className={styles.deviceName}>{device.displayName || t('common.unknown')}</h1>
            <p className={styles.deviceId}>{t('device_detail.device_id')} {device.deviceId}</p>
          </div>
          <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {device.online ? t('common.online') : t('common.offline')}
          </span>
        </div>

        {/* Diagnostic / Connectivity Grid */}
        <div className={styles.syncGrid}>
          <div className={styles.syncRow}>
            <div className={styles.syncLabel}>
              <Activity size={18} />
              <span>{t('device_detail.mqtt_connection')}</span>
            </div>
            <span className={`badge ${mqtt?.mqttConnected ? 'badge-online' : 'badge-offline'}`}>
              {mqtt?.mqttConnected ? t('common.connected') : t('common.disconnected')}
            </span>
          </div>

          <div className={styles.syncRow}>
            <div className={styles.syncLabel}>
              <Clock size={18} />
              <span>{t('device_detail.schedule_sync')}</span>
            </div>
            <span className={`badge ${isScheduleSynced ? 'badge-online' : 'badge-warning'}`}>
              {isScheduleSynced ? t('device_detail.synced') : t('device_detail.syncing')}
            </span>
          </div>
        </div>
      </PawCard>

      {/* Specifications & Diagnostics Grid */}
      <div className={styles.infoGrid}>
        {/* Specs Panel */}
        <PawCard hoverable={false} className={styles.infoCard}>
          <h2 className={styles.infoTitle}>
            <Cpu size={18} />
            {t('device_detail.device_info')}
          </h2>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>{t('device_detail.machine_code')}</span>
              <strong>{device.machineCode}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>{t('device_detail.firmware_version')}</span>
              <strong>{device.firmwareVersion || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>{t('device_detail.operating_mode')}</span>
              <strong>{status?.mode || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>{t('device_detail.door_status')}</span>
              <strong style={{ color: status?.doorOpen ? 'var(--warning)' : 'var(--success)' }}>
                {status?.doorOpen ? t('device_detail.door_open') : t('device_detail.door_closed')}
              </strong>
            </div>
          </div>
        </PawCard>

        {/* Diagnostics Panel */}
        <PawCard hoverable={false} className={styles.infoCard}>
          <h2 className={styles.infoTitle}>
            <Wifi size={18} />
            {t('device_detail.diagnostics')}
          </h2>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>{t('device_detail.ip_address')}</span>
              <strong>{status?.ipAddress || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>{t('device_detail.wifi_signal')}</span>
              <strong>{status?.wifiRssi ? `${status.wifiRssi} dBm` : 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>{t('device_detail.uptime')}</span>
              <strong>{formatUptime(status?.uptimeSec ?? null)}</strong>
            </div>
            {user?.role !== 'user' && (
              <div className={styles.infoRow}>
                <span>{t('device_detail.heap_memory')}</span>
                <strong>{status?.heap ? `${status.heap.toLocaleString()} bytes` : 'N/A'}</strong>
              </div>
            )}
          </div>
        </PawCard>
      </div>

      {/* Quick Action Controls */}
      <div className={styles.controlsSection}>
        <PawButton
          variant="secondary"
          onClick={() => router.push(`/devices/${deviceId}/feed`)}
          disabled={!status || !device.online}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <Utensils size={18} />
          {t('common.feed_now')}
        </PawButton>

        <PawButton
          variant="primary"
          onClick={() => router.push(`/devices/${deviceId}/schedule`)}
          disabled={!status}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <CalendarDays size={18} />
          {t('common.schedules')}
        </PawButton>

        <PawButton
          variant="outline"
          onClick={() => setShowWifiConfig(true)}
          disabled={!status}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <FolderDown size={18} />
          {t('device_detail.generate_wifi')}
        </PawButton>

        <button onClick={() => setShowUnlink(true)} className={styles.unlinkBtn}>
          <Unlink size={16} />
          {t('device_detail.unlink_device')}
        </button>
      </div>

      {/* Rename Dialog */}
      {showEditName && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <h3>{t('device_detail.rename_dialog_title')}</h3>
            <form onSubmit={handleUpdateName}>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label">{t('device_detail.rename_dialog_label')}</label>
                <input
                  type="text"
                  className="input-field"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={updatingName}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <PawButton type="button" variant="outline" onClick={() => setShowEditName(false)} disabled={updatingName}>
                  {t('common.cancel')}
                </PawButton>
                <PawButton type="submit" variant="primary" loading={updatingName}>
                  {t('common.save')}
                </PawButton>
              </div>
            </form>
          </PawCard>
        </div>
      )}

      {/* WiFi Config Dialog */}
      {showWifiConfig && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <h3>{t('device_detail.wifi_dialog_title')}</h3>
            <p className={styles.modalDesc}>{t('device_detail.wifi_dialog_desc')}</p>
            <form onSubmit={handleWifiConfig}>
              {currentConfig?.wifiSsid && (
                <div 
                  className={styles.checkboxContainer} 
                  onClick={() => setChangeWifi(prev => !prev)}
                >
                  <input
                    type="checkbox"
                    id="changeWifiCheckbox"
                    checked={changeWifi}
                    onChange={(e) => {
                      e.stopPropagation();
                      setChangeWifi(e.target.checked);
                    }}
                    className={styles.checkboxInput}
                  />
                  <label 
                    htmlFor="changeWifiCheckbox" 
                    className={styles.checkboxLabel}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('device_detail.change_wifi_checkbox')}
                  </label>
                </div>
              )}

              {!changeWifi && currentConfig?.wifiSsid && (
                <div className={styles.currentWifiPanel}>
                  <div className={styles.currentWifiTitleRow}>
                    <Wifi size={16} />
                    <span>{t('device_detail.current_wifi_ssid')}</span>
                    <span className={styles.currentWifiName}>{currentConfig.wifiSsid}</span>
                  </div>
                  <p className={styles.currentWifiDesc}>
                    {t('device_detail.regenerate_desc')}
                  </p>
                </div>
              )}

              {changeWifi && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('device_detail.wifi_ssid_label')}</label>
                    <input
                      type="text"
                      placeholder="e.g. MyHomeWiFi"
                      className="input-field"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      disabled={generatingConfig}
                      required={changeWifi}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '12px 0 20px 0' }}>
                    <label className="form-label">{t('device_detail.wifi_password_label')}</label>
                    <input
                      type="password"
                      placeholder="e.g. 12345678"
                      className="input-field"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      disabled={generatingConfig}
                      required={changeWifi}
                    />
                  </div>
                </>
              )}
              <div className={styles.modalActions}>
                <PawButton type="button" variant="outline" onClick={() => setShowWifiConfig(false)} disabled={generatingConfig}>
                  {t('common.cancel')}
                </PawButton>
                <PawButton type="submit" variant="primary" loading={generatingConfig}>
                  {t('common.confirm')}
                </PawButton>
              </div>
            </form>
          </PawCard>
        </div>
      )}

      {/* Unlink Dialog */}
      {showUnlink && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--error)' }}>
              <AlertTriangle size={24} />
              <h3>{t('device_detail.confirm_unlink_title')}</h3>
            </div>
            <p className={styles.modalDesc} style={{ margin: '16px 0' }}>
              {t('device_detail.confirm_unlink_desc')}
            </p>
            <div className={styles.modalActions}>
              <PawButton variant="outline" onClick={() => setShowUnlink(false)} disabled={unlinking}>
                {t('common.cancel')}
              </PawButton>
              <PawButton variant="danger" onClick={handleUnlink} loading={unlinking}>
                {t('device_detail.unlink_device')}
              </PawButton>
            </div>
          </PawCard>
        </div>
      )}
    </div>
  );
}
