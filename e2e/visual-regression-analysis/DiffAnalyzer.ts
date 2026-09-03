/**
 * Visual Diff Analyzer
 *
 * Analyzes pixel differences between baseline and current screenshots to:
 * - Detect changed regions (bounding boxes)
 * - Classify severity (cosmetic vs layout vs critical)
 * - Attribute changes to likely CSS properties
 * - Estimate component impact
 *
 * This reduces false positives and accelerates triage by providing
 * actionable diagnostics instead of raw pixel diffs.
 */

import type { ChangeAnalysis, ChangedRegion, ChangeSeverity } from './types'

/**
 * Analyzes pixel diffs between two images to detect changed regions and
 * provide diagnostic information.
 *
 * Approach:
 * 1. Load both images as pixel arrays
 * 2. Compute per-pixel diff (RGB euclidean distance)
 * 3. Cluster changed pixels into contiguous regions
 * 4. Classify each region by analyzing changed pixels
 * 5. Suggest likely CSS causes based on region characteristics
 */
export class DiffAnalyzer {
  private baselinePixels: Uint8ClampedArray | null = null
  private currentPixels: Uint8ClampedArray | null = null
  private diffPixels: Uint8ClampedArray | null = null
  private width = 0
  private height = 0

  /**
   * Initialize analyzer with two image buffers.
   * Images must be same dimensions and RGBA format.
   */
  async loadImages(_baselineBuffer: Buffer, _currentBuffer: Buffer): Promise<void> {
    // In Node.js, convert buffers to Canvas-like pixel data
    // This is a simplified approach; in practice, use a library like 'jimp' or 'sharp'

    // For now, we'll parse the dimensions from PNG headers or use external library
    // This is a stub that will be enhanced with actual image processing
    console.warn('DiffAnalyzer.loadImages: PNG parsing not yet implemented. Use jimp or canvas.')
  }

  /**
   * Compute pixel-by-pixel diff between baseline and current.
   * Returns normalized diff ratio (0–1) where 1 = completely different.
   */
  computeDiffRatio(): number {
    if (!this.baselinePixels || !this.currentPixels) {
      throw new Error('Images not loaded. Call loadImages() first.')
    }

    let changedPixels = 0
    const totalPixels = this.baselinePixels.length / 4 // RGBA = 4 bytes per pixel

    for (let i = 0; i < this.baselinePixels.length; i += 4) {
      const [r1, g1, b1, a1] = [
        this.baselinePixels[i],
        this.baselinePixels[i + 1],
        this.baselinePixels[i + 2],
        this.baselinePixels[i + 3],
      ]

      const [r2, g2, b2, a2] = [
        this.currentPixels[i],
        this.currentPixels[i + 1],
        this.currentPixels[i + 2],
        this.currentPixels[i + 3],
      ]

      // Euclidean distance in RGBA space
      const delta = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2 + (a1 - a2) ** 2)

      // Threshold: consider pixel changed if delta > 15 (on 0–255 scale)
      if (delta > 15) {
        changedPixels++
      }
    }

