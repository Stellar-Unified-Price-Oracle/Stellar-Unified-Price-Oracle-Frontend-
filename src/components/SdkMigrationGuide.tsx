import { SDK_MIGRATIONS, SUPPORTED_SDK_MAJORS, type SdkMajorMigration } from '../data/sdkMigrations'

/**
 * Migration examples for every supported SDK major (#809). Each major is a
 * native disclosure, so it works with the keyboard and screen readers without
 * extra state.
 */
export function SdkMigrationGuide() {
  return (
    <section aria-labelledby="sdk-migrations-heading" className="mt-10 border-t border-gray-800 pt-6">
      <h2 id="sdk-migrations-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
        SDK migration guide
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Supported majors: {SUPPORTED_SDK_MAJORS.map((major) => `v${major}`).join(', ')}. Each example shows the code
        being replaced and its replacement.
      </p>
      <div className="mt-4 space-y-3">
        {SDK_MIGRATIONS.map((migration) => (
          <MajorMigration key={migration.major} migration={migration} />
        ))}
      </div>
    </section>
  )
}

function MajorMigration({ migration }: { migration: SdkMajorMigration }) {
  return (
    <details className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-200">{migration.title}</summary>
      <p className="mt-3 text-sm text-gray-400">{migration.summary}</p>

      <h3 className="mt-4 text-sm font-semibold text-gray-200">Breaking changes</h3>
      <ul className="mt-2 list-disc ps-5 space-y-1 text-xs text-gray-400">
        {migration.breakingChanges.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>

      {migration.examples.map((example) => (
        <div key={example.label} className="mt-4">
          <h3 className="text-sm font-semibold text-gray-200">{example.label}</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs text-gray-400">Before</figcaption>
              <pre
                tabIndex={0}
                aria-label={`${example.label}: before`}
                className="p-3 rounded-lg bg-gray-950 text-gray-300 text-xs overflow-x-auto leading-relaxed"
              >
                {example.before}
              </pre>
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs text-gray-400">After</figcaption>
              <pre
                tabIndex={0}
                aria-label={`${example.label}: after`}
                className="p-3 rounded-lg bg-gray-950 text-gray-300 text-xs overflow-x-auto leading-relaxed"
              >
                {example.after}
              </pre>
            </figure>
          </div>
        </div>
      ))}
    </details>
  )
}
