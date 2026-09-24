# Local HTTPS Setup Guide

This guide explains how to set up HTTPS for local development on your machine.

## Why HTTPS for Local Development?

Several web APIs require HTTPS in production and are disabled on HTTP in most browsers:

- **Service Workers** — Offline support, PWA features, caching
- **Geolocation API** — Location data from browser
- **Secure WebSocket (wss)** — Encrypted WebSocket connections
- **Clipboard API** — Copy/paste access
- **Camera/Microphone** — getUserMedia()
- **Payment Request API** — Payment processing
- **Credential Management** — Password managers

Even on localhost, these APIs are restricted unless you use HTTPS.

## Quick Start

### Step 1: Install mkcert

**macOS (Homebrew):**
```bash
brew install mkcert
brew install nss  # Required for Firefox support
```

**Windows (Chocolatey):**
```bash
choco install mkcert
```

Or download from: https://github.com/FiloSottile/mkcert/releases

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install mkcert
```

Or see: https://github.com/FiloSottile/mkcert#installation

### Step 2: Generate Certificates

```bash
npm run setup-https
```

This script:
1. Checks if mkcert is installed
2. Creates a local Certificate Authority (one-time)
3. Generates certificates for localhost
4. Stores them in `.vite-certs/` (gitignored)

Output:
```
✓ Setting up local HTTPS certificates
✓ Local CA created/verified
✓ Generating certificates for localhost
✓ Certificates generated successfully

✓ You can now use HTTPS for local development!

Usage:
  npm run dev:https    # Start dev server with HTTPS
  npm run dev          # Start normal HTTP dev server
```

### Step 3: Run Dev Server with HTTPS

```bash
npm run dev:https
```

Server will start at `https://localhost:5173`

**Trust the certificate:** Your browser might show a warning ("Your connection is not secure"). This is expected—click "Advanced" and "Proceed to localhost" to trust the local certificate.

## Using HTTPS

### npm Scripts

```bash
# Start with HTTPS
npm run dev:https

# Start with HTTP (default)
npm run dev

# Or manually enable with environment variables
HTTPS=true npm run dev
VITE_HTTPS=true npm run dev
```

### WebSocket URLs

When using HTTPS, update WebSocket connections:

```typescript
// HTTP (not secure, won't work with Service Workers)
const ws = new WebSocket('ws://localhost:3000/ws')

// HTTPS (secure, works with Service Workers)
const ws = new WebSocket('wss://localhost:3000/ws')
```

The frontend automatically adjusts based on the protocol:

```typescript
// src/api/websocket.ts (already handles this)
const protocol = import.meta.env.VITE_WS_URL.startsWith('wss://')
  ? 'wss'
  : 'ws'
```

## Troubleshooting

### Certificate Generation Failed

**Problem:** `mkcert: command not found`

**Solution:** Install mkcert (see "Install mkcert" section above)

---

**Problem:** `mkcert -install` fails with permission error

**Solution:** This creates a local Certificate Authority. You might need elevated permissions:

```bash
# macOS/Linux
sudo node scripts/setup-https.js

# Windows (run as Administrator)
node scripts/setup-https.js
```

After running once, subsequent runs don't need sudo.

### "Your connection is not private" Warning

This is expected with a locally-generated certificate. The connection is secure (encrypted), just not verified by a public authority.

**To trust the certificate:**

1. **Chrome/Edge:**
   - Click "Advanced"
   - Click "Proceed to localhost (unsafe)"
   - Or install the CA: See "Installing the CA" section below

2. **Firefox:**
   - Click "Advanced"
   - Click "Accept the Risk and Continue"
   - Or install the CA: See "Installing the CA" section below

3. **Safari:**
   - Click "Show Details"
   - Click "Visit this website"
   - Or install the CA: See "Installing the CA" section below

### Installing the CA Certificate

To avoid the browser warning every time, install the local CA:

**macOS:**
```bash
# The CA is usually already installed by mkcert
# If not:
mkcert -install
```

Then trust it in System Preferences:
1. Keychain Access → Certificates
2. Find "mkcert" certificate
3. Double-click → Trust → Always Trust

**Windows:**
```bash
# mkcert -install usually handles this
# If still getting warnings:
certutil -addstore "Root" "C:\Users\YourUser\AppData\Local\mkcert\rootCA.pem"
```

**Linux (Chrome/Chromium):**
```bash
# Copy CA to certificate store
sudo cp ~/.local/share/mkcert/rootCA.pem /usr/local/share/ca-certificates/mkcert.crt
sudo update-ca-certificates

# Or manually trust in browser settings:
# Settings → Security → Manage certificates → Authorities → Import
```

