'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { deviceApi } from '../../../lib/api';
import { PawCard } from '../../../components/PawCard';
import { PawButton } from '../../../components/PawButton';
import { ArrowLeft, Cpu, KeyRound, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';

export default function LinkDevicePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [machineCode, setMachineCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineCode || !pairingCode) return;

    setLoading(true);
    setError(null);
    try {
      await deviceApi.linkDevice(machineCode, pairingCode);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || t('link_device.link_failed_err'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '500px' }}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} disabled={loading}>
          <ArrowLeft size={20} />
          {t('nav.dashboard')}
        </button>
        <h1 className={styles.title}>{t('link_device.title')}</h1>
      </div>

      <PawCard hoverable={false} className={styles.card}>
        <p className={styles.cardDesc}>
          {t('link_device.desc')}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
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
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: '16px 0 24px 0' }}>
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
                disabled={loading}
                required
              />
            </div>
          </div>

          {error && (
            <div className={`${styles.errorAlert} animate-fade-in`}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <PawButton
            type="submit"
            variant="secondary"
            loading={loading}
            style={{ width: '100%', height: '48px' }}
          >
            {t('link_device.pair_btn')}
          </PawButton>
        </form>
      </PawCard>
    </div>
  );
}
