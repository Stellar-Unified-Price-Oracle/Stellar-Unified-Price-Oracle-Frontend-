import type { NotificationConfig } from '../config/notificationConfig';

export type NotificationRule = {
  id: string;
  name: string;
  enabled: boolean;
  event: string;
  channels: string[];
  conditions?: Record<string, unknown>;
};

export const notificationConfig: NotificationConfig = {
  enabled: true,
  defaultChannels: ['in-app'],
  rules: [],
};

export default notificationConfig;
