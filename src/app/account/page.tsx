'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../lib/api';
import { PawCard } from '../../components/PawCard';
import { PawButton } from '../../components/PawButton';
import { User, Mail, ShieldAlert, CheckCircle, Shield, KeyRound } from 'lucide-react';
import styles from './page.module.css';

export default function AccountPage() {
  const { user, updateUserFullName } = useApp();
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
      setProfileError(err.message || 'Failed to update profile name');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
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
      setPasswordError(err.message || 'Failed to change password. Double check your old password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '720px' }}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>Configure your profile and security credentials</p>
      </div>

      <div className={styles.layout}>
        {/* Profile Card */}
        <PawCard hoverable={false} className={styles.card}>
          <h2 className={styles.cardTitle}>
            <User size={18} />
            Profile Details
          </h2>

          <div className={styles.readOnlyField}>
            <span className={styles.label}>Email Address</span>
            <div className={styles.roValue}>
              <Mail size={16} />
              <span>{user?.email}</span>
            </div>
          </div>

          <div className={styles.readOnlyField} style={{ marginBottom: '24px' }}>
            <span className={styles.label}>Account Role</span>
            <div className={styles.roValue}>
              <Shield size={16} />
              <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className={styles.inputWrapper}>
                <User className={styles.inputIcon} size={18} />
                <input
                  type="text"
                  placeholder="e.g. John Doe"
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
                <span>Profile updated successfully!</span>
              </div>
            )}

            <PawButton
              type="submit"
              variant="secondary"
              loading={updatingProfile}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Update Profile Name
            </PawButton>
          </form>
        </PawCard>

        {/* Change Password Card */}
        <PawCard hoverable={false} className={styles.card}>
          <h2 className={styles.cardTitle}>
            <KeyRound size={18} />
            Update Password
          </h2>

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                className="input-field"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={updatingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ margin: '12px 0' }}>
              <label className="form-label">New Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={updatingPassword}
                required
              />
            </div>

            <div className="form-group" style={{ margin: '12px 0 20px 0' }}>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
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
                <span>Password changed successfully!</span>
              </div>
            )}

            <PawButton
              type="submit"
              variant="primary"
              loading={updatingPassword}
              style={{ width: '100%' }}
            >
              Change Password
            </PawButton>
          </form>
        </PawCard>
      </div>
    </div>
  );
}
