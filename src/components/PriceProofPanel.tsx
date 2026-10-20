import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePriceProof } from '../hooks/usePriceProof'
import { useToast } from '../context/ToastContext'
import { formatPrice, formatTimestamp, timeAgo } from '../utils/format'
import { SOURCE_COLORS, getConfidenceColor } from '../utils/sourceColors'
import { explorerTxUrl, explorerContractUrl, networkLabel } from '../lib/stellarExplorer'
import { shortenAccount } from '../lib/stellarAssets'
import { VerifiableLedgerLink } from './VerifiableLedgerLink'

export interface PriceProofPanelProps {
  /** Asset pair to fetch the on-chain proof for, e.g. "XLM/USD". */
  pair: string
  /** Timestamp of the current/latest price shown elsewhere on the page. */
  latestTimestamp: number
  /** Timestamps of historical records the user can pick to verify, most recent first. */
  historyTimestamps?: number[]
}

export interface PriceProofVerificationBundle {
  proof: PriceProof
  verification: {
    version: string
    description: string
    exportedAt: string
    contractId: string
    network: string
    ledgerSequence: number
    transactionHash: string
    cliCommand: string
    verificationSteps: Array<{ step: number; title: string; detail: string }>
  }
}

export function buildProofVerificationBundle(proof: PriceProof): PriceProofVerificationBundle {
  const cliCommand = `soroban contract invoke --id ${proof.contractId} --network ${proof.network} -- get_proof --asset_pair ${proof.record.assetPair} --at_timestamp ${proof.record.timestamp}`
  return {
    proof,
    verification: {
      version: '1.0.0',
      description: 'Independent verification bundle for Stellar Unified Price Oracle on-chain proof',
      exportedAt: new Date().toISOString(),
      contractId: proof.contractId,
      network: proof.network,
      ledgerSequence: proof.ledgerSequence,
      transactionHash: proof.transactionHash,
      cliCommand,
      verificationSteps: [
        {
          step: 1,
          title: 'Verify Ledger Finality & Transaction',
          detail: `Inspect transaction ${proof.transactionHash} anchored at ledger #${proof.ledgerSequence} via Stellar Horizon/RPC or Stellar Expert.`,
        },
        {
          step: 2,
          title: 'Verify On-Chain Soroban Contract State',
          detail: `Query the contract directly via the Soroban CLI using: ${cliCommand}`,
        },
        {
          step: 3,
          title: 'Verify Ed25519 Cryptographic Signatures',
          detail:
            'Validate aggregate signature and each source contribution signature against the reported public keys using standard Ed25519 verification.',
        },
        {
          step: 4,
          title: 'Verify Aggregation & Confidence Bounds',
          detail: `Confirm the record price $${formatPrice(proof.record.price)} matches the consensus algorithm across the ${proof.contributions.length} source contributions.`,
        },
      ],
    },
  }
}

export function triggerProofDownload(filename: string, content: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'application/json' })
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

function CopyButton({ value, label, ariaLabel }: { value: string; label: string; ariaLabel: string }) {
  const { t } = useTranslation()
  const { addToast } = useToast()

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => addToast({ type: 'success', message: t('priceDetail.proof.copied') }),
          () => addToast({ type: 'error', message: t('priceDetail.proof.copyFailed') }),
        )
      }}
      aria-label={ariaLabel}
      className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors shrink-0"
    >
      {label}
    </button>
  )
}

/**
 * "Proof" tab content for PriceDetail: renders the on-chain aggregate
 * commitment/signature, per-source signed contributions, and explorer links
 * for a published price record — with support for verifying a historical
 * record, not just the latest tick.
 *
 * Gracefully handles the case where no on-chain proof exists for this pair
 * (see {@link usePriceProof}) instead of showing an error.
 */
