# Stellar Price Oracle API Documentation

Welcome to the Stellar Unified Price Oracle API documentation. This directory contains comprehensive guides for integrating with the Oracle API.

## 📚 Documentation Files

### [QUICKSTART.md](QUICKSTART.md)
**Start here!** Get up and running in 5 minutes with code examples for:
- Installation & setup
- Common tasks (get prices, stream updates, handle errors)
- Use case examples (dashboards, alerts, data export)
- Troubleshooting tips

### [API.md](API.md)
**Complete API reference** featuring:
- Overview & authentication
- Rate limiting & response formats
- REST endpoints with examples (curl, JavaScript, Python)
- WebSocket real-time updates
- Data models & type definitions
- Comprehensive examples
- SDK recommendations

### [ERRORS.md](ERRORS.md)
**Error handling guide** covering:
- HTTP status codes & meanings
- Detailed error code reference
- When to retry vs. when to fail
- Best practices for error handling
- Debugging strategies
- Example implementations

### [openapi.yaml](openapi.yaml)
**OpenAPI 3.0 specification** with:
- Complete endpoint definitions
- Request/response schemas
- Example payloads for every endpoint
- Compatible with Swagger UI, Postman, ReDoc

## 🚀 Quick Navigation

| Goal | Resource |
|------|----------|
| **I want to start now** | [QUICKSTART.md](QUICKSTART.md) |
| **I need complete endpoint reference** | [API.md](API.md) |
| **I'm debugging an error** | [ERRORS.md](ERRORS.md) |
| **I want to import into Postman/Swagger** | [openapi.yaml](openapi.yaml) |

## 📋 API Endpoints Overview

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/prices` | Get latest prices (all pairs) |
| `GET` | `/api/prices/:pair` | Get latest price (single pair) |
| `GET` | `/api/prices/:pair/history` | Get price history (paginated) |
| `POST` | `/api/prices/history/batch` | Get price history (multiple pairs) |
| `GET` | `/health` | Check API health |

### WebSocket Endpoint

| Protocol | Endpoint | Purpose |
|----------|----------|---------|
| `wss://` | `/ws` | Real-time price updates |

## 🔑 Key Features

✅ **No Authentication Required** — Public API, no API keys needed  
✅ **Real-Time Updates** — WebSocket for live price feeds  
✅ **Historical Data** — Paginated history with multiple aggregation sources  
✅ **Rate Limiting** — Clear limits with retry information in headers  
✅ **Multiple Sources** — Chainlink, Redstone, Band, Reflector  
✅ **Version Negotiation** — Built-in API versioning for compatibility  

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

## 🛠️ Common Use Cases

### 1. Get Current Price (3 lines)
```javascript
const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices/BTC/USD')
const price = await response.json()
console.log(`BTC: $${price.price}`)
```

### 2. Stream Live Prices
```javascript
const ws = new WebSocket('wss://api.stellar-price-oracle.example.com/ws')
ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }))
ws.onmessage = e => console.log(JSON.parse(e.data))
```

### 3. Get Price History
```javascript
const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices/BTC/USD/history?limit=100')
const { history } = await response.json()
console.log(`${history.length} price points`)
```

## ⚠️ Rate Limiting

- **Limit:** 100 requests per minute (per IP)
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Retry Status:** `429 Too Many Requests`
- **Strategy:** Exponential backoff with jitter, or use WebSocket for real-time updates

See [ERRORS.md](ERRORS.md) for detailed retry strategies.

## 🔗 Integration Paths

### Path 1: REST API (Simple)
Best for: Dashboards, one-off requests, historical data
- Simple HTTP requests
- No connection management
- Higher request volume (subject to rate limits)

### Path 2: WebSocket (Real-Time)
Best for: Live feeds, trading apps, monitoring
- Persistent connection
- Real-time updates
- Lower request volume
- Automatic fallback to REST recommended

