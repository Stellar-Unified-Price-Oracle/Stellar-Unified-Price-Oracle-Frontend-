import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommandRegistryProvider, useCommands } from '../context/CommandRegistryContext'
import type { Command } from '../types/commands'
import { useDashboardCommands, type DashboardCommandOptions } from './useDashboardCommands'

function Probe({ options }: { options: DashboardCommandOptions }) {
  useDashboardCommands(options)
  const commands = useCommands()

  return (
    <div>
      <span data-testid="pair-count">{commands.filter((command) => command.category === 'pricePairs').length}</span>
      <span data-testid="total">{commands.length}</span>
      <ul>
        {commands.map((command: Command) => (
          <li key={command.id} data-testid={`cmd-${command.id}`} data-enabled={String(command.enabled !== false)}>
            {command.label}
            <span data-testid={`reason-${command.id}`}>{command.disabledReason ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function baseOptions(overrides: Partial<DashboardCommandOptions> = {}): DashboardCommandOptions {
  return {
    pairs: ['BTC/USD', 'ETH/USD'],
    hasExportData: true,
    exportAllowed: true,
    exportCooldownSec: 0,
    onExport: vi.fn(),
    onOpenColumnSelector: vi.fn(),
    onCreateAlert: vi.fn(),
    ...overrides,
  }
}

function renderDashboard(options: DashboardCommandOptions, path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CommandRegistryProvider>
        <Probe options={options} />
      </CommandRegistryProvider>
    </MemoryRouter>,
  )
}

describe('useDashboardCommands', () => {
  it('registers one price-pair command per pair', () => {
    renderDashboard(baseOptions())
    expect(screen.getByTestId('pair-count')).toHaveTextContent('2')
    expect(screen.getByTestId('cmd-pair:BTC/USD')).toBeInTheDocument()
    expect(screen.getByTestId('cmd-pair:ETH/USD')).toBeInTheDocument()
  })

  it('registers filter and sort commands', () => {
    renderDashboard(baseOptions())
    expect(screen.getByTestId('cmd-filters:clear')).toBeInTheDocument()
    expect(screen.getByTestId('cmd-filters:source:chainlink')).toBeInTheDocument()
    expect(screen.getByTestId('cmd-filters:sort:price-high')).toBeInTheDocument()
    expect(screen.getByTestId('cmd-filters:sort-direction')).toBeInTheDocument()
  })

  it('enables "clear filters" only when filters are active', () => {
    renderDashboard(baseOptions())
    expect(screen.getByTestId('cmd-filters:clear')).toHaveAttribute('data-enabled', 'false')
  })

  it('reflects active filters from the URL', () => {
    renderDashboard(baseOptions(), '/dashboard?sources=chainlink&sort=confidence&sortDir=asc')
    expect(screen.getByTestId('cmd-filters:clear')).toHaveAttribute('data-enabled', 'true')
    // Selecting the already-active source is a no-op, so it is disabled.
    expect(screen.getByTestId('cmd-filters:source:chainlink')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('cmd-filters:sort:confidence')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('cmd-filters:sort-direction')).toHaveAttribute('data-enabled', 'true')
  })

  it('registers export commands and disables them with a reason when there is no data', () => {
    renderDashboard(baseOptions({ hasExportData: false }))
    expect(screen.getByTestId('cmd-exports:csv')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('reason-exports:csv')).toHaveTextContent('No data to export')
  })

  it('disables exports while rate limited', () => {
    renderDashboard(baseOptions({ exportAllowed: false, exportCooldownSec: 12 }))
    expect(screen.getByTestId('cmd-exports:json')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('reason-exports:json')).toHaveTextContent('12')
  })

  it('enables exports when data is available and the rate limit allows', () => {
    renderDashboard(baseOptions())
    expect(screen.getByTestId('cmd-exports:csv')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('cmd-exports:json')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('cmd-exports:xlsx')).toHaveAttribute('data-enabled', 'true')
    expect(screen.getByTestId('cmd-exports:columns')).toHaveAttribute('data-enabled', 'true')
  })

  it('registers the create-alert command', () => {
    renderDashboard(baseOptions())
    expect(screen.getByTestId('cmd-alerts:create')).toBeInTheDocument()
  })

  it('scales to a large pair list', () => {
    const pairs = Array.from({ length: 2_500 }, (_, i) => `PAIR${i}/USD`)
    renderDashboard(baseOptions({ pairs }))
    expect(screen.getByTestId('pair-count')).toHaveTextContent('2500')
  })
})
