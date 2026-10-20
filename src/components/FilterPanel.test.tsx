import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { isRememberingFilters, readRememberedFilters, rememberFilters } from '../utils/dashboardFilterMemory'
import { FilterPanel } from './FilterPanel'

function renderPanel(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FilterPanel />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('FilterPanel remember-filters opt-in', () => {
  it('is unticked by default and stores nothing', () => {
    renderPanel('/?sources=chainlink')
    expect(screen.getByRole('checkbox', { name: /remember these filters on this device only/i })).not.toBeChecked()
    expect(isRememberingFilters()).toBe(false)
  })

  it('saves the current filters when ticked and clears them when unticked', async () => {
    const user = userEvent.setup()
    renderPanel('/?sources=chainlink&search=btc')
    const box = screen.getByRole('checkbox', { name: /remember these filters on this device only/i })

    await user.click(box)
    expect(box).toBeChecked()
    expect(readRememberedFilters()?.toString()).toBe('sources=chainlink')

    await user.click(box)
    expect(box).not.toBeChecked()
    expect(isRememberingFilters()).toBe(false)
  })

  it('starts ticked when filters were already remembered on this device', () => {
    rememberFilters(new URLSearchParams('minConf=30'))
    renderPanel('/')
    expect(screen.getByRole('checkbox', { name: /remember these filters on this device only/i })).toBeChecked()
  })
})
