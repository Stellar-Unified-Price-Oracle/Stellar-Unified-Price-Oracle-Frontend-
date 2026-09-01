import { preloadChunk } from './preloadCache'

const loadExportModule = () => import('./export')
const loadChartExportModule = () => import('./chartExport')

/** Export generators are fetched only after the user starts an export. */
export const loadExportUtils = () =>
  preloadChunk('feature-export-utils', loadExportModule)

/** Chart rasterisation code is fetched only after a chart export is selected. */
export const loadChartExport = () =>
  preloadChunk('feature-chart-export', loadChartExportModule)
