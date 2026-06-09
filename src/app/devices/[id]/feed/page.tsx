'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '../../../../context/AppContext';
import { deviceApi } from '../../../../lib/api';
import { Device } from '../../../../lib/types';
import { PawCard } from '../../../../components/PawCard';
import { PawButton } from '../../../../components/PawButton';
import { ArrowLeft, Cookie, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import styles from './page.module.css';

type FeedState = 'idle' | 'sending' | 'dispensing' | 'success' | 'error';

export default function FeedPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.id as string;

  const { recentEvent } = useApp();

  const [device, setDevice] = useState<Device | null>(null);
  const [duration, setDuration] = useState(5); // 5 seconds default
  const [feedState, setFeedState] = useState<FeedState>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Fetch device details
  useEffect(() => {
    deviceApi.getDevice(deviceId)
      .then((res) => setDevice(res.device))
      .catch((err) => {
        setFeedState('error');
        setErrorMessage(err.message || 'Failed to connect to device');
      });
  }, [deviceId]);

  // Handle SSE device state
  useEffect(() => {
    if (recentEvent && recentEvent.deviceId === deviceId) {
      if (recentEvent.type === 'device_status_updated') {
        setDevice((prev) => prev ? { ...prev, online: recentEvent.online } : null);
        // If device went offline, abort feeding
        if (!recentEvent.online && (feedState === 'sending' || feedState === 'dispensing')) {
          setFeedState('error');
          setErrorMessage('Feeder disconnected during operation.');
        }
      }
    }
  }, [recentEvent, deviceId, feedState]);

  // Dispensing timer countdown
  useEffect(() => {
    if (feedState !== 'dispensing' || secondsRemaining <= 0) {
      if (feedState === 'dispensing' && secondsRemaining === 0) {
        setFeedState('success');
      }
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [feedState, secondsRemaining]);

  // Kibble particle animation inside Canvas
  useEffect(() => {
    if (feedState !== 'dispensing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 240;
    canvas.height = 200;

    interface Kibble {
      x: number;
      y: number;
      vy: number;
      vx: number;
      size: number;
      color: string;
      bounces: number;
    }

    const kibbles: Kibble[] = [];
    const maxKibbles = 100;
    let pileHeight = 0;

    const chuteX = canvas.width / 2;
    const chuteY = 15;
    const chuteWidth = 36;
    const chuteHeight = 12;

    const bowlWidth = 140;
    const bowlHeight = 30;
    const bowlX = (canvas.width - bowlWidth) / 2;
    const bowlY = canvas.height - bowlHeight - 10;

    const kibbleColors = [
      '#8d6e63', // brown
      '#795548', // medium brown
      '#5d4037', // dark brown
      '#a1887f', // light brown
    ];

    let lastTime = 0;
    const spawnRateMs = 60; // Spawn every 60ms

    function drawDispenser(timestamp: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw metal bowl at bottom
      ctx.fillStyle = 'rgba(120, 144, 156, 0.8)'; // steel gray
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bowlX, bowlY);
      ctx.lineTo(bowlX + 10, bowlY + bowlHeight);
      ctx.lineTo(bowlX + bowlWidth - 10, bowlY + bowlHeight);
      ctx.lineTo(bowlX + bowlWidth, bowlY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Draw growing food pile inside bowl
      if (pileHeight > 0) {
        ctx.fillStyle = '#6d4c41'; // darker brown for base pile
        ctx.beginPath();
        ctx.arc(canvas.width / 2, bowlY + bowlHeight / 2, bowlWidth / 2 - 12, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#8d6e63'; // top pile overlay
        ctx.beginPath();
        // The pile gets wider and higher based on pileHeight
        const pileRadius = Math.min(bowlWidth / 2.3, 10 + pileHeight * 1.5);
        ctx.ellipse(
          canvas.width / 2,
          bowlY + bowlHeight - 8 - pileHeight / 3,
          pileRadius,
          Math.min(18, 5 + pileHeight / 2),
          0,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }

      // 3. Spawn falling particles
      if (timestamp - lastTime > spawnRateMs && secondsRemaining > 0.5) {
        kibbles.push({
          x: chuteX + (Math.random() - 0.5) * (chuteWidth - 8),
          y: chuteY + chuteHeight,
          vy: 2 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 1.5,
          size: 3 + Math.random() * 3,
          color: kibbleColors[Math.floor(Math.random() * kibbleColors.length)],
          bounces: 0
        });
        lastTime = timestamp;
      }

      // 4. Update and draw falling kibbles
      for (let i = kibbles.length - 1; i >= 0; i--) {
        const k = kibbles[i];
        k.y += k.vy;
        k.x += k.vx;
        k.vy += 0.15; // gravity

        // Check collision with the food pile / bowl bottom
        const collisionY = bowlY + bowlHeight - 12 - pileHeight / 2;
        if (k.y >= collisionY && k.x >= bowlX + 15 && k.x <= bowlX + bowlWidth - 15) {
          // Collision!
          if (k.bounces < 1) {
            k.y = collisionY - 2;
            k.vy = -k.vy * 0.3; // bounce up
            k.vx = (Math.random() - 0.5) * 2;
            k.bounces++;
          } else {
            // Absorb into pile
            kibbles.splice(i, 1);
            if (pileHeight < 32) {
              pileHeight += 0.28; // grow pile
            }
            continue;
          }
        } else if (k.y > canvas.height) {
          // Out of bounds (missed bowl)
          kibbles.splice(i, 1);
          continue;
        }

        // Draw individual kibble particle
        ctx.fillStyle = k.color;
        ctx.beginPath();
        ctx.arc(k.x, k.y, k.size, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 5. Draw dispenser chute at top
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = 'var(--border-color)';
      ctx.beginPath();
      ctx.roundRect(chuteX - chuteWidth / 2, 0, chuteWidth, chuteHeight + 5, 4);
      ctx.fill();
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawDispenser);
    }

    animationRef.current = requestAnimationFrame(drawDispenser);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [feedState, secondsRemaining]);

  const handleFeed = async () => {
    if (!device?.online) return;
    setFeedState('sending');
    setErrorMessage('');
    try {
      const openDurationMs = duration * 1000;
      await deviceApi.feedNow(deviceId, openDurationMs);
      setSecondsRemaining(duration);
      setFeedState('dispensing');
    } catch (err: any) {
      setFeedState('error');
      setErrorMessage(err.message || 'Failed to dispatch command to feeder.');
    }
  };

  const getDialStyle = () => {
    // 30 seconds max, calculate circular offset
    const percentage = ((duration - 1) / 29) * 100;
    const strokeDashoffset = 502 - (502 * percentage) / 100;
    return { strokeDashoffset };
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '32px 24px', maxWidth: '500px' }}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backBtn} disabled={feedState === 'sending' || feedState === 'dispensing'}>
          <ArrowLeft size={20} />
          Feeder Details
        </button>
      </div>

      <PawCard hoverable={false} className={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 className={styles.feederName}>{device?.displayName || 'Smart Pet Feeder'}</h2>
          <span className={`badge ${device?.online ? 'badge-online' : 'badge-offline'}`}>
            {device?.online ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Circular Gauge / Canvas area */}
        <div className={styles.gaugeContainer}>
          {feedState === 'dispensing' ? (
            <div className={styles.animationWrapper}>
              <canvas ref={canvasRef} className={styles.canvas} />
              <div className={styles.countdownOverlay}>
                <div className={styles.secondsVal}>{secondsRemaining}</div>
                <div className={styles.secondsLbl}>seconds left</div>
              </div>
            </div>
          ) : (
            <div className={styles.dialWrapper}>
              <svg className={styles.dialSvg} width="200" height="200">
                <circle className={styles.dialTrack} cx="100" cy="100" r="80" />
                <circle
                  className={styles.dialValue}
                  cx="100"
                  cy="100"
                  r="80"
                  style={{
                    strokeDasharray: 502,
                    strokeDashoffset: getDialStyle().strokeDashoffset
                  }}
                />
              </svg>
              <div className={styles.dialInfo}>
                <div className={styles.dialValText}>{duration}</div>
                <div className={styles.dialLblText}>seconds</div>
              </div>
            </div>
          )}
        </div>

        {/* State Information Display */}
        <div className={styles.statusDisplay}>
          {feedState === 'idle' && (
            <div className={styles.statusText}>
              <p>Drag the slider below to choose the feed dispensing duration.</p>
            </div>
          )}

          {feedState === 'sending' && (
            <div className={styles.statusInfo}>
              <Loader className="spinning" size={20} />
              <span>Sending feed signal to device...</span>
            </div>
          )}

          {feedState === 'dispensing' && (
            <div className={styles.statusInfo} style={{ color: 'var(--accent)' }}>
              <Loader className="spinning" size={20} style={{ color: 'var(--accent)' }} />
              <span>Dispensing pet kibbles...</span>
            </div>
          )}

          {feedState === 'success' && (
            <div className={styles.statusSuccess}>
              <CheckCircle size={20} />
              <span>Feeding completed successfully!</span>
            </div>
          )}

          {feedState === 'error' && (
            <div className={styles.statusError}>
              <AlertCircle size={20} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Duration Slider */}
        {feedState === 'idle' && (
          <div className={styles.sliderContainer}>
            <div className={styles.sliderLabels}>
              <span>1s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>
        )}

        {/* Control Button */}
        {feedState === 'success' ? (
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <PawButton
              variant="outline"
              onClick={() => setFeedState('idle')}
              style={{ flex: 1 }}
            >
              Feed Again
            </PawButton>
            <PawButton
              variant="secondary"
              onClick={() => router.back()}
              style={{ flex: 1 }}
            >
              Done
            </PawButton>
          </div>
        ) : (
          <PawButton
            variant="secondary"
            onClick={handleFeed}
            disabled={feedState !== 'idle' || !device?.online}
            style={{ width: '100%', height: '52px', marginTop: '16px' }}
          >
            <Cookie size={18} />
            Dispense Feed Now
          </PawButton>
        )}
      </PawCard>
    </div>
  );
}
