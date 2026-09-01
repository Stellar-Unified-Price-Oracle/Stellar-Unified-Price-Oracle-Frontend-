/**
 * Webhook signing scheme (#502): HMAC-SHA256 of the raw JSON payload, hex-encoded,
 * sent as the `X-Webhook-Signature` header alongside `X-Webhook-Timestamp`
 * (Unix seconds, included in the signed string to prevent replay).
 *
 *   signature = hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
 *
 * Receivers should recompute the signature from the raw request body and
 * compare it to the header using a constant-time comparison, and reject
 * requests whose timestamp is more than a few minutes old.
 */

/** How old a webhook secret can get before the UI warns it should be rotated. */
export const SECRET_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Computes the HMAC-SHA256 signature for a webhook payload, as sent by this app's "Send test request" action. */
export async function signWebhookPayload(secret: string, rawBody: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  return toHex(signed)
}

/** Generates a new random webhook secret (256 bits, hex-encoded). Use for "Rotate secret". */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function isSecretStale(secretUpdatedAt: number | null, now = Date.now()): boolean {
  return secretUpdatedAt !== null && now - secretUpdatedAt > SECRET_MAX_AGE_MS
}

export type VerifySampleLang = 'node' | 'python' | 'go' | 'curl'

/** "Verify signature" sample code, one per supported language, for the webhook UI's copy panel. */
export function buildVerifySample(lang: VerifySampleLang): string {
  switch (lang) {
    case 'node':
      return `const crypto = require('crypto')

function verifyWebhook(rawBody, signature, timestamp, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// req.headers['x-webhook-signature'], req.headers['x-webhook-timestamp'], raw request body`

    case 'python':
      return `import hashlib
import hmac

def verify_webhook(raw_body: bytes, signature: str, timestamp: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), f"{timestamp}.{raw_body.decode()}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# signature = request.headers["X-Webhook-Signature"]
# timestamp = request.headers["X-Webhook-Timestamp"]`

    case 'go':
      return `import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
)

func verifyWebhook(rawBody []byte, signature, timestamp, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(fmt.Sprintf("%s.%s", timestamp, rawBody)))
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}`

    case 'curl':
      return `# Recompute and compare locally (for manual debugging only — do this
# server-side with a constant-time comparison in production).
BODY='{"type":"test","message":"..."}'
TS=$(date +%s)
echo -n "\${TS}.\${BODY}" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET"`
  }
}
