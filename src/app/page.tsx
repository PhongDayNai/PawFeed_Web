'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { Loader } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useApp();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '16px',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-outfit)',
          fontSize: '2.5rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
        }}
      >
        🐾 Paw<span style={{ color: 'var(--accent)' }}>Feed</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
        <Loader className="spinning" size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Initializing...</span>
      </div>
    </div>
  );
}
