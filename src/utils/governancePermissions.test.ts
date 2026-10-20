import { describe, it, expect } from 'vitest'
import {
  evaluateGovernanceActionPermission,
  resolveUserRole,
  GOVERNANCE_ROLE_LABELS,
  GOVERNANCE_ACTION_LABELS,
  ACTION_REQUIRED_ROLES,
  CANONICAL_ROLE_REGISTRY,
} from './governancePermissions'
import { NETWORK_PASSPHRASES } from '../lib/networkRegistry'

const TESTNET_PASSPHRASE = NETWORK_PASSPHRASES.testnet
const MAINNET_PASSPHRASE = NETWORK_PASSPHRASES.mainnet

describe('governancePermissions utils (#857)', () => {
  it('resolves correct roles from canonical addresses and defaults', () => {
    expect(resolveUserRole(null)).toBe('guest')
    expect(resolveUserRole('')).toBe('guest')
    expect(resolveUserRole('GAADMIN7777777777777777777777777777777777777777777777777')).toBe('admin')
    expect(resolveUserRole('GCHAI777777777777777777777777777777777777777777777777777')).toBe('operator')
    expect(resolveUserRole('GCPROP11111111111111111111111111111111111111111111111111')).toBe('proposer')
    expect(resolveUserRole('GDAUDIT9999999999999999999999999999999999999999999999999')).toBe('auditor')
    // Any generic unlisted connected address defaults to 'voter'
    expect(resolveUserRole('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO')).toBe('voter')
  })

  it('rejects action if wallet is disconnected', () => {
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:vote',
      { address: null, networkPassphrase: null, status: 'disconnected' },
      'testnet',
    )
    expect(evalResult.allowed).toBe(false)
    expect(evalResult.requiresWallet).toBe(true)
    expect(evalResult.requiresNetworkSwitch).toBe(false)
    expect(evalResult.requiresRoleUpgrade).toBe(false)
    expect(evalResult.currentRole).toBe('guest')
    expect(evalResult.reason).toContain('Wallet connection required')
  })

  it('rejects action if wallet is connected on the wrong network', () => {
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:vote',
      {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
        networkPassphrase: MAINNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
    )
    expect(evalResult.allowed).toBe(false)
    expect(evalResult.requiresWallet).toBe(false)
    expect(evalResult.requiresNetworkSwitch).toBe(true)
    expect(evalResult.requiresRoleUpgrade).toBe(false)
    expect(evalResult.reason).toContain('Network mismatch')
  })

  it('rejects action if role is insufficient even if network matches', () => {
    // Ordinary voter tries to execute proposal (requires admin)
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:execute',
      {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO', // voter
        networkPassphrase: TESTNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
    )
    expect(evalResult.allowed).toBe(false)
    expect(evalResult.requiresWallet).toBe(false)
    expect(evalResult.requiresNetworkSwitch).toBe(false)
    expect(evalResult.requiresRoleUpgrade).toBe(true)
    expect(evalResult.currentRole).toBe('voter')
    expect(evalResult.reason).toContain('Role restriction')
  })

  it('permits proposal:vote for voters on correct network', () => {
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:vote',
      {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO', // voter
        networkPassphrase: TESTNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
    )
    expect(evalResult.allowed).toBe(true)
    expect(evalResult.reason).toBeNull()
    expect(evalResult.currentRole).toBe('voter')
  })

  it('permits proposal:execute for admin on correct network', () => {
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:execute',
      {
        address: 'GAADMIN7777777777777777777777777777777777777777777777777', // admin
        networkPassphrase: TESTNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
    )
    expect(evalResult.allowed).toBe(true)
    expect(evalResult.reason).toBeNull()
    expect(evalResult.currentRole).toBe('admin')
  })

  it('permits parameter:update for operator on correct network', () => {
    const evalResult = evaluateGovernanceActionPermission(
      'parameter:update',
      {
        address: 'GCHAI777777777777777777777777777777777777777777777777777', // operator
        networkPassphrase: TESTNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
    )
    expect(evalResult.allowed).toBe(true)
    expect(evalResult.reason).toBeNull()
  })

  it('respects simulated role override', () => {
    // Connected address is normally voter, but simulated as admin
    const evalResult = evaluateGovernanceActionPermission(
      'proposal:execute',
      {
        address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
        networkPassphrase: TESTNET_PASSPHRASE,
        status: 'connected',
      },
      'testnet',
      { simulatedRole: 'admin' },
    )
    expect(evalResult.allowed).toBe(true)
    expect(evalResult.currentRole).toBe('admin')
  })
})