### Path 3: SDK (Convenient)
Best for: Production applications, simplified error handling
- Available: JavaScript/TypeScript, Python, Go, Rust
- Type-safe interfaces
- Built-in retry logic
- See [QUICKSTART.md](QUICKSTART.md) for SDKs

## 📦 SDKs

| Language | Package | Documentation |
|----------|---------|---|
| JavaScript | `@stellar-oracle/sdk-js` | [NPM](https://www.npmjs.com/package/@stellar-oracle/sdk-js) |
| Python | `stellar-oracle` | [PyPI](https://pypi.org/project/stellar-oracle) |
| Go | `github.com/stellar-oracle/sdk-go` | [GitHub](https://github.com/stellar-oracle/sdk-go) |
| Rust | `stellar-oracle` | [Crates.io](https://crates.io/crates/stellar-oracle) |

## 🐛 Debugging

### Check API Status
```
https://status.stellar-oracle.example.com
```

### Common Issues

| Issue | Solution |
|-------|----------|
| **404 Not Found** | Verify pair format (`BASE/QUOTE`), check `/api/prices` for available pairs |
| **429 Rate Limited** | Wait for `X-RateLimit-Reset`, implement exponential backoff, batch requests |
| **WebSocket Drops** | Implement reconnection logic with exponential backoff |
| **Stale Data** | Check `timestamp` field, monitor `confidence` score, use WebSocket |

See [ERRORS.md](ERRORS.md) for comprehensive troubleshooting.

## 📞 Support

- **Docs:** https://stellar-oracle-docs.example.com
- **Status:** https://status.stellar-oracle.example.com
- **Email:** support@stellar-oracle.example.com
- **Issues:** https://github.com/stellar-oracle/issues
- **Discord:** https://discord.gg/stellar-oracle

## 🔄 API Versioning

The API uses header-based versioning:

```http
Accept-Version: 1.0.0
```

- **Compatible versions** — Server responds normally
- **Incompatible version** — Server returns 406 Not Acceptable or 409 Conflict
- **Missing header** — Server defaults to latest stable version

## 📝 Examples

- [JavaScript Fetch](QUICKSTART.md#1-get-current-price)
- [Python Requests](API.md#python-example)
- [WebSocket Real-Time](API.md#websocket-endpoint)
- [Error Handling](ERRORS.md#error-handling-best-practices)
- [Rate Limiting Strategy](ERRORS.md#2-handle-rate-limiting)

## 📊 API Metrics

| Metric | Value |
|--------|-------|
| **Uptime SLA** | 99.9% |
| **Latency (p99)** | <200ms |
| **Rate Limit** | 100 req/min per IP |
| **Max Batch Size** | 20 pairs |
| **Max History Limit** | 500 entries |
| **Data Retention** | 1 year |

## 🎯 Getting Started Checklist

- [ ] Read [QUICKSTART.md](QUICKSTART.md)
- [ ] Try a sample request in your language
- [ ] Review [Error Handling](ERRORS.md)
- [ ] Set up rate limit monitoring
- [ ] For production: Choose SDK or implement retry logic
- [ ] Test with both REST and WebSocket
- [ ] Review security best practices below

## 🔒 Security

- ✅ **No Authentication Required** — API is public and rate-limited per IP
- ✅ **HTTPS Only** — All requests must use HTTPS
- ✅ **WSS for WebSocket** — All WebSocket connections must be encrypted
- ✅ **CORS Enabled** — Browser requests are supported
- ✅ **No PII** — Never send personal data in requests
- ✅ **Validate Input** — Always validate pair format before requesting

## 📄 License

This API documentation is licensed under MIT. The API itself and aggregated price data terms are defined in the service agreement.

---

**Last Updated:** 2026-08-26  
**API Version:** 1.0.0  
**Status:** ✅ Production Ready

**Ready to get started?** → Jump to [QUICKSTART.md](QUICKSTART.md) 🚀
