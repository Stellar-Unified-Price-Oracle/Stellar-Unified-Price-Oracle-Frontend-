# Stellar Price Oracle API — Error Reference

## Overview

All error responses follow a consistent JSON format. This document details all possible error codes, their meanings, and recommended handling strategies.

---

## Error Response Format

All error responses return JSON with the following structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 400
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code for programmatic handling |
| `message` | string | Human-readable error description |
| `status` | integer | HTTP status code |

---

## HTTP Status Codes

### 2xx Success

| Status | Meaning | Retry? |
|--------|---------|--------|
| **200 OK** | Request succeeded; response in body | No |

### 4xx Client Errors

| Status | Meaning | Retry? | Common Cause |
|--------|---------|--------|--------------|
| **400 Bad Request** | Invalid request parameters | No | Malformed query, invalid pair format |
| **404 Not Found** | Resource doesn't exist | No | Non-existent asset pair |
| **406 Not Acceptable** | Incompatible API version | No | Client version too old |
| **409 Conflict** | API version conflict | No | Client version incompatible with server |
| **429 Too Many Requests** | Rate limit exceeded | **Yes** | Too many requests in window |

### 5xx Server Errors

| Status | Meaning | Retry? | Common Cause |
|--------|---------|--------|--------------|
| **500 Internal Server Error** | Server error | **Yes** | Temporary server issue |
| **502 Bad Gateway** | Upstream service failed | **Yes** | Backend service down |
| **503 Service Unavailable** | Server maintenance/overload | **Yes** | Server overloaded or maintenance |

---

## Error Codes

### `BAD_REQUEST` (400)

**Cause:** Invalid request parameters or malformed input.

**Common Scenarios:**

1. **Invalid pair format**
   ```json
   {
     "error": {
       "code": "BAD_REQUEST",
       "message": "Invalid asset pair format. Expected format: 'BASE/QUOTE' (e.g., 'BTC/USD')",
       "status": 400
     }
   }
   ```
   **Solution:** Use format `BASE/QUOTE` (e.g., `BTC/USD`, `ETH/EUR`)

2. **Invalid query parameters**
   ```json
   {
     "error": {
       "code": "BAD_REQUEST",
       "message": "limit must be between 1 and 500",
       "status": 400
     }
   }
   ```
   **Solution:** Ensure `limit` is 1–500 and `offset` is non-negative

3. **Missing required field**
   ```json
   {
     "error": {
       "code": "BAD_REQUEST",
       "message": "Request body must contain 'pairs' field",
       "status": 400
     }
   }
   ```
   **Solution:** Ensure POST body includes `pairs: []`

### `NOT_FOUND` (404)

**Cause:** Asset pair is not tracked by the oracle.

**Response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Asset pair 'XYZ/USD' not found. Check /api/prices for available pairs",
    "status": 404
  }
}
```

**Solution:**
1. Verify pair format is correct
2. Query `/api/prices` to list all available pairs
3. Confirm pair is actively tracked

### `RATE_LIMITED` (429)

**Cause:** Too many requests in a time window.

**Response:**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. 100 requests per minute allowed.",
    "status": 429
  }
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1693489300
```

**Solution:**
1. **Wait until reset:** Use `X-RateLimit-Reset` timestamp
2. **Implement backoff:** Use exponential backoff with jitter:
   ```javascript
   const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
   await sleep(delay)
   ```
3. **Batch requests:** Use `/api/prices/history/batch` instead of individual requests
4. **Cache results:** Store prices locally to reduce API calls

**Example Handling:**

