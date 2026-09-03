import { useEffect, useMemo, useRef } from 'react'
import type { PriceData } from '../types'
import { formatPrice } from '../utils/format'
import { useAnnounce } from './useAnnounce'

export interface PriceAnnouncerConfig {
  minPercentageChange: number
  deduplicationMs: number
  maxAnnouncementsPerBatch: number
}

const DEFAULT_CONFIG: PriceAnnouncerConfig = {
  minPercentageChange: 1,
  deduplicationMs: 5000,
  maxAnnouncementsPerBatch: 3,
}

interface PriceChangeInfo {
  pair: string
  oldPrice: number
  newPrice: number
  percentChange: number
}

/**
 * Hook for announcing significant price changes to screen readers.
 * Only announces prices that meet the configured thresholds.
 */
export function usePriceAnnouncer(
  prices: PriceData[] | undefined,
  config: Partial<PriceAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce({
    deduplicationMs: (config.deduplicationMs ?? DEFAULT_CONFIG.deduplicationMs) * 2,
  })

  const prevPricesRef = useRef<Map<string, number>>(new Map())
  const lastAnnouncedRef = useRef<Map<string, number>>(new Map())

  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  useEffect(() => {
    if (!prices || prices.length === 0) return

    const changes: PriceChangeInfo[] = []

    for (const price of prices) {
      const oldPrice = prevPricesRef.current.get(price.assetPair)
      if (oldPrice === undefined) {
        prevPricesRef.current.set(price.assetPair, price.price)
        continue
      }

      if (oldPrice === price.price) continue

      const percentChange = Math.abs((price.price - oldPrice) / oldPrice) * 100

      if (percentChange >= mergedConfig.minPercentageChange) {
        const lastAnnounced = lastAnnouncedRef.current.get(price.assetPair)
        const now = Date.now()
        if (lastAnnounced === undefined || now - lastAnnounced >= mergedConfig.deduplicationMs) {
          changes.push({
            pair: price.assetPair,
            oldPrice,
            newPrice: price.price,
            percentChange,
          })
          lastAnnouncedRef.current.set(price.assetPair, now)
        }
      }

      prevPricesRef.current.set(price.assetPair, price.price)
    }

    if (changes.length > 0) {
      const sorted = changes.sort((a, b) => b.percentChange - a.percentChange)
      const toAnnounce = sorted.slice(0, mergedConfig.maxAnnouncementsPerBatch)

      toAnnounce.forEach(change => {
        const direction = change.newPrice > change.oldPrice ? 'up' : 'down'
        const msg = `${change.pair} moved ${direction} to ${formatPrice(change.newPrice)}, ${change.percentChange.toFixed(1)}% change`
        announce(msg, 'polite')
      })
    }
  }, [prices, mergedConfig, announce])
}

/**
 * Hook for announcing when new price data is loaded or filtered.
 */
export function usePriceDataAnnouncer(
  prices: PriceData[] | undefined,
  loadingMessage = 'Price data loaded',
  config: Partial<PriceAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce(config)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (!prices) return

    const count = prices.length

    if (prevCountRef.current === 0 && count > 0) {
      const plural = count !== 1 ? 's' : ''
      announce(`${loadingMessage}. ${count} price pair${plural} available`, 'polite')
    } else if (count > 0 && count !== prevCountRef.current) {
      const verb = count > prevCountRef.current ? 'added' : 'removed'
      const diff = Math.abs(count - prevCountRef.current)
      const plural = diff !== 1 ? 's' : ''
      announce(`${diff} price pair${plural} ${verb}`, 'polite')
    }

    prevCountRef.current = count
  }, [prices, announce, loadingMessage])
}

/**
 * Hook for announcing price alerts within live updates
 * (e.g., "USDT price is now $1.01, up 0.5% from $1.004")
 */
export function usePriceAlertAnnouncer(
  pair: string | undefined,
  price: PriceData | undefined,
  config: Partial<PriceAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce(config)
  const prevPriceRef = useRef<number | undefined>()

  useEffect(() => {
    if (!pair || !price) return

    const oldPrice = prevPriceRef.current
    if (oldPrice === undefined) {
      prevPriceRef.current = price.price
      return
    }

    if (oldPrice === price.price) return

    const percentChange = Math.abs((price.price - oldPrice) / oldPrice) * 100

    const minChange = config.minPercentageChange ?? DEFAULT_CONFIG.minPercentageChange
    if (percentChange >= minChange) {
      const direction = price.price > oldPrice ? 'up' : 'down'
      const pct = percentChange.toFixed(1)
      const msg = `${pair} price is now ${formatPrice(price.price)}, ${direction} ${pct}% from ${formatPrice(oldPrice)}`
      announce(msg, 'polite')
    }

    prevPriceRef.current = price.price
  }, [pair, price, config, announce])
}
