import 'vitest-axe'

declare module 'vitest' {
  interface Assertion<_a> {
    toHaveNoViolations(): void
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void
  }
}
