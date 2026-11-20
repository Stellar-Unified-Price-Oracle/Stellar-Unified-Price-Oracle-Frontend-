export type NotificationChannel = 'email' | 'push' | 'in_app' | 'sms';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationRule {
  id: string;
  name: string;
  event: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  enabled: boolean;
  template?: string;
  conditions?: Record<string, unknown>;
}

export interface NotificationConfig {
  enabled: boolean;
  defaultChannels: NotificationChannel[];
  rules: NotificationRule[];
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export const notificationConfig: NotificationConfig = {
  enabled: true,
  defaultChannels: ['in_app', 'email'],
  rules: [],
};

export default notificationConfig;
