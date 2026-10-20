/**
 * Browser (web push) notification delivery for price alerts (#829).
 *
 * Permission is read at send time rather than cached, so a permission that was
 * revoked after the user enabled the channel is reported as a failed delivery
 * instead of being silently dropped. Failures return a readable reason; the
 * alert still reaches the user in-app, and the delivery receipt records why the
 * browser channel did not fire.
 */
import type { DeliverySendResult } from './deliveryReceipts'

export type WebPushFailureReason = 'unsupported' | 'permissionDenied' | 'permissionRequired' | 'constructionFailed'

export const WEB_PUSH_FAILURE_MESSAGES: Record<WebPushFailureReason, string> = {
  unsupported: 'Browser notifications are not supported in this browser. Alerts still appear in-app.',
  permissionDenied: 'Browser notifications are blocked. Re-enable them in site settings; alerts still appear in-app.',
  permissionRequired: 'Browser notification permission has not been granted. Alerts still appear in-app.',
  constructionFailed: 'The browser refused to show the notification. Alerts still appear in-app.',
}

export interface WebPushEnvironment {
  notificationSupported: boolean
  permission: NotificationPermission | null
  show: (title: string, options: { body: string }) => void
}

export function browserWebPushEnvironment(): WebPushEnvironment {
  const supported = typeof Notification !== 'undefined'
  return {
    notificationSupported: supported,
    permission: supported ? Notification.permission : null,
    show: (title, options) => {
      new Notification(title, options)
    },
  }
}

function failure(reason: WebPushFailureReason): DeliverySendResult {
  return { ok: false, error: WEB_PUSH_FAILURE_MESSAGES[reason] }
}

/** Shows one browser notification and reports whether the browser accepted it. */
export function sendWebPush(
  title: string,
  body: string,
  env: WebPushEnvironment = browserWebPushEnvironment(),
): DeliverySendResult {
  if (!env.notificationSupported) return failure('unsupported')
  if (env.permission === 'denied') return failure('permissionDenied')
  if (env.permission !== 'granted') return failure('permissionRequired')
  try {
    env.show(title, { body })
    return { ok: true }
  } catch {
    return failure('constructionFailed')
  }
}
