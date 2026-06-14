export interface User {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
}

export interface Device {
  deviceId: string;
  machineCode: string;
  displayName: string | null;
  firmwareVersion: string | null;
  online: boolean;
  lastSeenAt: string | null;
  activeConfigId: string | null;
  activeConfigVersion: number | null;
}

export interface DeviceStatus {
  deviceId: string;
  online: boolean;
  mode: string | null;
  isFeeding: boolean;
  doorOpen: boolean;
  wifiConnected: boolean;
  wifiRssi: number | null;
  ipAddress: string | null;
  serverConnected?: boolean;
  timeSynced?: boolean;
  heap: number | null;
  uptimeSec: number | null;
  activeConfigId: string | null;
  activeConfigVersion: number | null;
  lastSeenAt: string | null;
  lastTelemetryAt: string | null;
  updatedAt: string | null;
}

export interface MqttStatus {
  deviceId: string;
  mqttConnected: boolean;
  brokerUrl: string | null;
  lastConnectedAt: string | null;
}

export interface ScheduleEntry {
  id: number;
  time: string; // "HH:MM" format
  openDurationMs: number;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  mealId?: string | null;
  mealOrder?: number | null;
}

export interface Schedule {
  deviceId: string;
  version: number;
  enabled: boolean;
  timezone: string;
  timezoneOffsetSec: number;
  entries: ScheduleEntry[];
}

export interface FeedingHistory {
  id: number;
  deviceId: string;
  source: 'REMOTE' | 'SCHEDULE' | 'MANUAL' | 'TEST';
  requestId: string | null;
  openDurationMs: number;
  status: string; // "completed", "failed", "pending", etc.
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DashboardData {
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  feedingCount: number;
  recentDevices: Device[];
  recentFeedingHistories: FeedingHistory[];
}

export interface AuthResponse {
  ok: boolean;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: any;
  };
}

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  sessionId?: string;
  createdAt?: string;
  tool_calls?: ToolCall[];
}

export interface ChatbotInitResponse {
  ok: boolean;
  isNewSession: boolean;
  sessionId: string;
  greeting?: string;
}

export interface ChatbotResponse {
  ok: boolean;
  message: ChatbotMessage;
}

export interface ChatbotHistoryResponse {
  ok: boolean;
  history: ChatbotMessage[];
}
