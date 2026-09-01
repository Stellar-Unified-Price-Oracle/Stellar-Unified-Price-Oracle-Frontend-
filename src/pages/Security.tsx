import { type ReactElement } from 'react'

/**
 * Vulnerability disclosure policy page — the human-readable counterpart to
 * `/.well-known/security.txt` (#500). Keep the SLA figures here in sync with
 * the "Reporting a Vulnerability" section of SECURITY.md.
 */

const SCOPE_IN = [
  'This deployed frontend (all routes under this origin)',
  'Authentication and session handling for the developer portal',
  'Webhook signing, delivery, and secret rotation',
  'Client-side handling of API keys, tokens, and wallet connections',
]

const SCOPE_OUT = [
  'Denial-of-service or load/spam testing against production',
  'Social engineering of maintainers, contributors, or users',
  'Automated scanning that degrades service for other users',
  'Third-party services this app links to but does not operate',
]

const SLA = [
  { label: 'Acknowledgement', value: 'Within 72 hours of report' },
  { label: 'Triage & severity assignment', value: 'Within 5 business days' },
  { label: 'Critical / High remediation', value: '24 hours – 7 days (see SECURITY.md)' },
  { label: 'Moderate / Low remediation', value: '2 weeks – 90 days (see SECURITY.md)' },
  { label: 'Public disclosure', value: 'Coordinated with the reporter after a fix ships' },
]

function Section({ title, children }: { title: string; children: ReactElement }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  )
}

export function Security(): ReactElement {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Security &amp; Vulnerability Disclosure</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        We take the security of the Stellar Unified Price Oracle seriously and welcome reports from
        researchers. This page is the canonical disclosure policy referenced by{' '}
        <a
          href="/.well-known/security.txt"
          className="text-cyan-600 dark:text-cyan-400 underline underline-offset-2"
        >
          /.well-known/security.txt
        </a>{' '}
        and <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">SECURITY.md</code>.
      </p>

      <Section title="How to report">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p>
            <strong>Do not open a public GitHub issue.</strong> Report privately using either channel:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              GitHub private vulnerability reporting —{' '}
              <a
                href="https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/security/advisories/new"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-600 dark:text-cyan-400 underline underline-offset-2"
              >
                Report a vulnerability
              </a>
            </li>
            <li>Email the maintainers listed in `package.json`, or open a blank private advisory if none is listed.</li>
          </ul>
          <p>Include: affected URL/component, reproduction steps, impact, and any proof-of-concept.</p>
        </div>
      </Section>

      <Section title="Scope">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">In scope</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              {SCOPE_IN.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Out of scope</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
              {SCOPE_OUT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Response SLA">
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <tbody>
              {SLA.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Rewards">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This project does not currently run a paid bug bounty. Valid reports are credited (with
          permission) in the GitHub Security Advisory and release notes.
        </p>
      </Section>
    </div>
  )
}
