'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { Mail, Lock, User, ShieldAlert } from 'lucide-react';
import styles from './page.module.css';

export default function RegisterPage() {
  const { register, isAuthenticated } = useApp();
  const { t } = useLanguage();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (!fullName || !email || !password || !confirmPassword) {
      setError(t('login.fill_fields_err'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('register.password_mismatch_err'));
      return;
    }

    if (password.length < 6) {
      setError(t('register.password_length_err'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register({ fullName, email, password });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || t('register.register_failed_err'));
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
        <p className={styles.subtitle}>{t('register.subtitle')}</p>

        <PawCard hoverable={false} className={styles.card}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('register.fullname_label')}</label>
              <div className={styles.inputWrapper}>
                <User className={styles.inputIcon} size={18} />
                <input
                  type="text"
                  placeholder={t('register.fullname_placeholder')}
                  className="input-field"
                  style={{ paddingLeft: '44px' }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

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

            <div className="form-group">
              <label className="form-label">{t('register.confirm_password_label')}</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={18} />
                <input
                  type="password"
                  placeholder={t('login.password_placeholder')}
                  className="input-field"
                  style={{ paddingLeft: '44px' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              {t('register.signup_btn')}
            </PawButton>
          </form>
        </PawCard>

        <p className={styles.footerLink}>
          {t('register.has_account')} <Link href="/login">{t('register.signin_link')}</Link>
        </p>
      </div>
    </div>
  );
}
