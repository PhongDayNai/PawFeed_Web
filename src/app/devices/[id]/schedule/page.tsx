'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '../../../../context/LanguageContext';
import { deviceApi } from '../../../../lib/api';
import { Schedule, ScheduleEntry } from '../../../../lib/types';
import { PawCard } from '../../../../components/PawCard';
import { PawButton } from '../../../../components/PawButton';
import {
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  CheckCircle
} from 'lucide-react';
import styles from './page.module.css';



export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const { t } = useLanguage();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [conflictModal, setConflictModal] = useState(false);

  // Dialog states for editing/adding entry
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [entryTime, setEntryTime] = useState('07:00');
  const [entryDurationMs, setEntryDurationMs] = useState(5000);
  const [entryEnabled, setEntryEnabled] = useState(true);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deviceApi.getSchedule(deviceId);
      setSchedule(res.schedule);
      setEtag(res.etag);
    } catch (err: any) {
      setError(err.message || t('schedule.load_failed_err'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, t]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleMasterToggle = (val: boolean) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      enabled: val
    });
  };

  const handleEntryToggle = (entryIndex: number, val: boolean) => {
    if (!schedule) return;
    const updatedEntries = [...schedule.entries];
    updatedEntries[entryIndex] = {
      ...updatedEntries[entryIndex],
      enabled: val
    };
    setSchedule({
      ...schedule,
      entries: updatedEntries
    });
  };

  const handleDeleteEntry = (entryIndex: number) => {
    if (!schedule) return;
    const updatedEntries = schedule.entries.filter((_, idx) => idx !== entryIndex);
    setSchedule({
      ...schedule,
      entries: updatedEntries
    });
  };

  const openAddDialog = () => {
    setEditingEntry(null);
    setEntryTime('07:00');
    setEntryDurationMs(5000);
    setEntryEnabled(true);
    setShowEditDialog(true);
  };

  const openEditDialog = (entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setEntryTime(entry.time);
    setEntryDurationMs(entry.openDurationMs);
    setEntryEnabled(entry.enabled);
    setShowEditDialog(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;

    const newOrUpdatedEntry: ScheduleEntry = {
      id: editingEntry ? editingEntry.id : Date.now(), // Use temporary ID if new
      time: entryTime,
      openDurationMs: entryDurationMs,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      enabled: entryEnabled,
      mealId: editingEntry?.mealId || null,
      mealOrder: editingEntry?.mealOrder || null
    };

    let updatedEntries = [...schedule.entries];
    if (editingEntry) {
      // Edit
      updatedEntries = updatedEntries.map((item) => item.id === editingEntry.id ? newOrUpdatedEntry : item);
    } else {
      // Add
      updatedEntries.push(newOrUpdatedEntry);
    }

    setSchedule({
      ...schedule,
      entries: updatedEntries
    });
    setShowEditDialog(false);
  };



  const handleSaveSchedule = async () => {
    if (!schedule) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    // Clean negative or temporary IDs back to 0 for backend requirements
    const cleanedEntries = schedule.entries.map((item) => {
      // In JS, custom/date IDs are large positive numbers. If they are new, convert id to 0.
      const isNew = !schedule.entries.some((orig) => orig.id === item.id) || item.id > 1000000000;
      return isNew ? { ...item, id: 0 } : item;
    });

    const payload = {
      ...schedule,
      entries: cleanedEntries
    };

    try {
      const res = await deviceApi.updateSchedule(deviceId, payload, etag);
      setSchedule(res.schedule);
      setEtag(res.etag);
      setSuccessMsg(t('schedule.sync_success'));
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      if (err.status === 412) {
        // ETag Conflict
        setConflictModal(true);
      } else {
        setError(err.message || t('schedule.save_failed_err'));
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };



  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className="spinning" size={40} />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '720px' }}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} disabled={saving}>
          <ArrowLeft size={20} />
          {t('device_detail.title')}
        </button>
        <h1 className={styles.title}>{t('schedule.title')}</h1>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className={styles.successAlert}>
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {schedule && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Master Toggle */}
          <PawCard hoverable={false} className={styles.masterToggleCard}>
            <div className={styles.masterText}>
              <h3>{t('schedule.enable')}</h3>
              <p>{t('schedule.enable_desc')}</p>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => handleMasterToggle(e.target.checked)}
              />
              <span className={styles.sliderRound} />
            </label>
          </PawCard>

          {/* Schedule List */}
          <div className={styles.scheduleListContainer}>
            <div className={styles.listHeader}>
              <h2>{t('schedule.backup_schedules', { count: schedule.entries.length })}</h2>
              {schedule.entries.length < 8 && (
                <PawButton variant="secondary" onClick={openAddDialog} className={styles.addBtn}>
                  <Plus size={16} />
                  {t('schedule.add_feeding')}
                </PawButton>
              )}
            </div>

            {schedule.entries.length === 0 ? (
              <PawCard hoverable={false} className={styles.emptyCard}>
                <Clock size={40} className={styles.emptyIcon} />
                <h3>{t('schedule.no_schedules_title')}</h3>
                <p>{t('schedule.no_schedules_desc')}</p>
              </PawCard>
            ) : (
              <div className={styles.list}>
                {schedule.entries.map((entry, index) => (
                  <PawCard key={entry.id} hoverable={false} className={styles.scheduleItem}>
                    <div className={styles.scheduleTimeRow}>
                      <div className={styles.timeGroup}>
                        <Clock size={20} color="var(--primary)" />
                        <span className={styles.timeText}>{entry.time}</span>
                        <span className={styles.durationText}>
                          {t('schedule.duration_for', { duration: formatDuration(entry.openDurationMs) })}
                        </span>
                      </div>
                      
                      <div className={styles.itemActions}>
                        <label className={styles.switchSmall}>
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => handleEntryToggle(index, e.target.checked)}
                          />
                          <span className={styles.sliderRound} />
                        </label>
                        <button onClick={() => openEditDialog(entry)} className={styles.actionIconBtn}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteEntry(index)} className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>


                  </PawCard>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <PawButton
            variant="secondary"
            onClick={handleSaveSchedule}
            loading={saving}
            style={{ width: '100%', height: '52px', marginTop: '12px' }}
          >
            {t('schedule.save_backups_btn')}
          </PawButton>
        </div>
      )}

      {/* Edit / Add Dialog */}
      {showEditDialog && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <h3>{editingEntry ? t('schedule.edit_dialog_title') : t('schedule.add_dialog_title')}</h3>
            <form onSubmit={handleSaveEntry}>
              <div className="form-group" style={{ margin: '16px 0 12px 0' }}>
                <label className="form-label">{t('schedule.time')}</label>
                <input
                  type="time"
                  className="input-field"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: '12px 0' }}>
                <label className="form-label">
                  {t('schedule.duration')}: {formatDuration(entryDurationMs)}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Sliders size={18} color="var(--text-muted)" />
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="500"
                    value={entryDurationMs}
                    onChange={(e) => setEntryDurationMs(parseInt(e.target.value))}
                    className={styles.slider}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>



              <div className="form-group" style={{ margin: '12px 0 20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">{t('schedule.enable_entry')}</label>
                  <label className={styles.switchSmall}>
                    <input
                      type="checkbox"
                      checked={entryEnabled}
                      onChange={(e) => setEntryEnabled(e.target.checked)}
                    />
                    <span className={styles.sliderRound} />
                  </label>
                </div>
              </div>

              <div className={styles.modalActions}>
                <PawButton type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  {t('common.cancel')}
                </PawButton>
                <PawButton type="submit" variant="primary">
                  {t('schedule.apply_changes')}
                </PawButton>
              </div>
            </form>
          </PawCard>
        </div>
      )}

      {/* Version Conflict Modal */}
      {conflictModal && (
        <div className={styles.modalOverlay}>
          <PawCard hoverable={false} className={styles.modal}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: 'var(--warning)' }}>
              <AlertTriangle size={24} />
              <h3>{t('schedule.conflict_title')}</h3>
            </div>
            <p className={styles.modalDesc} style={{ margin: '16px 0' }}>
              {t('schedule.conflict_desc')}
            </p>
            <div className={styles.modalActions}>
              <PawButton variant="outline" onClick={() => setConflictModal(false)}>
                {t('common.cancel')}
              </PawButton>
              <PawButton variant="secondary" onClick={() => {
                setConflictModal(false);
                fetchSchedule();
              }}>
                {t('schedule.reload_btn')}
              </PawButton>
            </div>
          </PawCard>
        </div>
      )}
    </div>
  );
}
