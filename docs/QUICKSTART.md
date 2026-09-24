# Stellar Price Oracle API — Quick Start

Get up and running with the Stellar Price Oracle API in 5 minutes.

---

## Choose Your Integration Method

### Option 1: REST API (Simple, Synchronous)

Best for: One-off requests, dashboards, historical data

```javascript
// Get the current BTC price in 3 lines
const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices/BTC/USD')
const price = await response.json()
console.log(`BTC: $${price.price}`)
```

### Option 2: WebSocket (Real-Time)

Best for: Live price feeds, trading apps, monitoring dashboards

```javascript
// Stream live prices
const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')

ws.onopen = () => {
  ws.send(JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }))
}

ws.onmessage = (event) => {
  const { assetPair, price } = JSON.parse(event.data)
  console.log(`${assetPair}: $${price}`)
}
```

---

## Installation

### JavaScript/Node.js

#### Option A: Native Fetch (No Dependencies)

```javascript
// Works in browsers and Node.js 18+
const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices/BTC/USD')
const price = await response.json()
```

#### Option B: Official SDK

```bash
npm install @stellar-oracle/sdk-js
```

```javascript
import { PriceOracleClient } from '@stellar-oracle/sdk-js'

const client = new PriceOracleClient('https://api.stellar-price-oracle.example.com')
const btcPrice = await client.getPrice('BTC/USD')
console.log(`BTC: $${btcPrice.price}`)
```

### Python

```bash
pip install stellar-oracle
```

```python
from stellar_oracle import PriceOracleClient

client = PriceOracleClient('https://api.stellar-price-oracle.example.com')
btc_price = client.get_price('BTC/USD')
print(f"BTC: ${btc_price['price']}")
```

### Go

```bash
go get github.com/stellar-oracle/sdk-go
```

```go
package main

import (
    "fmt"
    oracle "github.com/stellar-oracle/sdk-go"
)

func main() {
    client := oracle.NewClient("https://api.stellar-price-oracle.example.com")
    price, _ := client.GetPrice("BTC/USD")
    fmt.Printf("BTC: $%.2f\n", price.Price)
}
```

---

## Common Tasks

### 1. Get Current Price

```javascript
async function getCurrentPrice(pair) {
  const response = await fetch(
    `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}`
  )
  const data = await response.json()
  return data
}

// Usage
const btc = await getCurrentPrice('BTC/USD')
console.log(`${btc.assetPair}: $${btc.price} (confidence: ${btc.confidence * 100}%)`)
```

### 2. Get All Prices

```javascript
async function getAllPrices() {
  const response = await fetch(
    'https://api.stellar-price-oracle.example.com/api/prices'
  )
  const prices = await response.json()
  return prices
}

// Usage
const prices = await getAllPrices()
prices.forEach(p => {
  console.log(`${p.assetPair}: $${p.price}`)
})
```

### 3. Get Price History

```javascript
async function getPriceHistory(pair, limit = 100) {
  const response = await fetch(
    `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}`
  )
  const { history } = await response.json()
  return history
}

// Usage
const history = await getPriceHistory('BTC/USD', 50)
console.log(`${history.length} price points retrieved`)
history.forEach(entry => {
  console.log(`${new Date(entry.timestamp).toISOString()}: $${entry.price}`)
})
```

### 4. Stream Real-Time Prices

```javascript
function subscribeToPrice(pairs, onUpdate) {
  const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: 'subscribe',
      assetPairs: pairs
    }))
  }
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data)
    if (update.type === 'price_update') {
      onUpdate(update)
    }
  }
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
  
  return ws
}

// Usage
subscribeToPrice(['BTC/USD', 'ETH/USD'], (update) => {
  console.log(`${update.assetPair}: $${update.price}`)
})
```

### 5. Handle Errors & Rate Limits

```javascript
async function apiCallWithRetry(endpoint, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(endpoint)
    
    // Success
    if (response.ok) {
      return response.json()
    }
    
    // Rate limited
    if (response.status === 429) {
      const resetTime = parseInt(response.headers.get('X-RateLimit-Reset'))
      const waitMs = (resetTime * 1000) - Date.now()
      console.log(`Rate limited. Waiting ${waitMs}ms...`)
      await sleep(waitMs)
      continue
    }
    
    // Server error — retry with backoff
    if (response.status >= 500 && attempt < maxRetries - 1) {
      const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
      console.log(`Server error. Retrying in ${delay}ms...`)
      await sleep(delay)
      continue
    }
    
    // Client error or final attempt
    throw new Error(`HTTP ${response.status}`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Usage
try {
  const price = await apiCallWithRetry('https://api.stellar-price-oracle.example.com/api/prices/BTC/USD')
  console.log(`BTC: $${price.price}`)
} catch (error) {
  console.error('Failed to get price:', error)
}
```

---

## Examples by Use Case

### Dashboard / Portfolio Tracker

