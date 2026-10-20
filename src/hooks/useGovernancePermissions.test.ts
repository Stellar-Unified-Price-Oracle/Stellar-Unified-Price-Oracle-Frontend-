import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernancePermissions } from './useGovernancePermissions'
import * as walletHook from '../wallet/WalletContext'
import { NETWORK_PASSPHRASES } from '../lib/networkRegistry'

vi.mock('../wallet/WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockedUseWallet = vi.mocked(walletHook.useWallet)

describe('useGovernancePermissions hook (#857)', () => {
  it('handles disconnected wallet state', () => {
    mockedUseWallet.mockReturnValue({
      status: 'disconnected',
      address: null,
      network: null,
      networkPassphrase: null,
      balance: null,
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    const { result } = renderHook(() => useGovernancePermissions('testnet'))
    expect(result.current.isWalletConnected).toBe(false)
    expect(result.current.currentRole).toBe('guest')
    expect(result.current.canPerform('proposal:vote')).toBe(false)
    expect(result.current.canPerform('proposal:create')).toBe(false)
  })

  it('evaluates connected voter on testnet correctly', () => {
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO', // voter
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      balance: '150',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    const { result } = renderHook(() => useGovernancePermissions('testnet'))
    expect(result.current.isWalletConnected).toBe(true)
    expect(result.current.currentRole).toBe('voter')
    expect(result.current.canPerform('proposal:vote')).toBe(true)
    expect(result.current.canPerform('proposal:create')).toBe(false)
    expect(result.current.canPerform('proposal:execute')).toBe(false)
  })

  it('evaluates connected admin on testnet correctly', () => {
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GAADMIN7777777777777777777777777777777777777777777777777', // admin
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      balance: '500',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    const { result } = renderHook(() => useGovernancePermissions('testnet'))
    expect(result.current.currentRole).toBe('admin')
    expect(result.current.canPerform('proposal:vote')).toBe(true)
    expect(result.current.canPerform('proposal:create')).toBe(true)
    expect(result.current.canPerform('proposal:execute')).toBe(true)
    expect(result.current.canPerform('parameter:update')).toBe(true)
  })

  it('allows simulating roles dynamically', () => {
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO', // voter
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      balance: '150',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    const { result } = renderHook(() => useGovernancePermissions('testnet'))
    expect(result.current.canPerform('proposal:execute')).toBe(false)

    act(() => {
      result.current.setSimulatedRole('admin')
    })

    expect(result.current.currentRole).toBe('admin')
    expect(result.current.canPerform('proposal:execute')).toBe(true)
  })
})
