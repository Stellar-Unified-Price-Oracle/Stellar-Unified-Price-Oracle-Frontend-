# Developer's Quick Reference — Stellar Price Oracle API

**Your complete guide to getting started with the Stellar Price Oracle API**

---

## 🚀 Start Here: 3 Simple Steps

### Step 1: Choose Your Integration Method (30 seconds)

```
Need real-time updates?        → Use WebSocket
Getting data for dashboards?   → Use REST API
Building trading app?          → Use WebSocket + REST fallback
```

### Step 2: Pick Your Language (1 minute)

```bash
# JavaScript/TypeScript
npm install @stellar-oracle/sdk-js

# Python
pip install stellar-oracle

# Go
go get github.com/stellar-oracle/sdk-go

# Rust
cargo add stellar-oracle

# No SDK? Use native HTTP
# (curl, fetch, requests, etc.)
```

### Step 3: Copy Code & Adapt (2 minutes)

```javascript
// Get current BTC price
const response = await fetch(
  'https://api.stellar-price-oracle.example.com/api/prices/BTC/USD'
)
const { price, confidence } = await response.json()
console.log(`BTC: $${price} (${confidence * 100}% confidence)`)
```

---

## 📚 Complete Documentation Map

### For Different Audiences

```
┌─────────────────────────────────────────┐
│  Developers (Start Here)                │
├─────────────────────────────────────────┤
│  • Read: docs/README.md (5 min)        │
│  • Try: docs/QUICKSTART.md (10 min)    │
│  • Reference: docs/API.md (ongoing)    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  DevOps/Operations                      │
├─────────────────────────────────────────┤
│  • Setup: docs/API.md § Health Check   │
│  • Monitor: Error handling strategies   │
│  • Debug: docs/ERRORS.md               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Backend Engineers                      │
├─────────────────────────────────────────┤
│  • Reference: docs/API.md              │
│  • Schema: docs/openapi.yaml           │
│  • Errors: docs/ERRORS.md              │
│  • Examples: docs/QUICKSTART.md        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Integration/Tools                      │
├─────────────────────────────────────────┤
│  • Postman: Import docs/openapi.yaml   │
│  • Swagger UI: Use openapi.yaml        │
│  • ReDoc: Render openapi.yaml          │
└─────────────────────────────────────────┘
```

---

## 🎯 Quick API Reference

### All 5 Endpoints at a Glance

| Endpoint | Method | Purpose | Limits |
|----------|--------|---------|--------|
| `/api/prices` | GET | All prices | 100/min |
| `/api/prices/:pair` | GET | Single price | 100/min |
| `/api/prices/:pair/history` | GET | Price history | 100/min, max 500 entries |
| `/api/prices/history/batch` | POST | Batch history | 100/min, max 20 pairs |
| `/health` | GET | API status | No limit |

### WebSocket

```
URL: wss://api.stellar-price-oracle.example.com/ws
Subscribe: {"action": "subscribe", "assetPairs": ["BTC/USD"]}
Update: {"type": "price_update", "assetPair": "BTC/USD", "price": 43250, ...}
```

---

## 💻 Code Snippets (Copy & Paste Ready)

### JavaScript: Get Current Price

```javascript
async function getPrice(pair) {
  const res = await fetch(
    `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}`
  )
  return res.json()
}

// Use it
const btc = await getPrice('BTC/USD')
console.log(`BTC: $${btc.price}`)
```

### JavaScript: Real-Time Stream

```javascript
function streamPrices(pairs) {
  const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ action: 'subscribe', assetPairs: pairs }))
  }
  
  ws.onmessage = (e) => {
    const { assetPair, price } = JSON.parse(e.data)
    console.log(`${assetPair}: $${price}`)
  }
}

// Use it
streamPrices(['BTC/USD', 'ETH/USD'])
```

### Python: Get Price

```python
import requests

response = requests.get(
    'https://api.stellar-price-oracle.example.com/api/prices/BTC/USD'
)
price = response.json()
print(f"BTC: ${price['price']}")
```

### Python: Price History

```python
import requests

response = requests.get(
    'https://api.stellar-price-oracle.example.com/api/prices/BTC/USD/history?limit=100'
)
data = response.json()
print(f"{len(data['history'])} price points")
```

### curl: Get All Prices

```bash
curl -H "Accept-Version: 1.0.0" \
  https://api.stellar-price-oracle.example.com/api/prices
```

### curl: Batch History

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"pairs":["BTC/USD","ETH/USD"]}' \
  https://api.stellar-price-oracle.example.com/api/prices/history/batch
