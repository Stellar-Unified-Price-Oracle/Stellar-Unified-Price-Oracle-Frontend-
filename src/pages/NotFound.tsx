import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-800 mb-4">404</h1>
      <p className="text-lg text-gray-400 dark:text-gray-500 mb-8">Page not found</p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
