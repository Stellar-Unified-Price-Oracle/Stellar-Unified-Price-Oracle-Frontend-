import type { LedgerAnchor } from '../lib/chainTip'
import type { StellarNetwork } from '../lib/stellarExplorer'
import { VerifiableLedgerLink } from './VerifiableLedgerLink'

/** Shows the ledger sequence a proof/read is anchored to, and flags reorgs (#854). */
export function LedgerAnchorBadge({
  anchor,
  network,
}: {
  anchor: LedgerAnchor | undefined
  network?: StellarNetwork
}) {
  if (!anchor) return null
  const reorged = anchor.status === 'reorged'
  return (
    <span
      data-testid="ledger-anchor"
      className={`inline-flex items-center gap-1.5 ${reorged ? 'text-red-400' : 'text-slate-400'}`}
      title={anchor.ledgerHash ? `Ledger hash ${anchor.ledgerHash}` : 'Ledger hash unavailable'}
    >
      <VerifiableLedgerLink
        claimType="ledger"
        identifier={anchor.sequence}
        network={network}
        label={`Ledger #${anchor.sequence}`}
        className={reorged ? 'text-red-400 hover:text-red-300' : 'text-cyan-400 hover:text-cyan-300'}
      />
      {reorged ? <span className="text-red-400 font-semibold">(reorged: re-verify)</span> : null}
    </span>
  )
}

