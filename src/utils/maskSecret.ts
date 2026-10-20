/** Placeholder shown in place of every hidden character. */
const MASK = '••••'

/**
 * Masks a credential for display, keeping only its last `visible` characters.
 *
 * Values no longer than `visible` are fully hidden, so a short secret is never
 * shown in its entirety. The output is always `MASK` plus at most `visible`
 * characters, regardless of the input length, so the mask does not leak the
 * secret's length.
 */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return ''
  if (value.length <= visible) return MASK
  // `slice(-0)` is `slice(0)`, which would expose the whole value when visible is 0.
  return `${MASK}${value.slice(value.length - visible)}`
}
