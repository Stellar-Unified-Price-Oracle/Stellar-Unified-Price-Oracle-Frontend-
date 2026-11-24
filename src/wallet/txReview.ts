/**
 * Transaction review (#631): decode the exact XDR that will be signed, enforce an
 * op allow-list and fee ceiling, and diff against the operation the UI intended.
 *
 * Soroban transactions are also simulated before signing so the review step can
 * show CPU, memory and resource fee estimates (issue #1013).
 */
import { Address, FeeBumpTransaction, TransactionBuilder, rpc, type Transaction } from '@stellar/stellar-sdk'
import { networkFromPassphrase, getNetworkConfig } from '../lib/networkRegistry'

export const ALLOWED_OP_TYPES = ['payment', 'invokeHostFunction'] as const
/** Default fee ceiling: 0.1 XLM in stroops. */
export const DEFAULT_MAX_FEE_STROOPS = 1_000_000

export interface DecodedOperation {
  type: string
  source?: string
  destination?: string
  asset?: string
  amount?: string
  contractId?: string
  functionName?: string
}

export interface SorobanSimulation {
  /** CPU instructions consumed by the simulated invocation, when reported. */
  cpuInstructions?: number
  /** Memory bytes consumed by the simulated invocation, when reported. */
  memoryBytes?: number
  /** Minimum resource fee (stroops) reported by simulation, when available. */
  minResourceFeeStroops?: number
  /** Total fee including resources (stroops) reported by simulation, when available. */
  totalFeeStroops?: number
  /** Human-readable error when simulation could not be completed. */
  error?: string
}

export interface TxSummary {
  source: string
  networkPassphrase: string
  feeStroops: number
  feeXlm: string
  operations: DecodedOperation[]
  /** Present for Soroban transactions after simulation (issue #1013). */
  simulation?: SorobanSimulation
}

/** What the UI believes it is submitting. Only provided fields are compared. */
export interface IntendedOperation {
  type: string
  destination?: string
  asset?: string
  amount?: string
  contractId?: string
  functionName?: string
}

export type ReviewCode = 'decode-failed' | 'disallowed-op' | 'intent-mismatch' | 'fee-unavailable' | 'fee-too-high'

export class TxReviewError extends Error {
  code: ReviewCode
  constructor(code: ReviewCode, message: string) {
    super(message)
    this.name = 'TxReviewError'
    this.code = code
  }
}

export interface ReviewOptions {
  intended?: IntendedOperation[]
  maxFeeStroops?: number
  allowedOps?: readonly string[]
}

function decodeOp(op: Record<string, unknown>): DecodedOperation {
  const out: DecodedOperation = { type: String(op.type), source: op.source as string | undefined }
  if (op.type === 'payment') {
    const a = op.asset as { isNative(): boolean; code: string; issuer: string }
    out.destination = op.destination as string
    out.amount = op.amount as string
    out.asset = a.isNative() ? 'XLM' : `${a.code}:${a.issuer}`
  } else if (op.type === 'invokeHostFunction') {
    try {
      const inv = (op.func as { invokeContract(): { contractAddress(): never; functionName(): { toString(): string } } }).invokeContract()
      out.contractId = Address.fromScAddress(inv.contractAddress()).toString()
      out.functionName = inv.functionName().toString()
    } catch {
      /* not an invokeContract host function; type alone is shown */
    }
  }
  return out
}

/** Decodes an XDR envelope into a human-readable summary. */
export function decodeTransaction(xdr: string, networkPassphrase: string): TxSummary {
  let tx: Transaction | FeeBumpTransaction
  try {
    tx = TransactionBuilder.fromXDR(xdr, networkPassphrase)
  } catch (e) {
    throw new TxReviewError('decode-failed', `Could not decode the transaction: ${e instanceof Error ? e.message : String(e)}`)
  }
  const inner = tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx
  const feeStroops = Number(tx.fee)
  return {
    source: inner.source,
    networkPassphrase,
    feeStroops,
    feeXlm: (feeStroops / 1e7).toFixed(7),
    operations: inner.operations.map((o) => decodeOp(o as unknown as Record<string, unknown>)),
  }
}