export function PriceProofPanel({ pair, latestTimestamp, historyTimestamps = [] }: PriceProofPanelProps) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const { proof, loading, error, refetch } = usePriceProof(pair, selectedTimestamp ?? undefined)

  const recordOptions = [latestTimestamp, ...historyTimestamps.filter((ts) => ts !== latestTimestamp)]

  const handleDownloadProof = () => {
    if (!proof) return
    try {
      const bundle = buildProofVerificationBundle(proof)
      const cleanPair = proof.record.assetPair.replace(/[/\\?%*:|"<>]/g, '-')
      const filename = `${cleanPair}-proof-${proof.record.timestamp}.json`
      triggerProofDownload(filename, JSON.stringify(bundle, null, 2))
      addToast({ type: 'success', message: t('priceDetail.proof.downloadSuccess') })
    } catch {
      addToast({ type: 'error', message: t('priceDetail.proof.downloadError') })
    }
  }

  const cliQueryCommand = proof
    ? `soroban contract invoke --id ${proof.contractId} --network ${proof.network} -- get_proof --asset_pair ${proof.record.assetPair} --at_timestamp ${proof.record.timestamp}`
    : ''

  return (
    <div>
      {recordOptions.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="proof-record-select" className="text-xs text-gray-500 uppercase tracking-wider">
            {t('priceDetail.proof.historicalSelectorLabel')}
          </label>
          <select
            id="proof-record-select"
            value={selectedTimestamp ?? latestTimestamp}
            onChange={(e) => {
              const value = Number(e.target.value)
              setSelectedTimestamp(value === latestTimestamp ? null : value)
            }}
            className="text-sm bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200"
          >
            {recordOptions.map((ts) => (
              <option key={ts} value={ts}>
                {ts === latestTimestamp ? t('priceDetail.proof.latestOption') : formatTimestamp(ts)}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div
          className="h-40 rounded-lg bg-gray-800/60 animate-pulse"
          role="status"
          aria-label={t('priceDetail.proof.loadingLabel')}
        />
      ) : error ? (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
          <p className="mb-2">{t('priceDetail.proof.error', { message: error.message })}</p>
          <button
            type="button"
            onClick={refetch}
            className="text-xs px-3 py-1 rounded border border-red-700 hover:bg-red-900/40 transition-colors"
          >
            {t('priceDetail.proof.retry')}
          </button>
        </div>
      ) : proof === null ? (
        <div className="p-6 border border-gray-800 bg-gray-900/70 rounded-xl text-center" role="status">
          <h3 className="text-base font-semibold text-gray-100 mb-2">{t('priceDetail.proof.unsupported.title')}</h3>
          <p className="text-sm text-gray-400">{t('priceDetail.proof.unsupported.detail')}</p>
        </div>
      ) : proof ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {t('priceDetail.proof.aggregateSection')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadProof}
                  aria-label={t('priceDetail.proof.downloadProof')}
                  className="text-xs px-2.5 py-0.5 rounded border border-cyan-800/80 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 hover:text-cyan-200 transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('priceDetail.proof.downloadProof')}
                </button>
                <CopyButton
                  value={JSON.stringify(proof, null, 2)}
                  label={t('priceDetail.proof.copy')}
                  ariaLabel={t('priceDetail.proof.copyProofPayload')}
                />
              </div>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 shrink-0">{t('priceDetail.proof.aggregateSignature')}</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-gray-300 truncate" title={proof.aggregateSignature}>
                    {shortenAccount(proof.aggregateSignature)}
                  </span>
                  <CopyButton
                    value={proof.aggregateSignature}
                    label={t('priceDetail.proof.copy')}
                    ariaLabel={`${t('priceDetail.proof.copy')} ${t('priceDetail.proof.aggregateSignature')}`}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 shrink-0">{t('priceDetail.proof.contractId')}</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-gray-300 truncate" title={proof.contractId}>
                    {shortenAccount(proof.contractId)}
                  </span>
                  <a
                    href={explorerContractUrl(proof.network, proof.contractId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline shrink-0"
                  >
                    {t('priceDetail.proof.viewOnExplorer')}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 shrink-0">{t('priceDetail.proof.transaction')}</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-gray-300 truncate" title={proof.transactionHash}>
                    {shortenAccount(proof.transactionHash)}
                  </span>
                  <a
                    href={explorerTxUrl(proof.network, proof.transactionHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline shrink-0"
                  >
                    {t('priceDetail.proof.viewOnExplorer')}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-gray-600 pt-1">
                <VerifiableLedgerLink
                  claimType="ledger"
                  identifier={proof.ledgerSequence}
                  network={proof.network}
                  label={t('priceDetail.proof.ledger', { sequence: proof.ledgerSequence })}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                />
                <span className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                  {networkLabel(proof.network)}
                </span>
              </div>
            </dl>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('priceDetail.proof.contributionsSection')}
            </p>
            <p className="text-xs text-gray-600 mb-3">
              {t('priceDetail.proof.contributionsCount', { count: proof.contributions.length })}
            </p>
            <ul className="space-y-2">
              {proof.contributions.map((c) => (
                <li
                  key={`${c.source}-${c.timestamp}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-800 bg-gray-950/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${SOURCE_COLORS[c.source] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}
                    >
                      {c.source}
                    </span>
                    <span className="font-mono text-sm text-gray-200">${formatPrice(c.price)}</span>
                    <span className="text-xs text-gray-600 hidden sm:inline">{timeAgo(c.timestamp)}</span>
                  </div>
                  <CopyButton
                    value={c.signature}
                    label={t('priceDetail.proof.copy')}
                    ariaLabel={`${t('priceDetail.proof.copy')} ${c.source} signature`}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Independent Verification Guide */}
          <section
            aria-labelledby="proof-verification-heading"
            className="border border-gray-800 bg-gray-900/40 rounded-xl p-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 id="proof-verification-heading" className="text-sm font-semibold text-gray-200">
                  {t('priceDetail.proof.guideTitle')}
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('priceDetail.proof.guideDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                aria-expanded={showGuide}
                aria-controls="independent-verification-guide"
                className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
              >
                {showGuide ? t('priceDetail.proof.guideToggleHide') : t('priceDetail.proof.guideToggleShow')}
              </button>
            </div>

            {showGuide && (
              <div id="independent-verification-guide" className="mt-4 space-y-4 text-xs border-t border-gray-800 pt-3">
                <div className="space-y-1">
                  <h5 className="font-semibold text-gray-300">{t('priceDetail.proof.step1Title')}</h5>
                  <p className="text-gray-400 leading-relaxed">{t('priceDetail.proof.step1Detail')}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-gray-500 font-mono">Tx: {shortenAccount(proof.transactionHash)}</span>
                    <a
                      href={explorerTxUrl(proof.network, proof.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline"
                    >
                      {t('priceDetail.proof.viewOnExplorer')}
                    </a>
                  </div>
                </div>

                <div className="space-y-1">
                  <h5 className="font-semibold text-gray-300">{t('priceDetail.proof.step2Title')}</h5>
                  <p className="text-gray-400 leading-relaxed">{t('priceDetail.proof.step2Detail')}</p>
                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <code className="text-cyan-300 font-mono text-xs overflow-x-auto whitespace-pre">
                      {cliQueryCommand}
                    </code>
                    <CopyButton
                      value={cliQueryCommand}
                      label={t('priceDetail.proof.copy')}
                      ariaLabel={t('priceDetail.proof.copyCliCommand')}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <h5 className="font-semibold text-gray-300">{t('priceDetail.proof.step3Title')}</h5>
                  <p className="text-gray-400 leading-relaxed">{t('priceDetail.proof.step3Detail')}</p>
                </div>

                <div className="space-y-1">
                  <h5 className="font-semibold text-gray-300">{t('priceDetail.proof.step4Title')}</h5>
                  <p className="text-gray-400 leading-relaxed">{t('priceDetail.proof.step4Detail')}</p>
                </div>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className={`px-2 py-0.5 rounded border ${getConfidenceColor(proof.record.confidence)}`}>
              {(proof.record.confidence * 100).toFixed(1)}%
            </span>
            <span>{formatTimestamp(proof.record.timestamp)}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