```javascript
async function fetchWithRetry(url, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url)
    
    if (response.ok) {
      return response.json()
    }
    
    if (response.status === 429) {
      const resetTime = parseInt(response.headers.get('X-RateLimit-Reset'))
      const now = Math.floor(Date.now() / 1000)
      const waitSeconds = Math.max(resetTime - now, 0)
      
      console.log(`Rate limited. Waiting ${waitSeconds}s...`)
      await sleep(waitSeconds * 1000)
      continue
    }
    
    if (response.status >= 500) {
      if (attempt < maxAttempts - 1) {
        const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
        await sleep(delay)
        continue
      }
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### `API_VERSION_MISMATCH` (406)

**Cause:** Client requested an incompatible API version.

**Response:**
```json
{
  "error": {
    "code": "API_VERSION_MISMATCH",
    "message": "API version mismatch: server is at v1.1.0, client requested v1.0.0. Please update the frontend or backend to a compatible version.",
    "status": 406
  }
}
```

**Headers:**
```
X-API-Version: 1.1.0
```

**Solution:**
1. Update client library to match server version
2. Check `X-API-Version` header for server version
3. Implement version negotiation header: `Accept-Version: 1.0.0`

### `SERVER_ERROR` (500)

**Cause:** Internal server error.

**Response:**
```json
{
  "error": {
    "code": "SERVER_ERROR",
    "message": "Internal server error",
    "status": 500
  }
}
```

**Solution:**
1. **Retry with backoff:** Server errors are typically transient
2. **Check status page:** Visit https://status.stellar-oracle.example.com
3. **Contact support:** If errors persist, reach out to support

### `UNKNOWN_ERROR` (Varies)

**Cause:** Unexpected error not covered by specific codes.

**Response:**
```json
{
  "error": {
    "code": "UNKNOWN_ERROR",
    "message": "An unexpected error occurred",
    "status": 500
  }
}
```

**Solution:** Log error details and contact support.

---

## Error Handling Best Practices

### 1. Implement Exponential Backoff

```javascript
async function apiCall(url, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      
      // Success
      if (response.ok) {
        return response.json()
      }
      
      // Client error — don't retry
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json()
        throw new Error(`${error.error.code}: ${error.error.message}`)
      }
      
      // Server error — retry
      if (response.status >= 500) {
        if (attempt < maxAttempts - 1) {
          const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
          await sleep(delay)
          continue
        }
      }
      
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error
      
      const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 30000)
      console.error(`Attempt ${attempt + 1} failed:`, error.message)
      await sleep(delay)
    }
  }
}
```

### 2. Handle Rate Limiting

```javascript
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.retryAfter = null
  }

  async fetch(endpoint) {
    if (this.retryAfter && Date.now() < this.retryAfter) {
      const waitMs = this.retryAfter - Date.now()
      console.log(`Rate limited. Waiting ${waitMs}ms...`)
      await sleep(waitMs)
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`)

    if (response.status === 429) {
      const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000
      this.retryAfter = resetTime
      throw new Error('Rate limited')
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return response.json()
  }
}
```

### 3. Validate Input Before Requesting

```javascript
function validatePair(pair) {
  // Must be BASE/QUOTE format
  if (!/^[A-Z]+\/[A-Z]+$/.test(pair)) {
    throw new Error(`Invalid pair format: ${pair}. Expected format: BASE/QUOTE`)
  }
  return true
}

function validateLimit(limit) {
  const num = parseInt(limit, 10)
  if (num < 1 || num > 500) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and 500`)
  }
  return true
}

async function getPriceHistory(pair, limit = 100) {
  validatePair(pair)
  validateLimit(limit)
  
  const url = `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}`
  return fetch(url).then(r => r.json())
}
```

### 4. Graceful Fallback Strategy

```javascript
class PriceClient {
  async getPriceWithFallback(pair) {
    try {
      // Try WebSocket first (real-time)
      if (this.ws?.readyState === WebSocket.OPEN) {
        return this.cachedPrices.get(pair)
      }
    } catch (error) {
      console.warn('WebSocket unavailable, falling back to REST')
    }

    try {
      // Fallback to REST
      const response = await fetch(
        `https://api.stellar-price-oracle.example.com/api/prices/${encodeURIComponent(pair)}`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      return response.json()
    } catch (error) {
      console.error('REST call failed:', error)
      
      // Last resort: use cached value
      return this.cachedPrices.get(pair) || null
    }
  }
}
```

### 5. Implement Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(threshold = 5, resetMs = 30000) {
    this.failureCount = 0
    this.threshold = threshold
    this.resetMs = resetMs
    this.state = 'closed' // closed, open, half-open
    this.lastFailureTime = null
  }

  canRequest() {
    if (this.state === 'closed') return true
    
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed > this.resetMs) {
        this.state = 'half-open'
        return true
      }
      return false
    }
    
    return this.state === 'half-open'
  }

  recordSuccess() {
    this.failureCount = 0
    this.state = 'closed'
  }

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open'
    }
  }
}
```

---

## Debugging Errors

### Enable Verbose Logging

```javascript
// Intercept all fetch calls to log requests/responses
const originalFetch = window.fetch
window.fetch = async (...args) => {
  console.log('→ Request:', args[0], args[1])
  
  const response = await originalFetch(...args)
  
  if (!response.ok) {
    const body = await response.clone().json().catch(() => null)
    console.error('← Error:', response.status, body)
  }
  
  return response
}
```

### Log Rate Limit Status

```javascript
async function logRateLimitStatus(endpoint) {
  const response = await fetch(endpoint)
  
  const headers = {
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: response.headers.get('X-RateLimit-Reset')
  }
  
  console.table(headers)
  return response
}
```

### Test Error Scenarios

```javascript
// Test rate limiting
async function testRateLimit() {
  let successCount = 0
  let rateLimitCount = 0
  
  for (let i = 0; i < 150; i++) {
    const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices')
    
    if (response.ok) {
      successCount++
    } else if (response.status === 429) {
      rateLimitCount++
    }
  }
  
  console.log(`Success: ${successCount}, Rate limited: ${rateLimitCount}`)
}

// Test error recovery
async function testErrorRecovery() {
  try {
    const response = await fetch('https://api.stellar-price-oracle.example.com/api/prices/INVALID')
    const error = await response.json()
    console.log('Error response:', error)
  } catch (error) {
    console.error('Network error:', error)
  }
}
```

---

## Support

For help with errors:

- **Status Page:** https://status.stellar-oracle.example.com
- **Documentation:** https://docs.stellar-oracle.example.com
- **Email Support:** support@stellar-oracle.example.com
- **Issue Tracker:** https://github.com/stellar-oracle/issues
- **Discord Community:** https://discord.gg/stellar-oracle

---

**Last Updated:** 2026-08-26  
**API Version:** 1.0.0
