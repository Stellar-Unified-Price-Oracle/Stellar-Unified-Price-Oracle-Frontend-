#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function generatePriceSeries(startPrice, points, volatility = 0.02) {
  const series = []
  let price = startPrice
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * volatility * 2
    price = Math.max(0.0001, price * (1 + change))
    series.push({
      timestamp: Date.now() - (points - i) * 60 * 1000,
      price: Number(price.toFixed(6)),
    })
  }
  return series
}

function buildMock(days = 7) {
  const minutePoints = days * 24 * 60
  const pairs = [
    { pair: 'XLM/USD', start: 0.12, vol: 0.03 },
    { pair: 'BTC/USD', start: 70000, vol: 0.04 },
    { pair: 'ETH/USD', start: 3000, vol: 0.05 },
    { pair: 'USDC/USD', start: 1.0, vol: 0.001 },
    { pair: 'EUR/USD', start: 1.08, vol: 0.002 },
  ]

  const assets = pairs.map(p => ({
    pair: p.pair,
    series: generatePriceSeries(p.start, minutePoints, p.vol),
    current: { price: null, confidence: null },
  }))

  // set current values and source health
  assets.forEach(a => {
    const last = a.series[a.series.length - 1]
    a.current.price = last.price
    a.current.confidence = parseFloat((Math.random() * 0.1).toFixed(3))
    a.sources = [
      { name: 'Chainlink', healthy: Math.random() > 0.05 },
      { name: 'Redstone', healthy: Math.random() > 0.15 },
      { name: 'Band', healthy: Math.random() > 0.2 },
    ]
  })

  return { generatedAt: Date.now(), assets }
}

function main() {
  const args = require('minimist')(process.argv.slice(2))
  const days = parseInt(args.days || args.d || '7', 10)
  const out = path.join(process.cwd(), 'scripts', 'mock-data.json')
  const data = buildMock(days)
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8')
  console.log('Wrote mock data to', out)
}

if (require.main === module) main()
