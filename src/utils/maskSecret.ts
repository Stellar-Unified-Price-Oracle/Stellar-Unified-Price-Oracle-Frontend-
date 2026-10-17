/**
 * Masks secret material for display (#843). Keeps the last `visible` characters
 * and replaces the rest with bullets. A value no longer than `visible` is fully
 * masked so a short secret is never shown in the clear.
 */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return ''
  if (value.length <= visible) return '•'.repeat(value.length)
  return '•'.repeat(value.length - visible) + value.slice(value.length - visible)
}
