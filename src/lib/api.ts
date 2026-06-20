import { DashboardData, Device, DeviceStatus, MqttStatus, Schedule, FeedingHistory, User, AuthResponse, ChatbotInitResponse, ChatbotResponse, ChatbotHistoryResponse, ChatbotMessage } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Memory cache or lock for refresh token request to prevent duplicate refreshes
let refreshPromise: Promise<string | null> | null = null;

async function refreshTokens(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new Error('Refresh failed');
    }

    const data: AuthResponse = await res.json();
    if (data.accessToken && data.refreshToken) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.accessToken;
    }
    return null;
  } catch (error) {
    console.error('Token refresh failed', error);
    // Clear tokens and redirect
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return null;
  }
}

export async function fetchApi(path: string, options: RequestInit = {}): Promise<any> {
  let token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set Content-Type default to JSON if body is provided and not already set
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const defaultSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(120000)
    : undefined;

  const response = await fetch(`${BASE_URL}${path}`, {
    cache: 'no-store',
    signal: defaultSignal,
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      // Use existing promise or create new one to avoid double call
      if (!refreshPromise) {
        refreshPromise = refreshTokens(refreshToken).finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        // Retry the original request with the new token
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryResponse = await fetch(`${BASE_URL}${path}`, {
          cache: 'no-store',
          signal: defaultSignal,
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          const errData = await retryResponse.json().catch(() => ({}));
          throw new ApiError(errData.message || 'API request failed', retryResponse.status);
        }

        // Return JSON directly or headers + JSON for special endpoints like getSchedule
        if (path.includes('/schedule') && options.method === 'GET') {
          const etag = retryResponse.headers.get('ETag');
          const body = await retryResponse.json();
          return { body, etag };
        }

        return retryResponse.status === 204 ? null : await retryResponse.json();
      }
    }

    // Refresh failed or no refresh token, redirect to login
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new ApiError(errData.message || 'API request failed', response.status);
  }

  if (path.includes('/schedule') && options.method === 'GET') {
    const etag = response.headers.get('ETag');
    const body = await response.json();
    return { body, etag };
  }

  if (path.includes('/schedule') && options.method === 'PUT') {
    const etag = response.headers.get('ETag');
    const body = await response.json();
    return { body, etag };
  }

  return response.status === 204 ? null : await response.json();
}

// Authentication API
export const authApi = {
  async login(credentials: Record<string, string>): Promise<AuthResponse> {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.accessToken) {
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.user));
    }
    return res;
  },

  async register(data: Record<string, string>): Promise<AuthResponse> {
    const res = await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.accessToken) {
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.user));
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetchApi('/auth/me');
    return res.user;
  },

  async updateProfile(fullName: string): Promise<any> {
    const res = await fetchApi('/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName }),
    });
    // Update local user full name
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      parsed.fullName = fullName;
      localStorage.setItem('user', JSON.stringify(parsed));
    }
    return res;
  },

  async changePassword(passwords: Record<string, string>): Promise<any> {
    return fetchApi('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    });
  },
};

