import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SkipNavLink } from './SkipNavLink'

describe('SkipNavLink', () => {
  beforeEach(() => {
    // Create the main content element that the skip link targets
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.appendChild(main)
  })

  afterEach(() => {
    // Clean up the main content element
    const main = document.getElementById('main-content')
    main?.remove()
  })

  it('renders skip link as visually hidden by default', () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1] // Get the last one rendered
    
    // Should have sr-only class (visually hidden)
    expect(link).toHaveClass('sr-only')
  })

  it('becomes visible on focus', async () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    
    // Should have focus:not-sr-only class that removes sr-only on focus
    link.focus()
    expect(document.activeElement).toBe(link)
    expect(link).toHaveClass('focus:not-sr-only')
  })

  it('has proper styling for focused state', () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    
    const classes = link.className
    expect(classes).toContain('focus:bg-cyan-600')
    expect(classes).toContain('focus:text-white')
    expect(classes).toContain('focus:rounded-lg')
    expect(classes).toContain('focus:z-[9999]')
  })

  it('focuses main content on click', async () => {
    const user = userEvent.setup()
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    const main = document.getElementById('main-content')

    await user.click(link)
    
    expect(main).toBe(document.activeElement)
  })

  it('has href pointing to main-content', () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    
    expect(link).toHaveAttribute('href', '#main-content')
  })

  it('has high z-index to appear above all content', () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    
    expect(link).toHaveClass('focus:z-[9999]')
  })

  it('has outline for keyboard navigation visibility', () => {
    render(<SkipNavLink />)
    const links = screen.getAllByRole('link', { name: /skip to main content/i })
    const link = links[links.length - 1]
    
    expect(link).toHaveClass('focus:outline-2')
    expect(link).toHaveClass('focus:outline-offset-2')
    expect(link).toHaveClass('focus:outline-cyan-400')
  })
})