```

---

## ⚠️ Common Issues & Fixes

### "Asset pair not found (404)"

**Problem:** Getting 404 when requesting a price

**Solution:**
1. Check pair format: `BASE/QUOTE` (e.g., `BTC/USD` not `bitcoin/usd`)
2. Query `/api/prices` to see available pairs
3. Use URL encoding: `encodeURIComponent('BTC/USD')`

### "Rate limit exceeded (429)"

**Problem:** Getting 429 Too Many Requests

**Solution:**
1. Check `X-RateLimit-Remaining` header
2. Wait until `X-RateLimit-Reset` timestamp
3. Use WebSocket instead of polling
4. Batch requests: use `/api/prices/history/batch`

### "WebSocket keeps disconnecting"

**Problem:** WebSocket connection drops frequently

**Solution:**
1. Implement reconnection with exponential backoff
2. Check network stability
3. Consider fallback to REST polling

### "Getting stale prices"

**Problem:** Prices seem old or not updating

**Solution:**
1. Check `timestamp` field (should be recent)
2. Check `confidence` score (low = potentially stale)
3. Use WebSocket for real-time
4. Check API health at `/health`

---

## 🔑 Key Concepts

### Confidence Scores
```
0.0–0.3 = Low confidence (be careful)
0.3–0.7 = Medium confidence (typical)
0.7–1.0 = High confidence (recommended)
```

### Oracle Sources
```
chainlink  — Chainlink oracle
redstone   — Redstone oracle
band       — Band Protocol
reflector  — Stellar Reflector
```

### Timestamps
```
Always in milliseconds (not seconds!)
Example: 1693489200000
Convert to date: new Date(1693489200000)
```

### Rate Limits
```
100 requests per minute per IP
X-RateLimit-Limit: 100 (max)
X-RateLimit-Remaining: 95 (left in window)
X-RateLimit-Reset: 1693489300 (Unix timestamp)
```

---

## 📊 Data Models

### PriceData
```json
{
  "assetPair": "BTC/USD",
  "price": 43250.50,
  "timestamp": 1693489200000,
  "confidence": 0.98,
  "sources": ["chainlink", "redstone", "band"]
}
```

### PriceHistoryEntry
```json
{
  "price": 42800.00,
  "timestamp": 1693485600000,
  "confidence": 0.97,
  "sources": ["chainlink", "redstone"]
}
```

### WsPriceUpdate (WebSocket)
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

---

## 🛠️ Error Handling Best Practice

```javascript
async function robustApiCall(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url)
      
      // Success
      if (res.ok) return res.json()
      
      // Don't retry 4xx (except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      // Retry 5xx or 429 with backoff
      if (res.status >= 500 || res.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }
      
      throw new Error(`HTTP ${res.status}`)
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      console.warn(`Attempt ${attempt + 1} failed:`, error.message)
    }
  }
}
```

---

## 📚 Documentation Files

| File | Size | Use Case |
|------|------|----------|
| [docs/README.md](docs/README.md) | 8 KB | Overview & navigation |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | 12 KB | Get started in 5 min |
| [docs/API.md](docs/API.md) | 24 KB | Complete reference |
| [docs/ERRORS.md](docs/ERRORS.md) | 13 KB | Error handling |
| [docs/openapi.yaml](docs/openapi.yaml) | 17 KB | Tool integration |

---

## 🎯 Decision Tree: REST vs WebSocket

```
Are you building a...?

├─ Live trading app
│  └─→ Use WebSocket
│
├─ Dashboard with updates every 5+ seconds
│  └─→ Use WebSocket
│
├─ One-off price lookup
│  └─→ Use REST GET
│
├─ Historical data export
│  └─→ Use REST batch endpoint
│
├─ Price history with charts
│  └─→ Use REST paginated endpoint
│
└─ Mobile app (battery sensitive)
   └─→ Use REST polling (longer intervals)
```

---

## ✅ Production Checklist

Before deploying:

- [ ] Read `docs/API.md` completely
- [ ] Test all error scenarios with `docs/ERRORS.md`
- [ ] Implement rate limit handling
- [ ] Add logging/monitoring
- [ ] Test with real data
- [ ] Implement retry logic
- [ ] Handle WebSocket reconnection
- [ ] Set up health checks
- [ ] Document your integration
- [ ] Load test your app

---

## 📞 Support & Resources

| Resource | URL |
|----------|-----|
| **Documentation** | `/docs/README.md` |
| **Quick Start** | `/docs/QUICKSTART.md` |
| **API Reference** | `/docs/API.md` |
| **Error Guide** | `/docs/ERRORS.md` |
| **OpenAPI Spec** | `/docs/openapi.yaml` |
| **Email Support** | support@stellar-oracle.example.com |
| **Issue Tracker** | github.com/stellar-oracle/issues |
| **Status Page** | status.stellar-oracle.example.com |
| **Discord** | discord.gg/stellar-oracle |

---

## 🎓 Learning Path

### 5-Minute Path (Quickest)
1. Read this file (2 min)
2. Copy a code snippet (2 min)
3. Run it (1 min)

### 1-Hour Path (Comprehensive)
1. [docs/README.md](docs/README.md) (5 min)
2. [docs/QUICKSTART.md](docs/QUICKSTART.md) (15 min)
3. Try 3 code examples (20 min)
4. Read [docs/API.md](docs/API.md) basics (15 min)
5. Plan your integration (5 min)

### Full Deep Dive (2 Hours)
1. All documentation files
2. [docs/openapi.yaml](docs/openapi.yaml) in Postman
3. Build sample app
4. Error handling scenarios
5. Production deployment plan

---

## 🚀 Next Steps

**Right now:**
1. Choose REST or WebSocket above
2. Copy a code snippet from this file
3. Run it

**In 5 minutes:**
1. Read [docs/QUICKSTART.md](docs/QUICKSTART.md)
2. Try more examples

**In 1 hour:**
1. Read [docs/API.md](docs/API.md)
2. Start building

**Before production:**
1. Review [docs/ERRORS.md](docs/ERRORS.md)
2. Implement error handling
3. Run load tests
4. Monitor with `/health`

---

## 📋 Reference Card

### Get Current Price
```javascript
fetch(`https://api.stellar-price-oracle.example.com/api/prices/BTC/USD`).then(r => r.json())
```

### Get All Prices
```javascript
fetch(`https://api.stellar-price-oracle.example.com/api/prices`).then(r => r.json())
```

### Stream Live Prices
```javascript
new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
```

### Get Price History
```javascript
fetch(`https://api.stellar-price-oracle.example.com/api/prices/BTC/USD/history?limit=100`).then(r => r.json())
```

### Check Health
```javascript
fetch(`https://api.stellar-price-oracle.example.com/health`).then(r => r.json())
```

---

**Ready to build?** → Jump to [docs/QUICKSTART.md](docs/QUICKSTART.md) 🚀

**Happy coding! 💪**
