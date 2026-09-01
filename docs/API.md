# Stellar Unified Price Oracle API Documentation

**Base URL:** `https://api.stellar-price-oracle.example.com` (or configured endpoint)

**API Version:** 1.0.0

**Last Updated:** 2026-08-26

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [REST Endpoints](#rest-endpoints)
7. [WebSocket Endpoint](#websocket-endpoint)
8. [Data Models](#data-models)
9. [Examples](#examples)
10. [SDKs & Libraries](#sdks--libraries)

---

## Overview

The Stellar Unified Price Oracle API provides real-time and historical price data aggregated from multiple oracle sources:
- **Chainlink**
- **Redstone**
- **Band Protocol**
- **Reflector (Stellar)**

All prices are calculated as weighted aggregates with confidence scores indicating data quality.

### Key Features

- ✅ Real-time price updates via WebSocket
- ✅ Historical price data with pagination
- ✅ Batch price history requests (efficient for dashboards)
- ✅ Rate limiting with clear headers
- ✅ API versioning for backward compatibility
- ✅ Automatic retry logic recommended

---

## Authentication

**No authentication required** for public endpoints. The API is open and does not require API keys or credentials.

### Version Negotiation

To ensure compatibility, send the `Accept-Version` header with all requests:

```http
Accept-Version: 1.0.0
```

If the server cannot satisfy the requested version, it will respond with:
- **406 Not Acceptable** if a lower version is requested than available
- **409 Conflict** if an incompatible version is requested
- Response includes `X-API-Version` header with the server's version

---

## Rate Limiting

All endpoints are rate-limited per IP address. Rate limit metadata is included in response headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Max requests in window | `100` |
| `X-RateLimit-Remaining` | Requests remaining | `95` |
| `X-RateLimit-Reset` | Reset time (Unix timestamp, seconds) | `1693489200` |

### Rate Limit Behavior

- **Status 200** — Within limits, request succeeded
- **Status 429** — Rate limited; retry after `X-RateLimit-Reset` seconds
- Retry logic should use exponential backoff with jitter

### Recommended Backoff Strategy

```
Delay = Random(0, min(1s × 2^attempt, 30s))
Max attempts: 3
```

---

## Response Format

All REST endpoints return JSON responses. Successful responses follow this structure:

### Success Response (2xx)

```json
{
  // Response body (varies by endpoint)
  // See specific endpoint documentation below
}
```

### Error Response (4xx, 5xx)

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 400
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Status | Meaning | Retry? | Example |
|--------|---------|--------|---------|
| 200 | Success | No | Price data retrieved |
| 400 | Bad Request | No | Invalid pair format |
| 401 | Unauthorized | No | (Not used; API is public) |
| 404 | Not Found | No | Asset pair not tracked |
| 406 | Not Acceptable | No | Incompatible API version |
| 409 | Conflict | No | API version mismatch |
| 429 | Rate Limited | Yes | Too many requests |
| 500 | Server Error | Yes | Temporary server issue |
| 502 | Bad Gateway | Yes | Upstream service down |
| 503 | Service Unavailable | Yes | Server maintenance |

### Common Error Codes

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `BAD_REQUEST` | 400 | Invalid parameters | Check pair format, query parameters |
| `NOT_FOUND` | 404 | Asset pair not tracked | Verify asset pair is valid |
| `RATE_LIMITED` | 429 | Too many requests | Wait `X-RateLimit-Reset` seconds |
| `API_VERSION_MISMATCH` | 406/409 | Version incompatibility | Update to server version |
| `SERVER_ERROR` | 500+ | Internal error | Retry with backoff |

---

## REST Endpoints

### 1. Get Latest Prices (All Pairs)

Get the latest aggregated price for all tracked asset pairs.

```http
GET /api/prices
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pairs` | string (comma-separated) | No | Filter by specific pairs (e.g., `?pairs=BTC/USD,ETH/USD`) |

#### Response

```json
[
  {
    "assetPair": "BTC/USD",
    "price": 43250.50,
    "timestamp": 1693489200000,
    "confidence": 0.98,
    "sources": ["chainlink", "redstone", "band"]
  },
  {
    "assetPair": "ETH/USD",
    "price": 2150.75,
    "timestamp": 1693489195000,
    "confidence": 0.95,
    "sources": ["chainlink", "redstone"]
  }
]
```

#### HTTP Example

```bash
curl -X GET "https://api.stellar-price-oracle.example.com/api/prices" \
  -H "Accept-Version: 1.0.0"
```

#### JavaScript Example

```javascript
const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices', {
  headers: { 'Accept-Version': '1.0.0' }
})
const prices = await response.json()
console.log(prices)
```

#### Python Example

```python
import requests

response = requests.get(
    'https://api.stellar-price-oracle.example.com/api/prices',
    headers={'Accept-Version': '1.0.0'}
)
prices = response.json()
print(prices)
```

---

### 2. Get Latest Price (Single Pair)

Get the latest aggregated price for a single asset pair.

```http
GET /api/prices/:pair
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pair` | string | Asset pair (e.g., `BTC/USD`, `XLM/USD`, `ETH/EUR`) |

#### Response

```json
{
  "assetPair": "BTC/USD",
  "price": 43250.50,
  "timestamp": 1693489200000,
  "confidence": 0.98,
  "sources": ["chainlink", "redstone", "band"]
}
```

#### HTTP Example

```bash
curl -X GET "https://api.stellar-price-oracle.example.com/api/prices/BTC/USD" \
  -H "Accept-Version: 1.0.0"
```

#### Errors

```http
404 Not Found
```

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Asset pair XYZ/USD not found",
    "status": 404
  }
}
```

---

### 3. Get Price History (Single Pair)

Get paginated historical price data for a single asset pair.

```http
GET /api/prices/:pair/history
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pair` | string | Asset pair (e.g., `BTC/USD`) |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Number of records (max 500) |
| `offset` | integer | 0 | Pagination offset |

#### Response

```json
{
  "pair": "BTC/USD",
  "history": [
    {
      "price": 42800.00,
      "timestamp": 1693485600000,
      "confidence": 0.97,
      "sources": ["chainlink", "redstone"]
    },
    {
      "price": 42850.25,
      "timestamp": 1693486500000,
      "confidence": 0.98,
      "sources": ["chainlink", "redstone", "band"]
    }
  ]
}
```

#### HTTP Example

```bash
curl -X GET "https://api.stellar-price-oracle.example.com/api/prices/BTC/USD/history?limit=50&offset=0" \
  -H "Accept-Version: 1.0.0"
```

#### JavaScript Example

```javascript
const response = await fetch(
  'https://api.stellar-price-oracle.example.com/api/prices/BTC/USD/history?limit=50&offset=0',
  { headers: { 'Accept-Version': '1.0.0' } }
)
const { pair, history } = await response.json()
console.log(`${pair} history (${history.length} entries):`, history)
```

#### Pagination Example

```javascript
async function* getHistoryPages(pair, pageSize = 100) {
  let offset = 0
  while (true) {
    const res = await fetch(
      `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}/history?limit=${pageSize}&offset=${offset}`,
      { headers: { 'Accept-Version': '1.0.0' } }
    )
    const { history } = await res.json()
    if (history.length === 0) break
    yield history
    offset += pageSize
  }
}

// Usage
for await (const page of getHistoryPages('BTC/USD')) {
  console.log(`Fetched ${page.length} entries`)
}
```

---

### 4. Get Price History (Batch)

Fetch price history for multiple asset pairs in a single request (more efficient than multiple individual requests).

```http
POST /api/prices/history/batch
```

#### Request Body

```json
{
  "pairs": ["BTC/USD", "ETH/USD", "XLM/USD"]
}
```

#### Query Parameters (Optional)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Records per pair (max 500) |
| `offset` | integer | 0 | Pagination offset |

#### Response

```json
[
  {
    "pair": "BTC/USD",
    "history": [
      {
        "price": 42800.00,
        "timestamp": 1693485600000,
        "confidence": 0.97,
        "sources": ["chainlink", "redstone"]
      }
    ]
  },
  {
    "pair": "ETH/USD",
    "history": [
      {
        "price": 2140.50,
        "timestamp": 1693485600000,
        "confidence": 0.96,
        "sources": ["chainlink", "band"]
      }
    ]
  }
]
```

#### HTTP Example

```bash
curl -X POST "https://api.stellar-price-oracle.example.com/api/prices/history/batch" \
  -H "Accept-Version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": ["BTC/USD", "ETH/USD"]
  }'
```

#### JavaScript Example

```javascript
const response = await fetch(
  'https://api.stellar-price-oracle.example.com/api/prices/history/batch',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Version': '1.0.0'
    },
    body: JSON.stringify({ pairs: ['BTC/USD', 'ETH/USD', 'XLM/USD'] })
  }
)
const historyData = await response.json()
console.log(historyData)
```

#### Python Example

```python
import requests

