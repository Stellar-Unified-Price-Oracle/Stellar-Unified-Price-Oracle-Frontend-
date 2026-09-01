/** Badge color classes for known oracle sources, shared by PriceDetail and the price Proof tab. */
export const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
}

/** Badge color classes for a confidence score, bucketed at >0.9 (high) and >0.8 (medium). */
export function getConfidenceColor(confidence: number): string {
  if (confidence > 0.9) {
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  }
  if (confidence > 0.8) {
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  }
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}
