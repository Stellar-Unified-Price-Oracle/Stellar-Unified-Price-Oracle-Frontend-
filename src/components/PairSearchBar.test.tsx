import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PairSearchBar } from './PairSearchBar'

const PAIRS = ['XLM/USD', 'XLM/EUR', 'BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD']

// The search input is controlled, so tests drive it through a stateful wrapper.
function Harness({ onSelect }: { onSelect: (pair: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <PairSearchBar
      pairs={PAIRS}
      allSources={[]}
      value={value}
      onChange={(next) => {
        setValue(next)
        if (PAIRS.includes(next)) onSelect(next)
      }}
    />
  )
}

function input() {
  return screen.getByRole('combobox', { name: 'Search asset pairs' })
}

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
})

describe('PairSearchBar keyboard navigation', () => {
  it('reports aria-expanded only while suggestions are actually rendered', async () => {
    const user = userEvent.setup()
    render(<Harness onSelect={vi.fn()} />)

    await user.click(input())
    expect(input()).toHaveAttribute('aria-expanded', 'false')

    await user.type(input(), 'xlm')
    expect(await screen.findByRole('listbox', { name: 'Pair suggestions' })).toBeInTheDocument()
    expect(input()).toHaveAttribute('aria-expanded', 'true')

    await user.type(input(), 'zzz')
    // Suggestions are debounced, so the list closes a moment after the last keystroke.
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(input()).toHaveAttribute('aria-expanded', 'false')
  })

  it('moves the highlight with ArrowDown and ArrowUp, clamping at both ends', async () => {
    const user = userEvent.setup()
    render(<Harness onSelect={vi.fn()} />)
    await user.type(input(), 'xlm')
    const listbox = await screen.findByRole('listbox')
    const [first, second] = within(listbox).getAllByRole('option')

    await user.keyboard('{ArrowDown}')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(input()).toHaveAttribute('aria-activedescendant', first.id)

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(second).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(
      within(listbox)
        .getAllByRole('option')
        .every((o) => o.getAttribute('aria-selected') === 'false'),
    ).toBe(true)
    expect(input()).not.toHaveAttribute('aria-activedescendant')
  })

  it('jumps with PageDown and PageUp, and with Home and End once an option is highlighted', async () => {
    const user = userEvent.setup()
    render(<Harness onSelect={vi.fn()} />)
    // "usd" matches seven pairs, enough for a PageDown jump of five to land inside the list.
    await user.type(input(), 'usd')
    const options = within(await screen.findByRole('listbox')).getAllByRole('option')
    expect(options.length).toBeGreaterThan(5)
    const selected = () => options.findIndex((o) => o.getAttribute('aria-selected') === 'true')

    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe(0)

    await user.keyboard('{PageDown}')
    expect(selected()).toBe(5)

    await user.keyboard('{PageUp}')
    expect(selected()).toBe(0)

    await user.keyboard('{End}')
    expect(selected()).toBe(options.length - 1)

    await user.keyboard('{Home}')
    expect(selected()).toBe(0)
  })

  it('leaves Home and End alone for the text caret when nothing is highlighted', async () => {
    const user = userEvent.setup()
    render(<Harness onSelect={vi.fn()} />)
    await user.type(input(), 'xlm')
    await screen.findByRole('listbox')

    await user.keyboard('{End}')

    expect(input()).not.toHaveAttribute('aria-activedescendant')
  })

  it('selects the highlighted option with Enter', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSelect={onSelect} />)
    await user.type(input(), 'xlm')
    await screen.findByRole('listbox')

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('XLM/EUR')
  })

  it('completes to the best match on Enter when a query is typed but nothing is highlighted', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSelect={onSelect} />)
    await user.type(input(), 'xlm')
    await screen.findByRole('listbox')

    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('XLM/USD')
  })

  it('closes without selecting when Enter is pressed on an empty query', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSelect={onSelect} />)
    await user.click(input())

    await user.keyboard('{Enter}')

    expect(onSelect).not.toHaveBeenCalled()
    expect(input()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape and on Tab, so focus never lands behind a stale popup', async () => {
    const user = userEvent.setup()
    render(<Harness onSelect={vi.fn()} />)
    await user.type(input(), 'xlm')
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.keyboard('{ArrowDown}')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Tab}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('gives each instance its own listbox id so two pickers never collide', () => {
    render(
      <>
        <Harness onSelect={vi.fn()} />
        <Harness onSelect={vi.fn()} />
      </>,
    )
    const [first, second] = screen.getAllByRole('combobox', { name: 'Search asset pairs' })

    const firstListbox = first.getAttribute('aria-controls')
    const secondListbox = second.getAttribute('aria-controls')
    expect(firstListbox).toBeTruthy()
    expect(secondListbox).toBeTruthy()
    expect(firstListbox).not.toBe(secondListbox)
  })
})
