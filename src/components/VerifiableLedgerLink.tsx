/**
 * @file VerifiableLedgerLink (#854)
 *
 * Secure, accessible hyperlink linking on-chain integrity claims
 * (ledger sequences, contract IDs, transaction hashes, and account addresses)
 * directly to verifiable records on the Stellar block explorer (stellar.expert).
 *
 * Features:
 * - Network-aware (testnet vs mainnet).
 * - Safe external link attributes (`rel="noopener noreferrer"`, `target="_blank"`).
 * - Handles missing/unanchored claims explicitly without dead links.
 * - Accessible with screen-reader context.
 */
import { memo, type ReactElement } from 'react'
import { config } from '../config'
import {
  explorerClaimUrl,
  isValidClaimIdentifier,
  type OnChainClaimType,
  type StellarNetwork,
} from '../lib/stellarExplorer'

export interface VerifiableLedgerLinkProps {
  /** The type of on-chain claim being linked. */
  claimType: OnChainClaimType
  /** The raw identifier: ledger sequence, contract C..., tx hash, or account G... */
  identifier: string | number | null | undefined
  /** Stellar network: 'testnet' | 'mainnet'. Defaults to configured network. */
  network?: StellarNetwork
  /** Custom label for display. If omitted, default formatted label is used. */
  label?: string
  /** Whether to render an external link icon. */
  showIcon?: boolean
  /** Additional CSS classes. */
  className?: string
  /** Tooltip or title text. */
  title?: string
  /** Fallback text when claim is not available. */
  fallbackText?: string
}

function truncateMiddle(str: string, keepStart = 6, keepEnd = 4): string {
  if (str.length <= keepStart + keepEnd + 2) return str
  return `${str.slice(0, keepStart)}…${str.slice(-keepEnd)}`
}

export const VerifiableLedgerLink = memo(function VerifiableLedgerLink({
  claimType,
  identifier,
  network,
  label,
  showIcon = true,
  className = '',
  title,
  fallbackText = 'Unavailable',
}: VerifiableLedgerLinkProps): ReactElement {
  const activeNetwork: StellarNetwork =
    network ??
    (config.stellarNetwork === 'mainnet' ? 'mainnet' : 'testnet')

  if (
    identifier === null ||
    identifier === undefined ||
    !isValidClaimIdentifier(claimType, identifier)
  ) {
    return (
      <span className={`text-gray-500 italic ${className}`} title="On-chain record unavailable">
        {label || fallbackText}
      </span>
    )
  }

  const url = explorerClaimUrl(activeNetwork, claimType, identifier)

  // Default label generation if none provided
  let displayLabel = label
  if (!displayLabel) {
    if (claimType === 'ledger') {
      displayLabel = `Ledger #${Number(identifier).toLocaleString()}`
    } else if (claimType === 'contract' || claimType === 'account') {
      displayLabel = truncateMiddle(String(identifier))
    } else if (claimType === 'tx') {
      displayLabel = truncateMiddle(String(identifier), 8, 6)
    } else {
      displayLabel = String(identifier)
    }
  }

  const defaultTitle =
    title ??
    `Verify ${claimType} ${identifier} on ${activeNetwork === 'mainnet' ? 'Stellar Public Network' : 'Stellar Testnet'}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={defaultTitle}
      className={[
        'inline-flex items-center gap-1 font-mono underline underline-offset-2 transition-colors',
        'text-cyan-400 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded-sm',
        className,
      ].join(' ')}
    >
      <span>{displayLabel}</span>
      {showIcon && (
        <svg
          className="w-3 h-3 text-cyan-400/80 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M6 3h7v7M13 3L6.5 9.5" />
        </svg>
      )}
      <span className="sr-only"> (verifiable on-chain record on stellar.expert, opens in new tab)</span>
    </a>
  )
})
