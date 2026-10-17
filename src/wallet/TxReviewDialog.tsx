import { networkFromPassphrase } from '../lib/networkRegistry'
import type { OracleNetwork } from '../lib/contractRegistry'
import type { TxSummary } from './txReview'

const NETWORK_LABEL: Record<OracleNetwork, string> = {
  mainnet: 'Mainnet (public)',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
}

/**
 * Shows the decoded payload before any signature (#631). The network is shown
 * first with its passphrase, so the user can see which chain they are signing for (#845).
 */
export function TxReviewDialog({
  summary,
  onApprove,
  onReject,
}: {
  summary: TxSummary
  onApprove: () => void
  onReject: () => void
}) {
  const network = networkFromPassphrase(summary.networkPassphrase)
  return (
    <div role="dialog" aria-modal="true" aria-label="Review transaction">
      <h2>Review transaction</h2>
      <p>
        Network: <strong>{network ? NETWORK_LABEL[network] : 'Unrecognised network'}</strong>
      </p>
      <p>
        Network passphrase: <code>{summary.networkPassphrase}</code>
      </p>
      {!network && (
        <p role="alert">
          This transaction targets a network this app does not recognise. Do not sign it unless you expect that network.
        </p>
      )}
      <p>Source: {summary.source}</p>
      <p>Operations: {summary.operations.length}</p>
      <p>
        Fee estimate: {summary.feeXlm} XLM ({summary.feeStroops} stroops)
      </p>
      <ol>
        {summary.operations.map((op, i) => (
          <li key={i}>
            <strong>{op.type}</strong>
            {op.destination && <div>Destination: {op.destination}</div>}
            {op.amount && (
              <div>
                Amount: {op.amount} {op.asset}
              </div>
            )}
            {op.contractId && <div>Contract: {op.contractId}</div>}
            {op.functionName && <div>Function: {op.functionName}</div>}
          </li>
        ))}
      </ol>
      <button type="button" onClick={onReject}>
        Reject
      </button>
      <button type="button" onClick={onApprove}>
        Sign
      </button>
    </div>
  )
}
