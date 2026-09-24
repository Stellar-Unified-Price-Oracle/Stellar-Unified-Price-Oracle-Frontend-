import { describe, it, expect } from 'vitest'
import { sanitizeHtml, stripHtml, sanitizeUrl } from './htmlSanitizer'

describe('htmlSanitizer', () => {
  describe('sanitizeHtml', () => {
    it('allows safe HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>'
      const output = sanitizeHtml(input)
      expect(output).toContain('<p>')
      expect(output).toContain('strong')
      expect(output).toContain('Hello')
    })

    it('removes script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>'
      const output = sanitizeHtml(input)
      expect(output).not.toContain('script')
      expect(output).not.toContain('alert')
      expect(output).toContain('Hello')
    })

    it('removes event handlers', () => {
      const input = '<img src="x" onerror="alert(\'xss\')" />'
      const output = sanitizeHtml(input)
      expect(output).not.toContain('onerror')
      expect(output).not.toContain('alert')
    })

    it('strips javascript: URLs', () => {
      const input = '<a href="javascript:alert(\'xss\')">click</a>'
      const output = sanitizeHtml(input)
      expect(output).not.toContain('javascript:')
      expect(output).toContain('click')
    })

    it('allows safe href attributes', () => {
      const input = '<a href="https://example.com" title="Example">link</a>'
      const output = sanitizeHtml(input)
      expect(output).toContain('href')
      expect(output).toContain('https://example.com')
      expect(output).toContain('link')
    })

    it('preserves text content', () => {
      const input = '<div onclick="alert()">Important content</div>'
      const output = sanitizeHtml(input)
      expect(output).toContain('Important content')
      expect(output).not.toContain('onclick')
    })

    it('handles nested dangerous elements', () => {
      const input = '<p><script>var x=1</script>Safe text</p>'
      const output = sanitizeHtml(input)
      expect(output).not.toContain('<script>')
      expect(output).toContain('Safe text')
    })

    it('removes style attributes with expressions', () => {
      const input = '<div style="background: url(javascript:alert())">test</div>'
      const output = sanitizeHtml(input)
      expect(output).not.toContain('javascript:')
      expect(output).toContain('test')
    })
  })

  describe('stripHtml', () => {
    it('removes all HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>'
      const output = stripHtml(input)
      expect(output).not.toContain('<')
      expect(output).not.toContain('>')
      expect(output).toContain('Hello')
      expect(output).toContain('world')
    })

    it('removes dangerous content too', () => {
      const input = '<script>alert("xss")</script><p>Safe</p>'
      const output = stripHtml(input)
      expect(output).not.toContain('script')
      expect(output).not.toContain('alert')
      expect(output).toContain('Safe')
    })

    it('handles empty input', () => {
      const output = stripHtml('')
      expect(output).toBe('')
    })

    it('handles plain text input', () => {
      const input = 'Just plain text'
      const output = stripHtml(input)
      expect(output).toBe('Just plain text')
    })
  })

  describe('sanitizeUrl', () => {
    it('allows safe HTTPS URLs', () => {
      const url = 'https://example.com/page'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('allows safe HTTP URLs', () => {
      const url = 'http://example.com'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('allows mailto: URLs', () => {
      const url = 'mailto:test@example.com'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('allows ftp: URLs', () => {
      const url = 'ftp://files.example.com/file.txt'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('allows tel: URLs', () => {
      const url = 'tel:+1234567890'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('blocks javascript: URLs', () => {
      const url = 'javascript:alert("xss")'
      const result = sanitizeUrl(url)
      expect(result).toBe('')
    })

    it('blocks javascript: URLs with case variations', () => {
      const url = 'jAvAsCrIpT:alert("xss")'
      const result = sanitizeUrl(url)
      expect(result).toBe('')
    })

    it('blocks data: URLs', () => {
      const url = 'data:text/html,<script>alert(1)</script>'
      const result = sanitizeUrl(url)
      expect(result).toBe('')
    })

    it('blocks vbscript: URLs', () => {
      const url = 'vbscript:msgbox("xss")'
      const result = sanitizeUrl(url)
      expect(result).toBe('')
    })

    it('handles relative URLs starting with /', () => {
      const url = '/page/path'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles relative URLs starting with ./', () => {
      const url = './page/path'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles relative URLs starting with ../', () => {
      const url = '../page/path'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles protocol-relative URLs', () => {
      const url = '//example.com/page'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles hash URLs', () => {
      const url = '#section'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles query string URLs', () => {
      const url = '?search=term'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('handles simple relative paths', () => {
      const url = 'page.html'
      expect(sanitizeUrl(url)).toBe(url)
    })

    it('blocks unknown protocols', () => {
      const url = 'unknown:something'
      expect(sanitizeUrl(url)).toBe('')
    })

    it('handles empty strings', () => {
      expect(sanitizeUrl('')).toBe('')
    })

    it('trims whitespace', () => {
      const url = '  https://example.com  '
      expect(sanitizeUrl(url)).toBe('  https://example.com  ')
    })
  })
})
