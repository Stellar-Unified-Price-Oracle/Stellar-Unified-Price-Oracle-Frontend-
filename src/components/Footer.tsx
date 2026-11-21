import { useTranslation } from 'react-i18next';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
const GIT_SHA = import.meta.env.VITE_GIT_SHA ?? 'unknown';
const SHORT_SHA = GIT_SHA.slice(0, 7);

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <span className="footer__version" title={`${APP_VERSION} (${GIT_SHA})`}>
        {t('footer.version', { version: APP_VERSION, sha: SHORT_SHA })}
      </span>
    </footer>
  );
}
