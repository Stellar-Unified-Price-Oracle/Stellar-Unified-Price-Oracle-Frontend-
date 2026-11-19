// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'
import { decodeTransaction, reviewTransaction, TxReviewError } from './txReview'

const kp = Keypair.random()
const dest = Keypair.random().publicKey()

function build(ops: Parameters<TransactionBuilder['addOperation']>[0][], fee = '100') {
  const b = new TransactionBuilder(new Account(kp.publicKey(), '1'), { fee, networkPassphrase: Networks.TESTNET })
  ops.forEach((o) => b.addOperation(o))
  return b.setTimeout(30).build().toXDR()
}
const pay = Operation.payment({ destination: dest, asset: Asset.native(), amount: '5' })

describe('txReview', () => {
  it('decodes payment ops and fee', () => {
    const s = decodeTransaction(build([pay]), Networks.TESTNET)
    expect(s.operations[0]).toMatchObject({ type: 'payment', destination: dest, amount: '5.0000000', asset: 'XLM' })
    expect(s.feeStroops).toBe(100)
  })
  it('blocks a planted disallowed op', () => {
    const xdr = build([Operation.accountMerge({ destination: dest })])
    expect(() => reviewTransaction(xdr, Networks.TESTNET)).toThrowError(/allow-list/)
  })
  it('blocks intent mismatch', () => {
    expect(() => reviewTransaction(build([pay]), Networks.TESTNET, { intended: [{ type: 'payment', destination: Keypair.random().publicKey() }] })).toThrow(TxReviewError)
  })
  it('accepts matching intent', () => {
    expect(() => reviewTransaction(build([pay]), Networks.TESTNET, { intended: [{ type: 'payment', destination: dest, amount: '5.0000000' }] })).not.toThrow()
  })
  it('enforces fee ceiling and decode failure', () => {
    expect(() => reviewTransaction(build([pay], '5000000'), Networks.TESTNET)).toThrowError(/ceiling/)
    expect(() => reviewTransaction('garbage', Networks.TESTNET)).toThrowError(/decode/i)
  })
})