**Firefox (all platforms):**
1. Settings → Privacy & Security → Certificates
2. View Certificates → Authorities
3. Import: `~/.local/share/mkcert/rootCA.pem` (or similar)

### Mixed Content Warning

**Problem:** `Mixed Content: The page was loaded over HTTPS, but requested an insecure resource`

**Cause:** Frontend is HTTPS but backend is HTTP

**Solution:** Use HTTPS backend, or configure proxy to upgrade:

```bash
# Start frontend with HTTPS and HTTP backend
HTTPS=true npm run dev
```

The proxy will handle HTTP → HTTPS if needed.

### Certificates Expired

Certificates generated by mkcert don't expire for 10 years, but if they do:

```bash
# Delete old certificates
rm -rf .vite-certs/

# Regenerate
npm run setup-https
```

### Service Worker Not Loading

**Problem:** Service Worker fails to register with message like "Document is not https"

**Solution:** 
1. Use `npm run dev:https` (not `npm run dev`)
2. Verify browser shows `https://` in address bar
3. Check console for mixed content warnings

### Geolocation Not Working

**Problem:** Geolocation API returns permission denied

**Cause:** HTTPS is required; also needs explicit browser permission

**Solution:**
1. Use HTTPS: `npm run dev:https`
2. Grant permission when browser prompts
3. Check browser permissions:
   - Chrome: Settings → Privacy → Site Settings → Location
   - Firefox: about:preferences → Privacy → Permissions → Location

### WebSocket Connection Fails

**Problem:** WebSocket connection to `wss://localhost:3000` fails

**Cause:** Backend might not support WSS (secure WebSocket)

**Solution:**
1. Verify backend supports `wss://`
2. Check proxy configuration
3. For testing, you can disable certificate validation (development only):

```typescript
// NOT for production!
if (import.meta.env.DEV) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}
```

## File Locations

Certificates are stored in `.vite-certs/`:

```
.vite-certs/
├── localhost.crt    # Certificate (public)
└── localhost.key    # Private key (keep secret!)
```

These files are in `.gitignore` and not committed.

Local CA is stored in system location:

```
macOS:           ~/Library/Application Support/mkcert/
Windows:         C:\Users\YourUser\AppData\Local\mkcert\
Linux:           ~/.local/share/mkcert/
```

## Environment Variables

Control HTTPS behavior with environment variables:

```bash
# Enable HTTPS
HTTPS=true npm run dev
VITE_HTTPS=true npm run dev

# Change port (default 5173)
VITE_PORT=3000 npm run dev:https

# Change backend URLs
VITE_API_URL=https://localhost:3000 npm run dev:https
VITE_WS_URL=wss://localhost:3000 npm run dev:https
```

## Testing Features that Require HTTPS

### Service Workers

```typescript
// Requires HTTPS in production, works on localhost HTTP
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

Test with:
```bash
npm run dev:https
# Then enable in DevTools → Application → Service Workers
```

### Geolocation

```typescript
navigator.geolocation.getCurrentPosition(
  (position) => {
    console.log(position.coords.latitude, position.coords.longitude)
  },
  (error) => {
    console.error(error.message)
  },
)
```

Test with:
```bash
npm run dev:https
# Browser will prompt for permission
```

### Secure WebSocket

```typescript
const ws = new WebSocket('wss://localhost:3000/ws')
ws.onmessage = (event) => {
  console.log(event.data)
}
```

Test with:
```bash
npm run dev:https
VITE_WS_URL=wss://localhost:3000 npm run dev:https
```

## Performance Impact

HTTPS has minimal performance impact on localhost:

- **Handshake:** ~50-100ms (one-time per session)
- **Per-request overhead:** <1ms
- **Overall:** Negligible for development

HMR and development experience are unaffected.

## Security Notes

⚠️ **Certificates in this setup are for DEVELOPMENT ONLY**

- Local CA is trusted only on your machine
- Certificates expire in 10 years but are not production-grade
- Private keys are stored locally (not secure for shared environments)
- Never use these for production

For production, use proper certificates from:
- Let's Encrypt (free)
- Dedicated certificate provider
- Your organization's certificate authority

## Related Documentation

- [Vite HTTPS Configuration](https://vitejs.dev/config/server-options.html#server-https)
- [mkcert Documentation](https://github.com/FiloSottile/mkcert)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Secure WebSocket (WSS)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
