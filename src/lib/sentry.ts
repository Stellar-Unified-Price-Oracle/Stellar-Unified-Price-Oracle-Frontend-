import * as Sentry from '@sentry/react';
import { scrubPersonalData } from './breadcrumbScrubber';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    beforeBreadcrumb(breadcrumb) {
      return scrubPersonalData(breadcrumb);
    },
  });
}
