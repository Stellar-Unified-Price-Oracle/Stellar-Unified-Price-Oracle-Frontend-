import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommandRegistryProvider, useRegisterCommands } from '../context/CommandRegistryContext'
import { CommandPaletteProvider } from '../context/CommandPaletteContext'
import { ToastProvider } from '../context/ToastContext'
import { idbCache } from '../hooks/useIndexedDB'
import type { Command } from '../types/commands'
import { CommandPalette } from './CommandPalette'

afterEach(() => {
  cleanup()
  idbCache._reset()
})

beforeEach(() => {
  idbCache._reset()
  idbCache._disableSyncQueue()
})

/** Registers the given commands into the registry for the lifetime of the test. */
function Registrar({ commands }: { commands: Command[] }) {
  useRegisterCommands(commands)
  return null
}

function makeCommands(): Command[] {
  return [
    {
      id: 'nav:dashboard',
      label: 'Go to Dashboard',
      category: 'navigation',
      hint: '/dashboard',
      handler: vi.fn(),
    },
    { id: 'nav:api', label: 'Go to API Docs', category: 'navigation', handler: vi.fn() },
    { id: 'theme:dark', label: 'Switch to dark theme', category: 'theme', handler: vi.fn() },
    { id: 'view:mine', label: 'My Custom View', category: 'savedViews', handler: vi.fn() },
  ]
}

function renderPalette(commands: Command[], options: { isOpen?: boolean; onClose?: () => void } = {}) {
  const onClose = options.onClose ?? vi.fn()
  const utils = render(
    <MemoryRouter>
      <CommandRegistryProvider>
        <Registrar commands={commands} />
        <CommandPalette isOpen={options.isOpen ?? true} onClose={onClose} />
      </CommandRegistryProvider>
    </MemoryRouter>,
  )
  return { ...utils, onClose }
}

/**
 * Highlighting wraps matched characters in `<mark>`, which splits a word across
 * elements; the accessible-name computation then inserts spaces ("D ashboard").
 * Compare ignoring whitespace so tests assert on the label, not its markup.
 */
function nameIncludes(needle: string) {
  return (content: string) => content.replace(/\s+/g, '').toLowerCase().includes(needle)
}

describe('CommandPalette', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = renderPalette(makeCommands(), { isOpen: false })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders a combobox and a listbox when open', () => {
    renderPalette(makeCommands())
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('lists registered commands grouped by category', () => {
    renderPalette(makeCommands())
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Switch to dark theme')).toBeInTheDocument()
    // Category headers come from i18n.
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderPalette(makeCommands())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const { onClose } = renderPalette(makeCommands())
    fireEvent.click(screen.getByTestId('palette-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fuzzy-filters commands as the user types', async () => {
    const user = userEvent.setup()
    renderPalette(makeCommands())
    await user.type(screen.getByRole('combobox'), 'dark')

    expect(await screen.findByRole('option', { name: nameIncludes('switchtodarktheme') })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: nameIncludes('gotodashboard') })).not.toBeInTheDocument()
  })

  it('matches abbreviations (gtd → Go to Dashboard)', async () => {
    const user = userEvent.setup()
    renderPalette(makeCommands())
    await user.type(screen.getByRole('combobox'), 'gtd')

    expect(await screen.findByRole('option', { name: nameIncludes('gotodashboard') })).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    renderPalette(makeCommands())
    await user.type(screen.getByRole('combobox'), 'zzzzzz')

    // Rendered both visibly and in the screen-reader live region.
    const messages = await screen.findAllByText(/no commands match/i)
    expect(messages.length).toBeGreaterThan(0)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('moves the active option with the arrow keys and runs it on Enter', async () => {
    const user = userEvent.setup()
    const commands = makeCommands()
    const { onClose } = renderPalette(commands)

    await user.keyboard('{ArrowDown}{Enter}')

    // Second command in the flattened, category-ordered list is "Go to API Docs".
    expect(commands[1].handler).toHaveBeenCalledTimes(1)
    expect(commands[0].handler).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('runs the highlighted command on Enter without moving first', async () => {
    const user = userEvent.setup()
    const commands = makeCommands()
    renderPalette(commands)

    await user.keyboard('{Enter}')

    expect(commands[0].handler).toHaveBeenCalledTimes(1)
  })

  it('updates aria-activedescendant as the active row changes', async () => {
    const user = userEvent.setup()
    renderPalette(makeCommands())
    const input = screen.getByRole('combobox')

    const first = input.getAttribute('aria-activedescendant')
    expect(first).toBeTruthy()

    await user.keyboard('{ArrowDown}')
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first)
  })

  it('does not run a disabled command and explains why', async () => {
    const user = userEvent.setup()
    const commands: Command[] = [
      {
        id: 'exports:csv',
        label: 'Export as CSV',
        category: 'exports',
        enabled: false,
        disabledReason: 'Export rate limit reached',
        handler: vi.fn(),
      },
    ]
    const { onClose } = renderPalette(commands)

    await user.keyboard('{Enter}')

    expect(commands[0].handler).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Export rate limit reached')).toBeInTheDocument()
  })

  it('keeps the palette open when a command handler throws', async () => {
    const user = userEvent.setup()
    const commands: Command[] = [
      {
        id: 'boom',
        label: 'Explode',
        category: 'navigation',
        handler: () => {
          throw new Error('nope')
        },
      },
    ]
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderPalette(commands)

    await user.keyboard('{Enter}')

    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('CommandPaletteProvider', () => {
  function renderProvider() {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <CommandRegistryProvider>
            <CommandPaletteProvider>
              <div>app content</div>
            </CommandPaletteProvider>
          </CommandRegistryProvider>
        </ToastProvider>
      </MemoryRouter>,
    )
  }

  it('opens and closes with Ctrl+K', async () => {
    renderProvider()
    expect(screen.queryByRole('combobox')).toBeNull()

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('combobox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
  })

  it('opens with Cmd+K', async () => {
    renderProvider()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('does not open for other modifiers or repeat events', () => {
    renderProvider()
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, altKey: true })
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, repeat: true })
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('exposes navigation commands from the registry', async () => {
    renderProvider()
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })
})
