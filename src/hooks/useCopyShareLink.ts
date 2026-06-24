import { useState, useCallback } from 'react'

/**
 * Returns a function that copies the current URL to clipboard.
 * Provides a "copied" state that resets after 2 seconds.
 * The current URL already encodes all view state via URL search params (#50).
 */
export function useCopyShareLink() {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    const url = window.location.href
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    } else {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  return { copy, copied }
}
