import { type ReactElement } from 'react'

/**
 * Skip navigation link for keyboard users.
 * 
 * Makes the entire navigation bar skippable with a single key press.
 * - First focusable element on the page (via negative tabIndex on body)
 * - Visually hidden until focused
 * - Scrolls to and focuses main content on activation
 * 
 * WCAG 2.1 Level A: 2.4.1 Bypass Blocks
 */
export function SkipNavLink(): ReactElement {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()

    // Focus the main content element
    const mainElement = document.getElementById('main-content')
    if (mainElement) {
      mainElement.focus()
      // scrollIntoView may not be supported in test environments
      if (typeof mainElement.scrollIntoView === 'function') {
        mainElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:z-[9999] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-lg focus:outline-2 focus:outline-offset-2 focus:outline-cyan-400 focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}
