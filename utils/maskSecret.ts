/**
 * Masks a secret value for display.
 *
 * - Values no longer than the visible suffix are fully masked (no characters revealed).
 * - The masked output always preserves the original string length.
 * - For long values, exactly the trailing `visibleSuffix` characters are revealed.
 */
export function maskSecret(value: string, visibleSuffix = 4): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  const suffixLength = Math.max(0, Math.floor(visibleSuffix));

  // Fully mask short values so no characters leak.
  if (suffixLength === 0 || value.length <= suffixLength) {
    return '*'.repeat(value.length);
  }

  const maskedLength = value.length - suffixLength;
  const suffix = value.slice(maskedLength);

  return '*'.repeat(maskedLength) + suffix;
}

export default maskSecret;
