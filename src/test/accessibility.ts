import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { expect } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

export interface AccessibilityCheckOptions extends NonNullable<Parameters<typeof axe>[1]> {
  /** Wrap the element in providers before rendering (e.g. router/preferences). */
  wrapper?: (children: ReactNode) => ReactElement
}

/**
 * Helper to run axe accessibility checks on a React component.
 * Renders the component and asserts that there are no accessibility violations.
 *
 * @param ui The React element to render and test.
 * @param options Custom options to pass to axe (rules, impactLevels, etc.),
 *   plus an optional `wrapper` to nest the element in providers.
 * @returns The axe results in case manual asserts or checks are needed.
 */
export async function checkAccessibility(
  ui: ReactElement,
  options?: AccessibilityCheckOptions,
): Promise<Awaited<ReturnType<typeof axe>>> {
  const { wrapper, ...axeOptions } = options ?? {}
  const node = wrapper ? wrapper(ui) : ui
  const { container } = render(node)
  const results = await axe(container, axeOptions)
  expect(results).toHaveNoViolations()
  return results
}
