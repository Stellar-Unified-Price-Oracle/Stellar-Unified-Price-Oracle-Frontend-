import DOMPurify from 'dompurify'
import type { Config } from 'dompurify'

/**
 * Sanitizes user-provided HTML and returns a safe string for `dangerouslySetInnerHTML`.
 *
 * Only use when raw HTML rendering is strictly necessary (e.g., Markdown, rich text).
 * For all other cases, rely on React's auto-escaping.
 *
 * @param dirtyHtml - Untrusted HTML string
 * @param config - Optional DOMPurify configuration (defaults are permissive for common rich text)
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`
 *
 * @example
 * ```tsx
 * import { sanitizeHtml } from '../utils/htmlSanitizer'
 *
 * const clean = sanitizeHtml(userProvidedMarkdownHtml)
 * <div dangerouslySetInnerHTML={{ __html: clean }} />
 * ```
 */
export function sanitizeHtml(
  dirtyHtml: string,
  config?: Config,
): string {
  const defaultConfig: Config = {
    // Allow common rich text tags
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ],
    // Allow safe attributes
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    // Strip everything else
    KEEP_CONTENT: true,
    // Disallow data URLs and javascript: protocol
    ...config,
  }

  return DOMPurify.sanitize(dirtyHtml, defaultConfig)
}

/**
 * Strict HTML sanitizer for user-generated content where only basic text formatting is needed.
 * Removes all HTML tags, keeping only text content.
 *
 * Use this when you want to preserve the user's text but strip all formatting.
 *
 * @param dirtyHtml - User-provided HTML string
 * @returns Plain text with no HTML tags
 *
 * @example
 * ```tsx
 * const plainText = stripHtml(userInput)
 * <p>{plainText}</p>
 * ```
 */
export function stripHtml(dirtyHtml: string): string {
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitizes HTML for use in href attributes (e.g., user-provided links).
 * Only allows safe protocols (http, https, mailto, relative paths).
 *
 * Blocks dangerous protocols: javascript:, data:, vbscript:
 *
 * @param url - Potentially unsafe URL
 * @returns Safe URL, or empty string if the URL protocol is unsafe
 *
 * @example
 * ```tsx
 * const safeUrl = sanitizeUrl(userUrl)
 * <a href={safeUrl}>Link</a>
 * ```
 */
export function sanitizeUrl(url: string): string {
  // Check for dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:']
  const lowerUrl = url.toLowerCase().trim()

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return ''
    }
  }

  // Allow safe protocols: http, https, mailto, ftp, and relative/protocol-relative URLs
  if (
    lowerUrl.startsWith('http://') ||
    lowerUrl.startsWith('https://') ||
    lowerUrl.startsWith('mailto:') ||
    lowerUrl.startsWith('ftp://') ||
    lowerUrl.startsWith('tel:') ||
    lowerUrl.startsWith('/') ||
    lowerUrl.startsWith('#') ||
    lowerUrl.startsWith('?') ||
    lowerUrl.startsWith('./') ||
    lowerUrl.startsWith('../') ||
    !lowerUrl.includes(':') // Relative URL with no protocol
  ) {
    return url
  }

  // Unknown protocol — block it
  return ''
}