response = requests.post(
    'https://api.stellar-price-oracle.example.com/api/prices/history/batch',
    headers={
        'Content-Type': 'application/json',
        'Accept-Version': '1.0.0'
    },
    json={'pairs': ['BTC/USD', 'ETH/USD']}
)
history_data = response.json()
print(history_data)
```

---

### 5. Health Check

Check API server status and uptime.

```http
GET /health
```

#### Response

```json
{
  "status": "healthy",
  "uptime": 123456
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Server status: `healthy`, `degraded`, `unhealthy` |
| `uptime` | number | Server uptime in seconds |

#### HTTP Example

```bash
curl -X GET "https://api.stellar-price-oracle.example.com/health"
```

#### Monitoring

Use this endpoint for health checks and monitoring:

```javascript
setInterval(async () => {
  try {
    const response = await fetch('https://api.stellar-price-oracle.example.com/health')
    const { status, uptime } = await response.json()
    console.log(`API Status: ${status} (uptime: ${uptime}s)`)
  } catch (error) {
    console.error('API health check failed:', error)
  }
}, 30000) // Every 30 seconds
```

---

## WebSocket Endpoint

Subscribe to real-time price updates via WebSocket.

```
wss://api.stellar-price-oracle.example.com/ws
```

### Connection Setup

```javascript
const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')

ws.onopen = () => {
  console.log('Connected to price feed')
  // Subscribe to asset pairs
  ws.send(JSON.stringify({
    action: 'subscribe',
    assetPairs: ['BTC/USD', 'ETH/USD']
  }))
}

ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  console.log(`Price update: ${update.assetPair} = $${update.price}`)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('Disconnected from price feed')
}
```

### Message Types

#### Subscribe Message

Subscribe to real-time updates for specific asset pairs.

```json
{
  "action": "subscribe",
  "assetPairs": ["BTC/USD", "ETH/USD", "XLM/USD"]
}
```

#### Unsubscribe Message

Unsubscribe from asset pairs.

```json
{
  "action": "unsubscribe",
  "assetPairs": ["BTC/USD"]
}
```

#### Price Update (Server → Client)

Received when a price changes.

```json
{
  "type": "price_update",
  "assetPair": "BTC/USD",
  "price": 43250.50,
  "timestamp": 1693489200000,
  "confidence": 0.98,
  "sources": ["chainlink", "redstone", "band"]
}
```

### WebSocket Features

- ✅ **Automatic reconnection** — Client should implement exponential backoff
- ✅ **Heartbeat** — Server sends periodic keepalive messages
- ✅ **Message ordering** — Prices include monotonic `seq` field for duplicate detection
- ✅ **Compression** — Messages may be gzip-compressed

### Example: Full Connection Lifecycle

```javascript
class PriceFeedClient {
  constructor(url = 'wss://api.stellar-price-oracle.example.com/ws') {
    this.url = url
    this.ws = null
    this.handlers = new Set()
    this.subscribedPairs = new Set()
    this.reconnectAttempt = 0
    this.maxRetries = 20
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => this.onOpen()
      this.ws.onmessage = (event) => this.onMessage(event)
      this.ws.onerror = (error) => this.onError(error)
      this.ws.onclose = () => this.onClose()
    } catch (error) {
      console.error('Connection failed:', error)
      this.scheduleReconnect()
    }
  }

  onOpen() {
    console.log('Connected to price feed')
    this.reconnectAttempt = 0
    
    // Re-subscribe to previously subscribed pairs
    if (this.subscribedPairs.size > 0) {
      this.subscribe([...this.subscribedPairs])
    }
  }

  onMessage(event) {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'price_update') {
        this.handlers.forEach(handler => handler(msg))
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  onError(error) {
    console.error('WebSocket error:', error)
  }

  onClose() {
    console.log('Disconnected from price feed')
    this.scheduleReconnect()
  }

  subscribe(pairs) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        assetPairs: pairs
      }))
      pairs.forEach(p => this.subscribedPairs.add(p))
    }
  }

  unsubscribe(pairs) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'unsubscribe',
        assetPairs: pairs
      }))
      pairs.forEach(p => this.subscribedPairs.delete(p))
    }
  }

  onPriceUpdate(handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  scheduleReconnect() {
    if (this.reconnectAttempt >= this.maxRetries) {
      console.error('Max reconnection attempts reached')
      return
    }

    const delay = Math.random() * Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000)
    this.reconnectAttempt++
    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt}/${this.maxRetries})`)
    
    setTimeout(() => this.connect(), delay)
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.subscribedPairs.clear()
  }
}

