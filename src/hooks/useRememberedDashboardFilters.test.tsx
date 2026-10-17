import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { rememberFilters } from '../utils/dashboardFilterMemory'
import { useRestoreRememberedFilters } from './useRememberedDashboardFilters'

function Probe() {
  useRestoreRememberedFilters()
  const { search } = useLocation()
  return <output data-testid="search">{search}</output>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('useRestoreRememberedFilters', () => {
  it('leaves the URL alone when nothing is remembered', () => {
    renderAt('/')
    expect(screen.getByTestId('search')).toHaveTextContent('')
  })

  it('applies remembered filters when the URL has none', () => {
    rememberFilters(new URLSearchParams('sources=chainlink&sort=price-high'))
    renderAt('/')
    const params = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(params.get('sources')).toBe('chainlink')
    expect(params.get('sort')).toBe('price-high')
  })

  it('prefers filters already in the URL over remembered ones', () => {
    rememberFilters(new URLSearchParams('sources=chainlink'))
    renderAt('/?sources=band')
    const params = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(params.get('sources')).toBe('band')
  })

  it('keeps non-filter URL params such as search text when restoring', () => {
    rememberFilters(new URLSearchParams('minConf=50'))
    renderAt('/?search=xlm')
    const params = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(params.get('search')).toBe('xlm')
    expect(params.get('minConf')).toBe('50')
  })
})