    return changedPixels / totalPixels
  }

  /**
   * Detect contiguous regions of changed pixels using connected component analysis.
   * Returns bounding boxes of changed regions.
   */
  detectChangedRegions(diffThreshold: number = 0.1): ChangedRegion[] {
    if (!this.baselinePixels || !this.currentPixels) {
      throw new Error('Images not loaded. Call loadImages() first.')
    }

    const regions: ChangedRegion[] = []
    const visited = new Uint8Array(this.width * this.height)

    // Simple horizontal scan; more sophisticated: use flood-fill or DBSCAN
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIdx = (y * this.width + x) * 4
        if (visited[y * this.width + x]) continue

        const diff = this.getPixelDiff(pixelIdx)
        if (diff > diffThreshold) {
          // Found start of a region; expand to find bounds
          const region = this.floodFillRegion(x, y, visited, diffThreshold)
          if (region.width > 1 && region.height > 1) {
            // Ignore single-pixel noise
            regions.push(region)
          }
        }
      }
    }

    return this.mergeAdjacentRegions(regions)
  }

  /**
   * Get pixel-by-pixel diff at index.
   * Returns normalized value 0–1 where 1 = completely different.
   */
  private getPixelDiff(pixelIdx: number): number {
    if (!this.baselinePixels || !this.currentPixels) return 0

    const [r1, g1, b1, a1] = [
      this.baselinePixels[pixelIdx],
      this.baselinePixels[pixelIdx + 1],
      this.baselinePixels[pixelIdx + 2],
      this.baselinePixels[pixelIdx + 3],
    ]

    const [r2, g2, b2, a2] = [
      this.currentPixels[pixelIdx],
      this.currentPixels[pixelIdx + 1],
      this.currentPixels[pixelIdx + 2],
      this.currentPixels[pixelIdx + 3],
    ]

    const delta = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2 + (a1 - a2) ** 2)
    return Math.min(1, delta / 255) // Normalize to 0–1
  }

  /**
   * Flood-fill from (x, y) to find contiguous region of changed pixels.
   */
  private floodFillRegion(
    startX: number,
    startY: number,
    visited: Uint8Array,
    diffThreshold: number,
  ): ChangedRegion {
    const queue: Array<[number, number]> = [[startX, startY]]
    let minX = startX,
      maxX = startX,
      minY = startY,
      maxY = startY
    let changedPixelCount = 0

    while (queue.length > 0) {
      const [x, y] = queue.shift()!

      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue
      if (visited[y * this.width + x]) continue

      const pixelIdx = (y * this.width + x) * 4
      if (this.getPixelDiff(pixelIdx) <= diffThreshold) continue

      visited[y * this.width + x] = 1
      changedPixelCount++

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Add neighbors to queue
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      changePercentage: (changedPixelCount / (this.width * this.height)) * 100,
    }
  }

  /**
   * Merge nearby regions to reduce fragmentation from anti-aliasing or sub-pixel rendering.
   */
  private mergeAdjacentRegions(regions: ChangedRegion[], mergeThreshold: number = 20): ChangedRegion[] {
    if (regions.length === 0) return []

    // Simple approach: sort by position, merge if close
    const merged: ChangedRegion[] = []

    for (const region of regions) {
      let merged_ = false

      for (const existing of merged) {
        if (this.regionsAdjacent(region, existing, mergeThreshold)) {
          // Merge
          const x = Math.min(existing.x, region.x)
          const y = Math.min(existing.y, region.y)
          const width = Math.max(existing.x + existing.width, region.x + region.width) - x
          const height = Math.max(existing.y + existing.height, region.y + region.height) - y

          existing.x = x
          existing.y = y
          existing.width = width
          existing.height = height
          existing.changePercentage = Math.max(existing.changePercentage, region.changePercentage)

          merged_ = true
          break
        }
      }

      if (!merged_) {
        merged.push(region)
      }
    }

    return merged
  }

  /**
   * Check if two regions are adjacent (within mergeThreshold pixels).
   */
  private regionsAdjacent(r1: ChangedRegion, r2: ChangedRegion, threshold: number): boolean {
    const dx = Math.min(
      Math.abs(r1.x - (r2.x + r2.width)),
      Math.abs((r1.x + r1.width) - r2.x),
    )

    const dy = Math.min(
      Math.abs(r1.y - (r2.y + r2.height)),
      Math.abs((r1.y + r1.height) - r2.y),
    )

    return dx < threshold && dy < threshold
  }

  /**
   * Classify severity of a change region based on characteristics.
   *
   * - Cosmetic: color, opacity, shadow (color channels changed, no layout)
   * - Layout: position, size, margin, padding (geometry affected)
   * - Critical: rendering artifacts, missing content, overflow
   */
  classifyRegionSeverity(region: ChangedRegion): ChangeSeverity {
    // Heuristics based on region size and position stability
    const regionSize = region.width * region.height
    const screenSize = this.width * this.height

    if (region.changePercentage < 0.1) {
      return 'cosmetic' // <0.1% of pixels changed
    }

    if (region.changePercentage < 2) {
      // Small, localized change = likely cosmetic
      if (regionSize < screenSize * 0.05) {
        return 'cosmetic'
      }
      return 'layout'
    }

    // Large change = potential critical issue
    if (regionSize > screenSize * 0.25) {
      return 'critical'
    }

    return 'layout'
  }

  /**
   * Analyze a region to suggest likely CSS properties that changed.
   *
   * Based on region characteristics:
   * - Thin horizontal stripe → margin, padding, line-height
   * - Vertical edges → width, padding, border
   * - Color shift only → color, background, opacity
   */
  suggestCssChanges(region: ChangedRegion): string[] {
    const suggestions: Set<string> = new Set()

    const aspectRatio = region.width / region.height

    // Thin horizontal stripe → spacing
    if (aspectRatio > 3 && region.height < 20) {
      suggestions.add('margin')
      suggestions.add('padding')
      suggestions.add('line-height')
      suggestions.add('font-size')
    }

    // Thin vertical stripe → width or border
    if (aspectRatio < 0.33 && region.width < 20) {
      suggestions.add('width')
      suggestions.add('border')
      suggestions.add('padding')
    }

    // Large region → layout shift
    if (region.width > 100 && region.height > 100) {
      suggestions.add('position')
      suggestions.add('display')
      suggestions.add('grid-template-columns')
      suggestions.add('grid-template-rows')
      suggestions.add('flex-direction')
    }

    // Color-only change (heuristic: no geometric shift)
    if (region.width < 10 && region.height < 10) {
      suggestions.add('color')
      suggestions.add('background-color')
      suggestions.add('border-color')
      suggestions.add('opacity')
    }

    return Array.from(suggestions)
  }

  /**
   * Estimate affected component based on region location and size.
   * (Stub: would use CSS class inspection from page snapshot in practice)
   */
  estimateAffectedComponents(region: ChangedRegion): string[] {
    const components: string[] = []

    // Heuristic: top 20% → header/nav
    if (region.y < this.height * 0.2) {
      components.push('Header', 'Navigation')
    }

    // Middle 60% → main content
    if (region.y > this.height * 0.2 && region.y < this.height * 0.8) {
      components.push('PriceCard', 'PriceTable', 'ContentArea')
    }

    // Bottom 20% → footer
    if (region.y > this.height * 0.8) {
      components.push('Footer')
    }

    // Right 20% (common for sidebars/modals)
    if (region.x > this.width * 0.8) {
      components.push('Sidebar', 'Modal', 'Drawer')
    }

    return components
  }

  /**
   * Generate human-readable description of a change.
   */
  describeChange(severity: ChangeSeverity, cssChanges: string[], components: string[]): string {
    const severityLabel = {
      cosmetic: 'Visual refinement',
      layout: 'Layout adjustment',
      critical: 'Critical rendering issue',
    }[severity]

    const cssStr = cssChanges.slice(0, 3).join(', ') || 'unknown properties'
    const compStr = components.slice(0, 2).join(', ') || 'components'

    return `${severityLabel} detected in ${compStr}: likely ${cssStr} changed.`
  }

  /**
   * Synthesize analysis of all changed regions into recommendations.
   */
  generateAnalysis(diffRatio: number, regions: ChangedRegion[]): ChangeAnalysis[] {
    return regions.map((region) => {
      const severity = this.classifyRegionSeverity(region)
      const likelyCauses = this.suggestCssChanges(region)
      const affectedComponents = this.estimateAffectedComponents(region)
      const description = this.describeChange(severity, likelyCauses, affectedComponents)

      // Confidence: higher for larger changes (less likely noise)
      const confidence = Math.min(1, region.changePercentage / 5)

      return {
        region,
        severity,
        likelyCauses,
        affectedComponents,
        confidence,
        description,
      }
    })
  }
}