// Usage
const client = new PriceFeedClient()
client.onPriceUpdate((update) => {
  console.log(`${update.assetPair}: $${update.price}`)
})

client.subscribe(['BTC/USD', 'ETH/USD'])
client.connect()

// Later: unsubscribe and disconnect
client.unsubscribe(['BTC/USD'])
client.disconnect()
```

---

## Data Models

### PriceData

The core price snapshot.

```typescript
interface PriceData {
  assetPair: string    // e.g., "BTC/USD"
  price: number        // Aggregated price
  timestamp: number    // Unix timestamp (milliseconds)
  confidence: number   // 0.0 (no confidence) to 1.0 (certain)
  sources: string[]    // ["chainlink", "redstone", "band", "reflector"]
}
```

**Confidence Score:**
- `0.0–0.3`: Low confidence (use with caution)
- `0.3–0.7`: Medium confidence (typical)
- `0.7–1.0`: High confidence (recommended)

### PriceHistoryEntry

A single historical price point.

```typescript
interface PriceHistoryEntry {
  price: number        // Price at this timestamp
  timestamp: number    // Unix timestamp (milliseconds)
  confidence: number   // Confidence at this point
  sources: string[]    // Sources active at this time
}
```

### PriceHistoryResponse

Paginated history for one pair.

```typescript
interface PriceHistoryResponse {
  pair: string                    // Asset pair
  history: PriceHistoryEntry[]    // Ordered entries (oldest first)
}
```

### WsPriceUpdate

Real-time price update from WebSocket.

```typescript
interface WsPriceUpdate {
  type: 'price_update'
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
  seq?: number        // Optional: monotonic sequence number
}
```

---

## Examples

### Example 1: Display Current BTC Price

```javascript
async function getCurrentBtcPrice() {
  try {
    const response = await fetch(
      'https://api.stellar-price-oracle.example.com/api/prices/BTC/USD',
      { headers: { 'Accept-Version': '1.0.0' } }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const price = await response.json()
    console.log(`BTC/USD: $${price.price}`)
    console.log(`Confidence: ${(price.confidence * 100).toFixed(1)}%`)
    console.log(`Sources: ${price.sources.join(', ')}`)
    
    return price
  } catch (error) {
    console.error('Failed to fetch price:', error)
  }
}
```

### Example 2: Build a Price Chart

```javascript
async function buildPriceChart(pair) {
  const limit = 100
  let offset = 0
  let allHistory = []

  while (true) {
    const response = await fetch(
      `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`,
      { headers: { 'Accept-Version': '1.0.0' } }
    )
    const { history } = await response.json()
    
    if (history.length === 0) break
    
    allHistory = [...history, ...allHistory] // Prepend for chronological order
    offset += limit
    
    if (history.length < limit) break // Last page
  }

  return allHistory.map(entry => ({
    date: new Date(entry.timestamp),
    price: entry.price,
    confidence: entry.confidence
  }))
}

// Usage
const chartData = await buildPriceChart('BTC/USD')
console.log(`${chartData.length} price points retrieved`)
```

### Example 3: Real-Time Price Monitor with Fallback

```javascript
class PriceMonitor {
  constructor(pairs, restInterval = 10000) {
    this.pairs = pairs
    this.restInterval = restInterval
    this.prices = new Map()
    this.ws = null
    this.restTimer = null
  }

  async start() {
    // Try WebSocket first
    this.connectWebSocket()
    
    // Fallback to REST polling if WebSocket fails
    await this.pollRest()
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
      
      this.ws.onopen = () => {
        console.log('Connected to WebSocket')
        this.ws.send(JSON.stringify({
          action: 'subscribe',
          assetPairs: this.pairs
        }))
        
        // Clear REST polling since WebSocket is active
        clearInterval(this.restTimer)
      }
      
      this.ws.onmessage = (event) => {
        const update = JSON.parse(event.data)
        if (update.type === 'price_update') {
          this.prices.set(update.assetPair, update)
          this.onPriceUpdate(update)
        }
      }
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, falling back to REST')
        this.pollRest()
      }
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.pollRest()
    }
  }

  async pollRest() {
    this.restTimer = setInterval(async () => {
      try {
        const params = `?pairs=${this.pairs.join(',')}`
        const response = await fetch(
          `https://api.stellar-price-oracle.example.com/api/prices${params}`,
          { headers: { 'Accept-Version': '1.0.0' } }
        )
        const prices = await response.json()
        prices.forEach(p => {
          this.prices.set(p.assetPair, p)
          this.onPriceUpdate(p)
        })
      } catch (error) {
        console.error('REST poll failed:', error)
      }
    }, this.restInterval)
  }

  onPriceUpdate(price) {
    // Override in subclass or pass callback
    console.log(`Updated: ${price.assetPair} = $${price.price}`)
  }

  stop() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    clearInterval(this.restTimer)
  }
}

