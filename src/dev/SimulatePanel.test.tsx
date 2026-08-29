import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { SimulatePanel } from './SimulatePanel'
import { applySimulation, getSimulationConfig, resetSimulation, startRecording } from './wsSimulator'
import type { WsPriceUpdate } from '../types'

function priceUpdate(): WsPriceUpdate {
  return {
    type: 'price_update',
    assetPair: 'BTC/USD',
    price: 100,
    timestamp: Date.now(),
    confidence: 0.9,
    sources: ['chainlink'],
  }
}

const injectSimulatedMessage = vi.fn()

vi.mock('../context/PriceContext', () => ({
  usePriceContext: () => ({ _injectSimulatedMessage: injectSimulatedMessage }),
}))

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  resetSimulation()
  injectSimulatedMessage.mockClear()
})

describe('SimulatePanel', () => {
  it('has no accessibility violations', async () => {
    await checkAccessibility(<SimulatePanel />)
  })

  it('renders the panel expanded by default', () => {
    render(<SimulatePanel />)
    expect(screen.getByRole('complementary', { name: 'WebSocket simulate panel' })).toBeInTheDocument()
  })

  it('collapses to a toggle button and reopens', async () => {
    const user = userEvent.setup()
    render(<SimulatePanel />)
    await user.click(screen.getByLabelText('Hide WS simulate panel'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    const reopen = screen.getByLabelText('Show WS simulate panel')
    expect(reopen).toBeInTheDocument()
    await user.click(reopen)
    expect(screen.getByRole('complementary', { name: 'WebSocket simulate panel' })).toBeInTheDocument()
  })

  it('toggles the enabled switch', async () => {
    const user = userEvent.setup()
    render(<SimulatePanel />)
    const checkbox = screen.getByLabelText('Enable WS simulation')
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(getSimulationConfig().enabled).toBe(true)
  })

  it('switches mode and reveals the matching control', async () => {
    const user = userEvent.setup()
    render(<SimulatePanel />)
    await user.click(screen.getByRole('radio', { name: 'drop' }))
    expect(getSimulationConfig().mode).toBe('drop')
    expect(screen.getByLabelText('Drop probability, 0 to 1')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'throttle' }))
    expect(getSimulationConfig().mode).toBe('throttle')
    expect(screen.getByLabelText('Throttle delay in milliseconds')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'flood' }))
    expect(getSimulationConfig().mode).toBe('flood')
    expect(screen.getByLabelText('Flood duplicate count')).toBeInTheDocument()
  })

  it('sets a source target effect', async () => {
    const user = userEvent.setup()
    render(<SimulatePanel />)
    await user.selectOptions(screen.getByLabelText('Simulated effect for chainlink'), 'downtime')
    expect(getSimulationConfig().sourceTargets).toContainEqual(
      expect.objectContaining({ source: 'chainlink', effect: 'downtime' }),
    )

    await user.selectOptions(screen.getByLabelText('Simulated effect for chainlink'), 'none')
    expect(getSimulationConfig().sourceTargets).toEqual([])
  })

  it('records, stops, and reports the captured frame count', async () => {
    const user = userEvent.setup()
    render(<SimulatePanel />)
    await user.click(screen.getByRole('button', { name: 'Record' }))
    expect(screen.getByRole('button', { name: '● Stop' })).toBeInTheDocument()
    // Capture one frame directly through the engine while recording is active.
    applySimulation(priceUpdate(), vi.fn())
    await user.click(screen.getByRole('button', { name: '● Stop' }))
    expect(screen.getByText('1 frame(s) captured')).toBeInTheDocument()
  })

  it('replaying the sample sequence injects messages via the live pipeline', () => {
    vi.useFakeTimers()
    render(<SimulatePanel />)

    fireEvent.click(screen.getByRole('button', { name: '▶ Replay sample' }))
    expect(screen.getByRole('button', { name: '■ Stop replay' })).toBeInTheDocument()

    vi.advanceTimersByTime(5000)
    expect(injectSimulatedMessage).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('the recorded-replay button is disabled with nothing recorded', () => {
    render(<SimulatePanel />)
    expect(screen.getByRole('button', { name: '▶ Replay recorded' })).toBeDisabled()
  })

  it('the recorded-replay button enables once a frame has been captured', () => {
    startRecording()
    applySimulation(priceUpdate(), vi.fn())
    render(<SimulatePanel />)
    expect(screen.getByRole('button', { name: '▶ Replay recorded' })).toBeEnabled()
  })

  it('reset all restores defaults and stops any in-flight replay', () => {
    vi.useFakeTimers()
    render(<SimulatePanel />)

    fireEvent.click(screen.getByLabelText('Enable WS simulation'))
    fireEvent.click(screen.getByRole('radio', { name: 'flood' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Replay sample' }))

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(getSimulationConfig().enabled).toBe(false)
    expect(getSimulationConfig().mode).toBe('off')
    expect(screen.queryByRole('button', { name: '■ Stop replay' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
