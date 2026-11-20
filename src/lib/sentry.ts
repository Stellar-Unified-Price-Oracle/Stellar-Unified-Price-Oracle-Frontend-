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
    release: __APP_VERSION__,
    initialScope: {
      tags: {
        version: __APP_VERSION__,
        sha: __GIT_SHA__,
      },
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubPersonalData(breadcrumb);
    },
  });
}
