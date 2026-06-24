/**
 * Secure token storage for WebSocket authentication.
 * Supports both in-memory and localStorage strategies.
 * Issue #96
 */

const TOKEN_KEY = 'auth_token_ws'
const TOKEN_EXPIRY_KEY = 'auth_token_expiry'

export class TokenStorage {
  private static inMemoryToken: string | null = null
  private static inMemoryExpiry: number | null = null

  /**
   * Store auth token securely (in-memory by default, optional localStorage)
   * @param token - The authentication token
   * @param expiryMs - Token expiry time in milliseconds from now
   * @param useLocalStorage - If true, also persist to localStorage
   */
  static setToken(token: string, expiryMs = 3600000, useLocalStorage = false): void {
    const expiry = Date.now() + expiryMs
    this.inMemoryToken = token
    this.inMemoryExpiry = expiry

    if (useLocalStorage) {
      try {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString())
      } catch {
        // Silently fail if localStorage is not available (e.g., private browsing)
        console.warn('Failed to store token in localStorage')
      }
    }
  }

  /**
   * Retrieve the stored auth token if it's still valid
   * @returns The token if valid, null otherwise
   */
  static getToken(): string | null {
    // Check in-memory token first
    if (this.inMemoryToken && this.inMemoryExpiry && Date.now() < this.inMemoryExpiry) {
      return this.inMemoryToken
    }

    // Try localStorage fallback
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

      if (storedToken && storedExpiry) {
        const expiry = parseInt(storedExpiry, 10)
        if (Date.now() < expiry) {
          // Restore to in-memory
          this.inMemoryToken = storedToken
          this.inMemoryExpiry = expiry
          return storedToken
        }
      }
    } catch {
      // Silently fail if localStorage is not available
    }

    return null
  }

  /**
   * Check if a token is currently stored and valid
   */
  static hasValidToken(): boolean {
    return this.getToken() !== null
  }

  /**
   * Clear the stored token
   */
  static clearToken(): void {
    this.inMemoryToken = null
    this.inMemoryExpiry = null

    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_EXPIRY_KEY)
    } catch {
      // Silently fail
    }
  }

  /**
   * Get remaining token lifetime in milliseconds
   */
  static getTokenTTL(): number {
    if (!this.inMemoryExpiry) return 0
    const remaining = this.inMemoryExpiry - Date.now()
    return remaining > 0 ? remaining : 0
  }
}
