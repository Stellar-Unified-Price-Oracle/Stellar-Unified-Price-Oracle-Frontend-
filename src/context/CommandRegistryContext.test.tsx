import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Command } from '../types/commands'
import { CommandRegistryProvider, useCommands, useRegisterCommands } from './CommandRegistryContext'

function makeCommand(id: string, label: string): Command {
  return { id, label, category: 'navigation', handler: vi.fn() }
}

/** Registers commands without rendering them (models a feature component). */
function Registrar({ commands }: { commands: Command[] }) {
  useRegisterCommands(commands)
  return null
}

/** Renders the flat, deduplicated registry. */
function Consumer() {
  const commands = useCommands()
  return (
    <ul data-testid="commands">
      {commands.map((command) => (
        <li key={command.id}>{command.label}</li>
      ))}
    </ul>
  )
}

describe('CommandRegistryProvider', () => {
  it('exposes commands registered by descendants', () => {
    render(
      <CommandRegistryProvider>
        <Registrar commands={[makeCommand('a', 'Alpha'), makeCommand('b', 'Beta')]} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('deduplicates commands with the same id across owners', () => {
    render(
      <CommandRegistryProvider>
        <Registrar commands={[makeCommand('dup', 'First owner')]} />
        <Registrar commands={[makeCommand('dup', 'Second owner')]} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('replaces an owner’s commands when the array identity changes', () => {
    const { rerender } = render(
      <CommandRegistryProvider>
        <Registrar commands={[makeCommand('a', 'Alpha')]} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()

    rerender(
      <CommandRegistryProvider>
        <Registrar commands={[makeCommand('b', 'Beta')]} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('removes an owner’s commands on unmount', () => {
    const { unmount } = render(
      <CommandRegistryProvider>
        <Registrar commands={[makeCommand('a', 'Alpha')]} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()

    unmount()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('is inert outside the provider instead of throwing', () => {
    expect(() => render(<Consumer />)).not.toThrow()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('handles a large registration without dropping commands', () => {
    const commands = Array.from({ length: 3_000 }, (_, i) => makeCommand(`pair:${i}`, `PAIR/${i}`))
    render(
      <CommandRegistryProvider>
        <Registrar commands={commands} />
        <Consumer />
      </CommandRegistryProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3_000)
  })
})
