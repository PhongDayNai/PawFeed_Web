'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../../context/AppContext';
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
  Database,
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
  
  const { recentEvent, networkOffline } = useApp();

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
    } catch (err: any) {
      setError(err.message || 'Failed to load device details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

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
      alert(err.message || 'Failed to update name');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleWifiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wifiSsid || !wifiPassword) return;
    setGeneratingConfig(true);
    try {
      const { configId, content } = await deviceApi.createConfigFile(deviceId, wifiSsid, wifiPassword);
      
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
      alert(`Config file saved successfully. Please copy it to your device's storage root.`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate configuration file');
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
      alert(err.message || 'Failed to unlink device');
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
        <p>Loading Feeder Details...</p>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="container" style={{ padding: '32px 24px' }}>
        <PawCard hoverable={false} className={styles.errorCard}>
          <AlertTriangle size={48} color="var(--error)" />
          <h3>Error Loading Details</h3>
          <p>{error || 'Feeder details not found'}</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <PawButton variant="outline" onClick={() => router.back()}>
              <ArrowLeft size={16} /> Go Back
            </PawButton>
            <PawButton variant="primary" onClick={() => fetchDetails()}>
              Retry
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
          Back
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
            Rename
          </PawButton>
        </div>
      </div>

      {/* Main Info Card */}
      <PawCard hoverable={false} className={styles.mainCard}>
        <div className={styles.mainHeader}>
          <div>
            <h1 className={styles.deviceName}>{device.displayName || 'Smart Feeder'}</h1>
            <p className={styles.deviceId}>Device ID: {device.deviceId}</p>
          </div>
          <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {device.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Diagnostic / Connectivity Grid */}
        <div className={styles.syncGrid}>
          <div className={styles.syncRow}>
            <div className={styles.syncLabel}>
              <Activity size={18} />
              <span>MQTT Broker connection</span>
            </div>
            <span className={`badge ${mqtt?.mqttConnected ? 'badge-online' : 'badge-offline'}`}>
              {mqtt?.mqttConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className={styles.syncRow}>
            <div className={styles.syncLabel}>
              <Clock size={18} />
              <span>Schedule Synchronization</span>
            </div>
            <span className={`badge ${isScheduleSynced ? 'badge-online' : 'badge-warning'}`}>
              {isScheduleSynced ? 'Synced' : 'Syncing'}
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
            Device Information
          </h2>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>Machine Code</span>
              <strong>{device.machineCode}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Firmware Version</span>
              <strong>{device.firmwareVersion || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Operating Mode</span>
              <strong>{status?.mode || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Feeder Door Status</span>
              <strong style={{ color: status?.doorOpen ? 'var(--warning)' : 'var(--success)' }}>
                {status?.doorOpen ? 'Open' : 'Closed'}
              </strong>
            </div>
          </div>
        </PawCard>

        {/* Diagnostics Panel */}
        <PawCard hoverable={false} className={styles.infoCard}>
          <h2 className={styles.infoTitle}>
            <Wifi size={18} />
            Diagnostics Panel
          </h2>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span>IP Address</span>
              <strong>{status?.ipAddress || 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>WiFi RSSI Strength</span>
              <strong>{status?.wifiRssi ? `${status.wifiRssi} dBm` : 'N/A'}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Uptime Duration</span>
              <strong>{formatUptime(status?.uptimeSec ?? null)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Heap Memory Status</span>
              <strong>{status?.heap ? `${status.heap.toLocaleString()} bytes` : 'N/A'}</strong>
            </div>
          </div>
        </PawCard>
      </div>

      {/* Quick Action Controls */}
      <div className={styles.controlsSection}>
        <PawButton
          variant="secondary"
          onClick={() => router.push(`/devices/${deviceId}/feed`)}
          disabled={!device.online}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <Utensils size={18} />
          Feed Now
        </PawButton>

        <PawButton
          variant="primary"
          onClick={() => router.push(`/devices/${deviceId}/schedule`)}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <CalendarDays size={18} />
          Schedules Configuration
        </PawButton>

        <PawButton
          variant="outline"
          onClick={() => setShowWifiConfig(true)}
          style={{ height: '52px', fontSize: '1.05rem' }}
        >
          <FolderDown size={18} />
          Generate WiFi Config
        </PawButton>

        <button onClick={() => setShowUnlink(true)} className={styles.unlinkBtn}>
          <Unlink size={16} />
          Unlink Device from Account
        </button>
      </div>

      {/* Rename Dialog */}
      {showEditName && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <h3>Rename Feeder</h3>
            <form onSubmit={handleUpdateName}>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label">New Display Name</label>
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
                  Cancel
                </PawButton>
                <PawButton type="submit" variant="primary" loading={updatingName}>
                  Save
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
            <h3>Generate WiFi Config</h3>
            <p className={styles.modalDesc}>WiFi credential config file will download automatically to be loaded into ESP firmware.</p>
            <form onSubmit={handleWifiConfig}>
              <div className="form-group">
                <label className="form-label">WiFi SSID Name</label>
                <input
                  type="text"
                  placeholder="e.g. MyHomeWiFi"
                  className="input-field"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  disabled={generatingConfig}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: '12px 0 20px 0' }}>
                <label className="form-label">WiFi Password</label>
                <input
                  type="password"
                  placeholder="e.g. 12345678"
                  className="input-field"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  disabled={generatingConfig}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <PawButton type="button" variant="outline" onClick={() => setShowWifiConfig(false)} disabled={generatingConfig}>
                  Cancel
                </PawButton>
                <PawButton type="submit" variant="primary" loading={generatingConfig}>
                  Download & Confirm
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
              <h3>Unlink Feeder</h3>
            </div>
            <p className={styles.modalDesc} style={{ margin: '16px 0' }}>
              Are you sure you want to unlink this device? Your feeder will no longer be associated with your account, and all schedule backups on the server will be deleted.
            </p>
            <div className={styles.modalActions}>
              <PawButton variant="outline" onClick={() => setShowUnlink(false)} disabled={unlinking}>
                Cancel
              </PawButton>
              <PawButton variant="danger" onClick={handleUnlink} loading={unlinking}>
                Unlink Feeder
              </PawButton>
            </div>
          </PawCard>
        </div>
      )}
    </div>
  );
}
