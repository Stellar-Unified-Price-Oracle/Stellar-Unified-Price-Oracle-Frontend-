import { networkFromPassphrase } from '../lib/networkRegistry'
import type { TxSummary } from './txReview'

/**
 * Shows the decoded payload and the network it targets before any signature (#631, #845).
 * An unrecognised passphrase is flagged so the user never signs blind to the network.
 *
 * For Soroban transactions, simulation results (CPU, memory, resource fee estimate)
 * are displayed before approval (issue #1013).
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
  const simulation = summary.simulation
  return (
    <div role="dialog" aria-modal="true" aria-label="Review transaction">
      <h2>Review transaction</h2>
      <p>Network: {network ?? 'Unknown network'}</p>
      {network === null && (
        <p role="alert">This transaction targets a network this app does not recognise. Do not sign it.</p>
      )}
      <p>Source: {summary.source}</p>
      <p>
        Fee estimate: {summary.feeXlm} XLM ({summary.feeStroops} stroops)
      </p>

      {simulation && (
        <section aria-label="Soroban simulation">
          <h3>Soroban resource simulation</h3>
          {simulation.error ? (
            <p role="status">Simulation unavailable: {simulation.error}</p>
          ) : (
            <>
              <p>
                CPU instructions:{' '}
                {simulation.cpuInstructions !== undefined ? simulation.cpuInstructions.toLocaleString() : 'n/a'}
              </p>
              <p>
                Memory:{' '}
                {simulation.memoryBytes !== undefined ? `${simulation.memoryBytes.toLocaleString()} bytes` : 'n/a'}
              </p>
              {simulation.minResourceFeeStroops !== undefined && (
                <p>
                  Resource fee estimate: {(simulation.minResourceFeeStroops / 1e7).toFixed(7)} XLM (
                  {simulation.minResourceFeeStroops} stroops)
                </p>
              )}
              {simulation.totalFeeStroops !== undefined && (
                <p>
                  Estimated total fee: {(simulation.totalFeeStroops / 1e7).toFixed(7)} XLM ({simulation.totalFeeStroops}{' '}
                  stroops)
                </p>
              )}
            </>
          )}
        </section>
      )}

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