```javascript
class PortfolioDashboard {
  constructor(pairs) {
    this.pairs = pairs
    this.prices = new Map()
  }

  async init() {
    // Load initial prices
    await this.refreshPrices()
    
    // Stream live updates
    this.subscribeToUpdates()
    
    // Refresh prices every 10 seconds as fallback
    setInterval(() => this.refreshPrices(), 10000)
  }

  async refreshPrices() {
    const endpoint = `?pairs=${this.pairs.join(',')}`
    const response = await fetch(
      `https://api.stellar-price-oracle.example.com/api/prices${endpoint}`
    )
    const prices = await response.json()
    
    prices.forEach(p => {
      this.prices.set(p.assetPair, p)
      this.render()
    })
  }

  subscribeToUpdates() {
    const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'subscribe',
        assetPairs: this.pairs
      }))
    }
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (update.type === 'price_update') {
        this.prices.set(update.assetPair, update)
        this.render()
      }
    }
    
    ws.onclose = () => {
      setTimeout(() => this.subscribeToUpdates(), 5000)
    }
  }

  render() {
    console.log('=== Portfolio ===')
    for (const [pair, price] of this.prices) {
      console.log(`${pair}: $${price.price.toFixed(2)} (${(price.confidence * 100).toFixed(1)}%)`)
    }
  }
}

// Usage
const dashboard = new PortfolioDashboard(['BTC/USD', 'ETH/USD', 'XLM/USD'])
dashboard.init()
```

### Price Alert System

```javascript
class PriceAlertSystem {
  constructor() {
    this.alerts = []
  }

  addAlert(pair, threshold, type = 'above') {
    this.alerts.push({ pair, threshold, type })
  }

  async start() {
    const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
    const pairs = [...new Set(this.alerts.map(a => a.pair))]
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'subscribe',
        assetPairs: pairs
      }))
    }
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      if (update.type === 'price_update') {
        this.checkAlerts(update)
      }
    }
  }

  checkAlerts(update) {
    for (const alert of this.alerts) {
      if (alert.pair !== update.assetPair) continue
      
      const triggered = 
        (alert.type === 'above' && update.price > alert.threshold) ||
        (alert.type === 'below' && update.price < alert.threshold)
      
      if (triggered) {
        this.notify(alert, update)
      }
    }
  }

  notify(alert, price) {
    console.log(`🔔 Alert: ${price.assetPair} is now $${price.price}`)
  }
}

// Usage
const alerts = new PriceAlertSystem()
alerts.addAlert('BTC/USD', 50000, 'above')
alerts.addAlert('BTC/USD', 40000, 'below')
alerts.start()
```

### Historical Data Export

```javascript
async function* exportHistoricalData(pair, pageSize = 500) {
  let offset = 0
  
  while (true) {
    const endpoint = `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}/history`
    const response = await fetch(`${endpoint}?limit=${pageSize}&offset=${offset}`)
    const { history } = await response.json()
    
    if (history.length === 0) break
    
    yield history.map(entry => ({
      timestamp: new Date(entry.timestamp).toISOString(),
      price: entry.price,
      confidence: entry.confidence,
      sources: entry.sources.join(',')
    }))
    
    offset += pageSize
  }
}

// Usage: Export to CSV
async function exportToCSV(pair, filename) {
  const stream = fs.createWriteStream(filename)
  
  stream.write('timestamp,price,confidence,sources\n')
  
  for await (const batch of exportHistoricalData(pair)) {
    for (const row of batch) {
      stream.write(`${row.timestamp},${row.price},${row.confidence},${row.sources}\n`)
    }
  }
  
  stream.end()
  console.log(`Exported to ${filename}`)
}

// await exportToCSV('BTC/USD', 'btc-history.csv')
```

---

## Monitoring & Health Checks

```javascript
async function monitorApiHealth() {
  setInterval(async () => {
    try {
      const response = await fetch('https://api.stellar-price-oracle.example.com/health')
      const { status, uptime } = await response.json()
      
      console.log(`API Status: ${status}`)
      console.log(`Uptime: ${uptime}s`)
      
      if (status !== 'healthy') {
        console.warn('API is degraded!')
      }
    } catch (error) {
      console.error('Health check failed:', error)
    }
  }, 30000) // Every 30 seconds
}

monitorApiHealth()
```

---

## Rate Limiting Tips

1. **Batch requests** — Use `/api/prices/history/batch` for multiple pairs
2. **Cache results** — Store prices locally for 1–5 minutes
3. **Use WebSocket** — Real-time updates use fewer API calls than polling
4. **Monitor headers** — Check `X-RateLimit-Remaining` to avoid hitting limits

---

## Troubleshooting

### "Asset pair not found"
- Verify pair format: `BASE/QUOTE` (e.g., `BTC/USD`)
- Query `/api/prices` to see available pairs

### "Rate limit exceeded"
- Wait for `X-RateLimit-Reset` timestamp
- Use exponential backoff between retries
- Batch multiple pairs into single request

### "WebSocket connection drops"
- Implement reconnection with exponential backoff
- Check network stability
- Monitor for heartbeat timeouts

### CORS errors in browser
- Ensure API server has `Access-Control-Allow-Origin` headers
- Use HTTPS (wss:// for WebSocket)

---

## Next Steps

- **Read Full API Docs:** [`docs/API.md`](API.md)
- **Error Reference:** [`docs/ERRORS.md`](ERRORS.md)
- **OpenAPI Spec:** [`docs/openapi.yaml`](openapi.yaml)
- **GitHub Repo:** https://github.com/stellar-oracle/api
- **Support:** support@stellar-oracle.example.com

---

**Happy coding! 🚀**
