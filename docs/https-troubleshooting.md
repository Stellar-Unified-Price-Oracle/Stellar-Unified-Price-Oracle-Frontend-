# HTTPS Troubleshooting Guide

Common issues and solutions for local HTTPS development.

## Certificate Issues

### Certificates Not Generated

**Symptoms:**
```
✗ Setup failed: No such file or directory: .vite-certs/localhost.crt
```

**Cause:** `npm run setup-https` hasn't been run

**Solution:**
```bash
npm run setup-https
```

---

### mkcert Not Found

**Symptoms:**
```
✗ mkcert not found
✗ Install instructions shown
```

**Cause:** mkcert is not installed on your system

**Solution:** Follow the installation instructions shown in the error:

**macOS:**
```bash
brew install mkcert
brew install nss  # For Firefox
```

**Windows:**
```bash
choco install mkcert
```

Or download: https://github.com/FiloSottile/mkcert/releases

**Linux:**
```bash
sudo apt-get install mkcert
```

---

### "Permission Denied" During Setup

**Symptoms:**
```
permission denied: .vite-certs/
```

**Cause:** Directory permissions issue

**Solution:**
```bash
# macOS/Linux
sudo node scripts/setup-https.js

# Windows (run as Administrator)
node scripts/setup-https.js

# After running once, subsequent runs don't need sudo
```

---

### Certificate Authority Installation Failed

**Symptoms:**
```
✗ CA creation failed: EACCES: permission denied
```

**Cause:** mkcert needs permissions to install CA

**Solution:**
```bash
# macOS/Linux
sudo mkcert -install

# Windows (as Administrator)
mkcert -install
```

---

## Browser Issues

### "Your connection is not private"

**Symptoms:** Browser shows warning "Your connection is not private" or "NET::ERR_CERT_AUTHORITY_INVALID"

**Cause:** Browser doesn't trust the locally-generated certificate

**Solution:**

This is **expected and normal**. The connection is encrypted (secure), just not verified by a public authority.

**Option 1: Bypass warning (every time)**
- Chrome/Edge: Click "Advanced" → "Proceed to localhost (unsafe)"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"
- Safari: Click "Show Details" → "Visit this website"

**Option 2: Install CA (permanent, recommended)**

**Chrome/Edge/Chromium:**

1. On the warning page, click the lock icon → "Certificate (Invalid)"
2. Open the certificate viewer
3. Go to "Details" tab, click "Copy to File"
4. Save as "mkcert.crt"
5. Settings → Privacy & Security → Manage certificates
6. Authorities → Import
7. Select the saved file
8. Check "Trust this certificate for identifying websites"

Or automatically:
```bash
# macOS
sudo security add-trusted-cert -d -r trustAsRoot -k /Library/Keychains/System.keychain ~/.local/share/mkcert/rootCA.pem
```

**Firefox:**

1. about:preferences → Privacy & Security
2. Certificates → View Certificates
3. Authorities tab → Import
4. Select `~/.local/share/mkcert/rootCA.pem`

**Safari (macOS):**

1. Keychain Access → Certificates
2. Search for "mkcert"
3. Double-click certificate
4. Trust → Always Trust

---

### Mixed Content Warning

**Symptoms:**
```
Mixed Content: The page was loaded over HTTPS, but requested an insecure resource 'http://...'
```

**Cause:** Frontend is HTTPS but backend API or WebSocket is HTTP

**Solution:**

**Option 1: Backend also uses HTTPS**
```bash
# Assuming backend supports HTTPS
HTTPS=true npm run dev
VITE_API_URL=https://localhost:3000 npm run dev
VITE_WS_URL=wss://localhost:3000 npm run dev
```

**Option 2: Allow insecure content (development only)**

Vite's dev server proxy handles mixed content. If still having issues:

```typescript
// NOT for production! Development only!
if (import.meta.env.DEV) {
  // Fetch will upgrade HTTP to HTTPS if needed
}
```

---

### Service Worker Not Loading

**Symptoms:**
```
Failed to register a ServiceWorker for scope ('https://localhost:5173/') with script ('https://localhost:5173/sw.js'): the script has an unsupported MIME type ('text/html').
```

**Cause:** 
1. Using HTTP instead of HTTPS
2. Service Worker file not found
3. Incorrect file path

**Solution:**

1. **Use HTTPS:**
   ```bash
   npm run dev:https
   ```

2. **Verify URL is `https://`** in address bar

3. **Check Service Worker file exists:**
   ```bash
   ls -la public/sw.js
   ```

4. **Check registration code:**
   ```typescript
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js')
       .catch(err => console.error('Registration failed:', err))
   }
   ```

---

### Geolocation Returns "Permission Denied"

**Symptoms:**
```javascript
// Even after granting permission in browser
navigator.geolocation.getCurrentPosition(
  (pos) => { /* ... */ },
  (err) => console.error(err)  // PermissionDenied
)
```

**Causes:**
1. Not using HTTPS
2. User denied permission
3. System location services disabled
4. Browser privacy settings

**Solutions:**

1. **Use HTTPS:**
   ```bash
   npm run dev:https
   ```

2. **Reset browser permissions:**
   
   **Chrome:**
   - Settings → Privacy & Security → Site Settings → Location
   - Find localhost:5173 → Reset

   **Firefox:**
   - about:preferences → Privacy → Permissions → Location
   - Find localhost:5173 → Remove

