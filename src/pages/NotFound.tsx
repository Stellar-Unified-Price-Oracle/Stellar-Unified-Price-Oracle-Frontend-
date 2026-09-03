import { type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function NotFound(): ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800 mb-4">
        {t('notFound.heading')}
      </h1>
      <p className="text-lg text-gray-400 dark:text-gray-500 mb-8">
        {t('notFound.message')}
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors"
      >
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  )
}