// Usage
const monitor = new PriceMonitor(['BTC/USD', 'ETH/USD'])
monitor.start()
```

---

## SDKs & Libraries

### Official SDKs

| Language | Repository | Status |
|----------|-----------|--------|
| JavaScript/TypeScript | `stellar-oracle/sdk-js` | Active |
| Python | `stellar-oracle/sdk-python` | Active |
| Go | `stellar-oracle/sdk-go` | Active |
| Rust | `stellar-oracle/sdk-rust` | Active |

### Community Libraries

- **Node.js**: `stellar-price-oracle` (npm)
- **Python**: `stellar-oracle` (PyPI)
- **Go**: `github.com/stellar-oracle/go-client`

### Integration Examples

#### Node.js with TypeScript

```typescript
import { PriceOracleClient } from '@stellar-oracle/sdk-js'

const client = new PriceOracleClient('https://api.stellar-price-oracle.example.com')

// Get current price
const btcPrice = await client.getPrice('BTC/USD')
console.log(`BTC: $${btcPrice.price}`)

// Get price history
const history = await client.getPriceHistory('BTC/USD', { limit: 100 })
console.log(`Retrieved ${history.length} historical entries`)

// Subscribe to real-time updates
client.subscribe(['BTC/USD', 'ETH/USD'], (update) => {
  console.log(`${update.assetPair}: $${update.price}`)
})
```

#### Python

```python
from stellar_oracle import PriceOracleClient