3. **Check system location services:**
   - Windows: Settings → Privacy & Security → Location
   - macOS: System Preferences → Security & Privacy → Location Services
   - Linux: Usually enabled by default

4. **Test with demo:**
   ```typescript
   if ('geolocation' in navigator) {
     navigator.geolocation.watchPosition(
       (pos) => console.log('Location:', pos.coords),
       (err) => console.error('Error:', err),
       { timeout: 5000 }
     )
   }
   ```

---

### WebSocket Connection Fails

**Symptoms:**
```
WebSocket is closed before the connection is established
Error: WebSocket connection to 'wss://...' failed
```

**Causes:**
1. Backend doesn't support WSS
2. Certificate not trusted by backend
3. Proxy configuration issue

**Solutions:**

1. **Use correct protocol:**
   ```bash
   # For WSS (secure WebSocket)
   HTTPS=true npm run dev
   VITE_WS_URL=wss://localhost:3000 npm run dev
   ```

2. **Verify backend supports WSS:**
   ```bash
   # Test connection manually
   node -e "
   const ws = new require('ws')('wss://localhost:3000/ws')
   ws.on('open', () => console.log('Connected'))
   ws.on('error', (err) => console.error('Error:', err))
   "
   ```

3. **Check proxy configuration in vite.config.ts:**
   ```typescript
   proxy: {
     '/ws': {
       target: 'wss://localhost:3000',
       ws: true,
       changeOrigin: true,
     }
   }
   ```

4. **For development, allow insecure TLS (NOT for production):**
   ```bash
   # macOS/Linux
   NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev:https
   
   # Windows
   set NODE_TLS_REJECT_UNAUTHORIZED=0 && npm run dev:https
   ```

---

## Certificate Expiration

### Certificates Expired

**Symptoms:**
```
SSL: CERTIFICATE_VERIFY_FAILED
CERTIFICATE_HAS_EXPIRED
```

**Cause:** Certificates are older than 10 years (unlikely unless very old setup)

**Solution:**
```bash
# Delete old certificates
rm -rf .vite-certs/

# Regenerate
npm run setup-https
```

---

## Performance Issues

### HTTPS Dev Server Slow

**Symptoms:** Noticeable delay when accessing `https://localhost:5173`

**Cause:** HTTPS handshake overhead (normal, especially on first connection)

**Solution:**

1. **This is expected** — HTTPS adds ~50-100ms handshake per session
2. **Keep-alive** — Subsequent requests reuse the connection (fast)
3. **Clear cache** — Old HTTP connections might be conflicting:
   ```bash
   rm -rf node_modules/.vite
   npm run dev:https
   ```

**HMR should not be affected** — HMR uses WebSocket which is multiplexed over the HTTPS connection.

---

## Port Conflicts

### Port 5173 Already in Use

**Symptoms:**
```
Port 5173 is in use, trying 5174
```

**Solution:**

**Option 1: Use different port**
```bash
npm run dev:https -- --port 3000
```

**Option 2: Kill process using port**

**macOS/Linux:**
```bash
# Find process
lsof -i :5173

# Kill it
kill -9 <PID>
```

**Windows:**
```bash
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

## Certificate File Issues

### `.vite-certs/` Directory Missing

**Symptoms:**
```
Cannot find module '.vite-certs/localhost.crt'
```

**Solution:**
```bash
# Create directory and generate certificates
mkdir -p .vite-certs
npm run setup-https
```

---

### Permissions on Private Key

**Symptoms:**
```
EACCES: permission denied, open '.vite-certs/localhost.key'
```

**Cause:** Private key file permissions too restrictive

**Solution:**
```bash
# Fix permissions
chmod 600 .vite-certs/localhost.key

# Or regenerate
rm -rf .vite-certs
npm run setup-https
```

---

## OS-Specific Issues

### macOS: Keychain Prompt

**Symptoms:** Repeated keychain prompts asking for password

**Cause:** CA certificate not properly installed

**Solution:**
```bash
sudo mkcert -install
```

Then trust in Keychain:
1. Keychain Access → Certificates
2. Find "mkcert" → Double-click
3. Trust → Always Trust

---

### Windows: No Certificate Generation

**Symptoms:** `setup-https` doesn't generate certificates

**Cause:** Running without Administrator privileges

**Solution:**
```bash
# Run Command Prompt as Administrator
node scripts/setup-https.js
```

---

### Linux: Firefox Certificate Issues

**Symptoms:** Firefox still shows untrusted certificate after installation

**Cause:** NSS not installed

**Solution:**
```bash
# macOS
brew install nss

# Ubuntu/Debian
sudo apt-get install libnss3-tools

# Fedora
sudo dnf install nss-tools
```

Then reinstall CA:
```bash
mkcert -install
```

---

## Getting Help

If you encounter an issue not covered here:

1. **Check error message** — Run again and note exact error
2. **Check certificate status:**
   ```bash
   openssl x509 -in .vite-certs/localhost.crt -text -noout
   ```
3. **Regenerate certificates:**
   ```bash
   rm -rf .vite-certs/
   npm run setup-https
   ```
4. **Check mkcert version:**
   ```bash
   mkcert --version
   ```
5. **Report issue** with:
   - OS and version
   - mkcert version
   - Full error message
   - Steps to reproduce

## Related Documentation

- [HTTPS Setup Guide](./https-setup.md) — Main guide
- [Vite HTTPS Configuration](https://vitejs.dev/config/server-options.html#server-https)
- [mkcert Documentation](https://github.com/FiloSottile/mkcert)
