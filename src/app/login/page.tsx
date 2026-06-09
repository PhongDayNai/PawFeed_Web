'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { Mail, Lock, ShieldAlert } from 'lucide-react';
import styles from './page.module.css';

export default function LoginPage() {
  const { login, isAuthenticated } = useApp();
  const { t } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('login.fill_fields_err'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || t('login.login_failed_err'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authBox}>
        <div className={styles.logo}>
          🐾 Paw<span>Feed</span>
        </div>
        <p className={styles.subtitle}>{t('login.subtitle')}</p>

        <PawCard hoverable={false} className={styles.card}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('account.email_label')}</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} size={18} />
                <input
                  type="email"
                  placeholder={t('login.email_placeholder')}
                  className="input-field"
                  style={{ paddingLeft: '44px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('login.password_label')}</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={18} />
                <input
                  type="password"
                  placeholder={t('login.password_placeholder')}
                  className="input-field"
                  style={{ paddingLeft: '44px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div className={`${styles.errorAlert} animate-fade-in`}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <PawButton
              type="submit"
              variant="primary"
              loading={submitting}
              style={{ width: '100%', marginTop: '12px' }}
            >
              {t('login.signin_btn')}
            </PawButton>
          </form>
        </PawCard>

        <p className={styles.footerLink}>
          {t('login.no_account')} <Link href="/register">{t('login.signup_link')}</Link>
        </p>
      </div>
    </div>
  );
}