// Devices & Feeding API
export const deviceApi = {
  async getDashboard(): Promise<DashboardData> {
    return fetchApi('/dashboard');
  },

  async getDevices(): Promise<{ devices: Device[] }> {
    return fetchApi('/devices');
  },

  async getDevice(deviceId: string): Promise<{ device: Device }> {
    return fetchApi(`/devices/${deviceId}`);
  },

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const res = await fetchApi(`/devices/${deviceId}/status`);
    // API returns DeviceStatusResponse { ok: boolean, deviceId: string, ... } or DeviceStatus directly.
    // Let's normalize it to DeviceStatus
    return res.ok ? res : res;
  },

  async linkDevice(machineCode: string, pairingCode: string): Promise<Device> {
    const res = await fetchApi('/devices/link', {
      method: 'POST',
      body: JSON.stringify({ machineCode, pairingCode }),
    });
    return res.device;
  },

  async unlinkDevice(deviceId: string): Promise<void> {
    await fetchApi(`/devices/${deviceId}/unlink`, { method: 'POST' });
  },

  async updateDeviceName(deviceId: string, displayName: string): Promise<Device> {
    const res = await fetchApi(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    });
    return res.device;
  },

  async getSchedule(deviceId: string): Promise<{ schedule: Schedule; etag: string | null }> {
    const res = await fetchApi(`/devices/${deviceId}/schedule`, { method: 'GET' });
    return {
      schedule: res.body,
      etag: res.etag,
    };
  },

  async updateSchedule(deviceId: string, schedule: Schedule, etag: string | null): Promise<{ schedule: Schedule; etag: string | null }> {
    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-Match'] = etag;
    }

    // Clean schedule entries (only keep time, openDurationMs)
    const cleanedEntries = schedule.entries.map((item) => ({
      time: item.time,
      openDurationMs: item.openDurationMs
    }));

    // Clean root schedule payload (only keep enabled, timezone, timezoneOffsetSec, entries)
    const cleanedPayload = {
      enabled: schedule.enabled,
      timezone: schedule.timezone,
      timezoneOffsetSec: schedule.timezoneOffsetSec,
      entries: cleanedEntries
    };

    const res = await fetchApi(`/devices/${deviceId}/schedule`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(cleanedPayload),
    });
    return {
      schedule: res.body,
      etag: res.etag,
    };
  },

  async feedNow(deviceId: string, openDurationMs: number): Promise<{ command: any }> {
    // Generate simple UUID for Idempotency-Key
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);

    return fetchApi(`/devices/${deviceId}/commands/feed-now`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ openDurationMs }),
    });
  },

  async getCommandStatus(deviceId: string, requestId: string): Promise<{ command: any }> {
    return fetchApi(`/devices/${deviceId}/commands/${requestId}`);
  },

  async getFeedingHistory(deviceId: string): Promise<{ feedingHistory: FeedingHistory[] }> {
    return fetchApi(`/devices/${deviceId}/feeding-history`);
  },

  async getDeviceEvents(deviceId: string, page = 1, pageSize = 20): Promise<{ events: any[] }> {
    return fetchApi(`/devices/${deviceId}/events?page=${page}&pageSize=${pageSize}`);
  },

  async getMqttStatus(deviceId: string): Promise<MqttStatus> {
    return fetchApi(`/devices/${deviceId}/mqtt-status`);
  },

  async createConfigFile(deviceId: string, wifiSsid: string, wifiPassword: string): Promise<{ configId: string; content: string }> {
    return fetchApi(`/devices/${deviceId}/config-file?mode=json`, {
      method: 'POST',
      body: JSON.stringify({ wifiSsid, wifiPassword }),
    });
  },

  async regenerateConfigFile(deviceId: string): Promise<{ configId: string; content: string }> {
    return fetchApi(`/devices/${deviceId}/config-file/regenerate?mode=json`, {
      method: 'POST',
    });
  },

  async getCurrentConfig(deviceId: string): Promise<any> {
    return fetchApi(`/devices/${deviceId}/current-config`, { method: 'GET' });
  },

  async confirmConfigFile(deviceId: string, configId: string): Promise<void> {
    await fetchApi(`/devices/${deviceId}/config-file/${configId}/confirm`, { method: 'POST' });
  },

  async updateProposedSchedule(deviceId: string, entries: { time: string; openDurationMs: number }[]): Promise<any> {
    return fetchApi(`/devices/${deviceId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ entries }),
    });
  },
};

export const chatbotApi = {
  async initChatbot(forceNewSession?: boolean): Promise<ChatbotInitResponse> {
    return fetchApi('/chatbot/init', {
      method: 'POST',
      body: JSON.stringify({ forceNewSession }),
    });
  },

  async sendChatbotMessage(messages: ChatbotMessage[], model?: string, clientMsgId?: string): Promise<ChatbotResponse> {
    return fetchApi('/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        model,
        clientMsgId,
      }),
    });
  },

  async getChatbotHistory(limit = 50): Promise<ChatbotHistoryResponse> {
    return fetchApi(`/chatbot/history?limit=${limit}`, {
      method: 'GET',
    });
  },
};