client = PriceOracleClient('https://api.stellar-price-oracle.example.com')

# Get current price
btc_price = client.get_price('BTC/USD')
print(f"BTC: ${btc_price['price']}")

# Get price history
history = client.get_price_history('BTC/USD', limit=100)
print(f"Retrieved {len(history)} historical entries")

# Batch history
batch = client.get_history_batch(['BTC/USD', 'ETH/USD'])
for pair_history in batch:
    print(f"{pair_history['pair']}: {len(pair_history['history'])} entries")
```

---

## Appendix: Troubleshooting

### Common Issues

#### 429 Rate Limited

**Problem:** API returns 429 Too Many Requests

**Solution:**
1. Check `X-RateLimit-Remaining` header
2. Wait until `X-RateLimit-Reset` timestamp
3. Implement exponential backoff with jitter
4. Batch requests when possible (use `/api/prices/history/batch`)

#### 404 Not Found

**Problem:** Asset pair returns 404

**Solution:**
1. Verify pair format (e.g., `BTC/USD`, not `bitcoin/usd`)
2. Confirm pair is tracked by the oracle
3. Use `/api/prices` to list all available pairs

#### WebSocket Connection Drops

**Problem:** WebSocket frequently disconnects

**Solution:**
1. Check network stability
2. Implement reconnection with exponential backoff
3. Monitor heartbeat timeouts
4. Consider fallback to REST polling

#### Stale Price Data

**Problem:** Prices seem outdated

**Solution:**
1. Check `timestamp` field for recency
2. Monitor `confidence` score (low confidence may indicate data staleness)
3. Check multiple sources in `sources` array
4. Consider using WebSocket for real-time updates

---

## Support

For questions or issues:

- **Documentation**: https://stellar-oracle-docs.example.com
- **Issues**: https://github.com/stellar-oracle/issues
- **Email**: support@stellar-oracle.example.com
- **Discord**: https://discord.gg/stellar-oracle

---

**Last Updated:** 2026-08-26  
**API Version:** 1.0.0  
**Status:** Production Ready ✅
