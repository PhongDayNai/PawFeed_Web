'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { authApi } from '../../lib/api';
import { getFriendlyErrorMessage } from '../../lib/error';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { User, Mail, ShieldAlert, CheckCircle, Shield, KeyRound } from 'lucide-react';
import styles from './page.module.css';

export default function AccountPage() {
  const { user, updateUserFullName } = useApp();
  const { t } = useLanguage();
  const router = useRouter();

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setUpdatingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await authApi.updateProfile(fullName);
      updateUserFullName(fullName);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(getFriendlyErrorMessage(err, 'account.profile_failed_err', t));
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('account.fill_password_err'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.password_mismatch_err'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('account.password_length_err'));
      return;
    }

    setUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await authApi.changePassword({ currentPassword: oldPassword, newPassword });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(getFriendlyErrorMessage(err, 'account.password_failed_err', t));
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '720px' }}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('account.title')}</h1>
        <p className={styles.subtitle}>{t('account.subtitle')}</p>
      </div>

      <div className={styles.layout}>
        {/* Profile Card */}
        <PawCard hoverable={false} className={styles.card}>
          <h2 className={styles.cardTitle}>
            <User size={18} />
            {t('account.profile_details')}
          </h2>

          <div className={styles.readOnlyField}>
            <span className={styles.label}>{t('account.email_label')}</span>
            <div className={styles.roValue}>
              <Mail size={16} />
              <span>{user?.email}</span>
            </div>
          </div>

          <div className={styles.readOnlyField} style={{ marginBottom: '24px' }}>
            <span className={styles.label}>{t('account.role_label')}</span>
            <div className={styles.roValue}>
              <Shield size={16} />
              <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile}>
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
                  disabled={updatingProfile}
                  required
                />
              </div>
            </div>

            {profileError && (
              <div className={styles.errorAlert}>
                <ShieldAlert size={16} />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className={styles.successAlert}>
                <CheckCircle size={16} />
                <span>{t('account.profile_success')}</span>
              </div>
            )}

            <PawButton
              type="submit"
              variant="secondary"
              loading={updatingProfile}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {t('account.update_profile_btn')}
            </PawButton>
          </form>
        </PawCard>

        {/* Change Password Card */}
        <PawCard hoverable={false} className={styles.card}>
          <h2 className={styles.cardTitle}>
            <KeyRound size={18} />
            {t('account.change_password_title')}
          </h2>

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">{t('account.current_password_label')}</label>
              <input
                type="password"
                placeholder={t('login.password_placeholder')}
                className="input-field"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={updatingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ margin: '12px 0' }}>
              <label className="form-label">{t('account.new_password_label')}</label>
              <input
                type="password"
                placeholder={t('login.password_placeholder')}
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={updatingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ margin: '12px 0 20px 0' }}>
              <label className="form-label">{t('account.confirm_new_password_label')}</label>
              <input
                type="password"
                placeholder={t('login.password_placeholder')}
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={updatingPassword}
                required
              />
            </div>

            {passwordError && (
              <div className={styles.errorAlert}>
                <ShieldAlert size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className={styles.successAlert}>
                <CheckCircle size={16} />
                <span>{t('account.password_success')}</span>
              </div>
            )}

            <PawButton
              type="submit"
              variant="primary"
              loading={updatingPassword}
              style={{ width: '100%' }}
            >
              {t('account.change_password_btn')}
            </PawButton>
          </form>
        </PawCard>
      </div>
    </div>
  );
}
