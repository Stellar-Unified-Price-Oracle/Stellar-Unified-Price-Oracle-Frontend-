import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { expect } from 'vitest'
import type { ReactElement } from 'react'

/**
 * Helper to run axe accessibility checks on a React component.
 * Renders the component and asserts that there are no accessibility violations.
 *
 * @param ui The React element to render and test.
 * @param options Custom options to pass to axe (rules, impactLevels, etc.).
 * @returns The axe results in case manual asserts or checks are needed.
 */
export async function checkAccessibility(
  ui: ReactElement,
  options?: Parameters<typeof axe>[1]
) {
  const { container } = render(ui)
  const results = await axe(container, options)
  expect(results).toHaveNoViolations()
  return results
}