/** Throws a {@link TxReviewError} unless the summary passes allow-list, fee and intent checks. */
export function validateSummary(summary: TxSummary, opts: ReviewOptions = {}): void {
  const allowed = opts.allowedOps ?? ALLOWED_OP_TYPES
  const max = opts.maxFeeStroops ?? DEFAULT_MAX_FEE_STROOPS
  for (const op of summary.operations) {
    if (!allowed.includes(op.type)) {
      throw new TxReviewError('disallowed-op', `Refusing to sign: operation type "${op.type}" is not on the allow-list (${allowed.join(', ')}).`)
    }
  }
  if (!Number.isFinite(summary.feeStroops) || summary.feeStroops <= 0) {
    throw new TxReviewError('fee-unavailable', 'Refusing to sign: the transaction fee could not be estimated.')
  }
  if (summary.feeStroops > max) {
    throw new TxReviewError('fee-too-high', `Refusing to sign: fee ${summary.feeStroops} stroops exceeds the ceiling of ${max}.`)
  }
  if (opts.intended) {
    const ops = summary.operations
    if (ops.length !== opts.intended.length) {
      throw new TxReviewError('intent-mismatch', `Transaction has ${ops.length} operation(s) but the app intended ${opts.intended.length}.`)
    }
    opts.intended.forEach((want, i) => {
      for (const k of Object.keys(want) as (keyof IntendedOperation)[]) {
        if (want[k] !== undefined && want[k] !== ops[i][k]) {
          throw new TxReviewError('intent-mismatch', `Operation ${i + 1} differs from what the app intended: ${k} is "${String(ops[i][k])}", expected "${want[k]}".`)
        }
      }
    })
  }
}

/** Decode + validate in one step. */
export function reviewTransaction(xdr: string, networkPassphrase: string, opts: ReviewOptions = {}): TxSummary {
  const summary = decodeTransaction(xdr, networkPassphrase)
  validateSummary(summary, opts)
  return summary
}

export function isSorobanTransaction(summary: TxSummary): boolean {
  return summary.operations.some((op) => op.type === 'invokeHostFunction')
}

function rpcUrlForPassphrase(networkPassphrase: string): string | null {
  const network = networkFromPassphrase(networkPassphrase)
  if (!network) return null
  return getNetworkConfig(network).rpcUrls[0] ?? null
}

function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/**
 * Simulates a Soroban transaction to estimate CPU, memory and resource fees.
 * Called before every Soroban signature request (issue #1013).
 */
export async function simulateSorobanTransaction(
  xdr: string,
  networkPassphrase: string,
): Promise<SorobanSimulation> {
  const rpcUrl = rpcUrlForPassphrase(networkPassphrase)
  if (!rpcUrl) {
    return { error: 'No Soroban RPC endpoint configured for this network.' }
  }

  try {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase)
    const inner = tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx
    const server = new rpc.Server(rpcUrl)
    const sim = await server.simulateTransaction(inner)

    if (rpc.Api.isSimulationError(sim)) {
      return { error: sim.error ?? 'Simulation failed.' }
    }

    const success = sim as rpc.Api.SimulateTransactionSuccessResponse & {
      cost?: { cpuInsns?: string | number; memBytes?: string | number }
      minResourceFee?: string | number
      transactionData?: {
        resourceFee?: string | number | bigint
        resources?: { instructions?: number | bigint; readBytes?: number | bigint; writeBytes?: number | bigint }
      }
    }

    const cpuInstructions =
      parseOptionalInt(success.cost?.cpuInsns) ?? parseOptionalInt(success.transactionData?.resources?.instructions)
    const memoryBytes = parseOptionalInt(success.cost?.memBytes)
    const minResourceFeeStroops =
      parseOptionalInt(success.minResourceFee) ?? parseOptionalInt(success.transactionData?.resourceFee)
    const baseFee = parseOptionalInt(inner.fee)
    const totalFeeStroops =
      baseFee !== undefined && minResourceFeeStroops !== undefined ? baseFee + minResourceFeeStroops : baseFee

    return { cpuInstructions, memoryBytes, minResourceFeeStroops, totalFeeStroops }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Attaches Soroban simulation results to a transaction summary when applicable. */
export async function attachSorobanSimulation(summary: TxSummary, xdr: string): Promise<TxSummary> {
  if (!isSorobanTransaction(summary)) return summary
  const simulation = await simulateSorobanTransaction(xdr, summary.networkPassphrase)
  return { ...summary, simulation }
}
