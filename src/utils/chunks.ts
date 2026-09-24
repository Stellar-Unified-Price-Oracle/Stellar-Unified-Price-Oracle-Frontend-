import { lazy } from 'react'
import { preloadChunk } from './preloadCache'

export const chunkLoaders = {
  landing: () => import('../pages/Landing'),
  dashboard: () => import('../pages/Dashboard'),
  priceDetail: () => import('../pages/PriceDetail'),
  apiDocs: () => import('../pages/ApiDocs'),
  notFound: () => import('../pages/NotFound'),
  security: () => import('../pages/Security'),
  priceChart: () => import('../components/PriceChart'),
  priceTable: () => import('../components/PriceTableView'),
  priceHistoryTable: () => import('../components/PriceHistoryTable'),
  priceProofPanel: () => import('../components/PriceProofPanel'),
  settingsPanel: () => import('../components/SettingsPanel'),
  alertPanel: () => import('../components/AlertPanel'),
} as const

export const preloadLanding = () => preloadChunk('route-landing', chunkLoaders.landing)
export const preloadDashboard = () => preloadChunk('route-dashboard', chunkLoaders.dashboard)
export const preloadPriceDetail = () => preloadChunk('route-price-detail', chunkLoaders.priceDetail)
export const preloadApiDocs = () => preloadChunk('route-api-docs', chunkLoaders.apiDocs)
export const preloadPriceChart = () => preloadChunk('feature-price-chart', chunkLoaders.priceChart)
export const preloadPriceTable = () => preloadChunk('feature-price-table', chunkLoaders.priceTable)
export const preloadPriceHistoryTable = () =>
  preloadChunk('feature-price-history-table', chunkLoaders.priceHistoryTable)
export const preloadPriceProofPanel = () => preloadChunk('feature-price-proof-panel', chunkLoaders.priceProofPanel)
export const preloadSettingsPanel = () => preloadChunk('feature-preferences', chunkLoaders.settingsPanel)
export const preloadAlertPanel = () => preloadChunk('feature-alerts', chunkLoaders.alertPanel)

export const LazyLanding = lazy(() => preloadLanding().then((module) => ({ default: module.Landing })))
export const LazyDashboard = lazy(() => preloadDashboard().then((module) => ({ default: module.Dashboard })))
export const LazyPriceDetail = lazy(() => preloadPriceDetail().then((module) => ({ default: module.PriceDetail })))
export const LazyApiDocs = lazy(() => preloadApiDocs().then((module) => ({ default: module.ApiDocs })))
export const LazyNotFound = lazy(() =>
  preloadChunk('route-not-found', chunkLoaders.notFound).then((module) => ({
    default: module.NotFound,
  })),
)
export const LazySecurity = lazy(() =>
  preloadChunk('route-security', chunkLoaders.security).then((module) => ({
    default: module.Security,
  })),
)
export const LazyPriceChart = lazy(() => preloadPriceChart().then((module) => ({ default: module.PriceChart })))
export const LazyPriceTable = lazy(() => preloadPriceTable().then((module) => ({ default: module.PriceTableView })))
export const LazyPriceHistoryTable = lazy(() =>
  preloadPriceHistoryTable().then((module) => ({
    default: module.PriceHistoryTable,
  })),
)
export const LazyPriceProofPanel = lazy(() =>
  preloadPriceProofPanel().then((module) => ({
    default: module.PriceProofPanel,
  })),
)
export const LazySettingsPanel = lazy(() =>
  preloadSettingsPanel().then((module) => ({ default: module.SettingsPanel })),
)
export const LazyAlertPanel = lazy(() => preloadAlertPanel().then((module) => ({ default: module.AlertPanel })))
