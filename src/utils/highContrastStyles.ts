/**
 * High Contrast Mode CSS utilities and system color helpers.
 * 
 * These utilities help ensure the app works correctly in:
 * - Windows High Contrast Mode (forced-colors: active)
 * - Systems with prefers-contrast: more
 * - Any user agent that respects forced color mode
 * 
 * Reference: https://www.w3.org/TR/css-color-adjust-1/
 */

/**
 * System colors available in High Contrast Mode.
 * These map to Windows system colors.
 * 
 * Reference: https://www.w3.org/TR/css-color-4/#css-system-colors
 */
export const SYSTEM_COLORS = {
  /** Text color for captions, labels, and other descriptive text */
  CaptionText: 'CaptionText',
  /** Background of active window title bar */
  ActiveBorder: 'ActiveBorder',
  /** Background of inactive window title bar */
  InactiveBorder: 'InactiveBorder',
  /** Background of selected text */
  Highlight: 'Highlight',
  /** Foreground of selected text */
  HighlightText: 'HighlightText',
  /** Text color for buttons */
  ButtonText: 'ButtonText',
  /** Background color of buttons */
  ButtonFace: 'ButtonFace',
  /** Surface color for UI components */
  Canvas: 'Canvas',
  /** Text on Canvas */
  CanvasText: 'CanvasText',
  /** Text color for field labels and other form-related text */
  AccentColor: 'AccentColor',
  /** Foreground color for mark/selection highlighting */
  Mark: 'Mark',
  /** Background color for mark/selection highlighting */
  MarkText: 'MarkText',
} as const

/**
 * CSS class to apply high contrast styles.
 * Add this class when high contrast mode is active.
 */
export const HIGH_CONTRAST_CLASS = 'hc-mode'

/**
 * CSS class to apply enhanced borders in high contrast mode.
 */
export const HIGH_CONTRAST_BORDER_CLASS = 'hc-border'

/**
 * Generate CSS for high contrast mode system colors.
 * Include this in your stylesheet or use as inline styles.
 */
export const HIGH_CONTRAST_CSS = `
/* High Contrast Mode Support */
@media (forced-colors: active) {
  /* Root element setup */
  html, body {
    color-scheme: dark light;
  }

  /* Ensure text is readable */
  body {
    color: CanvasText;
    background-color: Canvas;
  }

  /* Buttons and interactive elements */
  button, [role="button"], input[type="button"], input[type="submit"] {
    background-color: ButtonFace;
    color: ButtonText;
    border: 2px solid ButtonText;
    forced-color-adjust: none;
  }

  button:active, [role="button"]:active {
    background-color: Highlight;
    color: HighlightText;
  }

  /* Links */
  a {
    color: LinkText;
    text-decoration: underline;
    forced-color-adjust: none;
  }

  a:visited {
    color: VisitedText;
  }

  /* Form controls */
  input, textarea, select {
    background-color: Canvas;
    color: CanvasText;
    border: 2px solid CanvasText;
    forced-color-adjust: none;
  }

  input:focus, textarea:focus, select:focus {
    outline: 3px solid HighlightText;
    outline-offset: 2px;
  }

  /* Cards and containers */
  [role="region"], section, article, .card {
    border: 2px solid CanvasText;
    forced-color-adjust: none;
  }

  /* Tables */
  table, tbody, thead, tr, td, th {
    border: 1px solid CanvasText;
    forced-color-adjust: none;
  }

  /* Ensure icons and images are visible */
  img, svg {
    forced-color-adjust: none;
  }
}

/* High Contrast Mode CSS Variables */
@media (forced-colors: active) {
  :root {
    --hc-text: CanvasText;
    --hc-background: Canvas;
    --hc-border: CanvasText;
    --hc-button-text: ButtonText;
    --hc-button-bg: ButtonFace;
    --hc-highlight: Highlight;
    --hc-highlight-text: HighlightText;
  }
}

/* Additional support for prefers-contrast: more */
@media (prefers-contrast: more) {
  body {
    --color-text-muted: #333;
    --color-border: #000;
  }

  button, [role="button"] {
    border-width: 2px;
  }

  .card, [role="region"] {
    border: 2px solid currentColor;
  }
}
`

/**
 * Tailwind CSS class combinations for high contrast mode support.
 * Use these in your components.
 */
export const HIGH_CONTRAST_CLASSES = {
  /** Card with high contrast border */
  card: 'border-2 border-gray-900 dark:border-white @media(forced-colors:active){border:2px solid CanvasText}',

  /** Button with high contrast styling */
  button:
    'border-2 border-gray-900 dark:border-white @media(forced-colors:active){background:ButtonFace;color:ButtonText;border:2px solid ButtonText}',

  /** Input with high contrast styling */
  input:
    'border-2 border-gray-900 dark:border-white @media(forced-colors:active){background:Canvas;color:CanvasText;border:2px solid CanvasText}',

  /** Text that needs clear distinction in high contrast */
  emphasis: 'font-semibold @media(forced-colors:active){text-decoration:underline}',

  /** Icon that needs to be visible in high contrast */
  icon: '@media(forced-colors:active){forced-color-adjust:none}',
} as const

/**
 * Generate inline styles for high contrast mode.
 * Use when you need dynamic styling.
 */
export function getHighContrastStyles(
  isActive: boolean,
): React.CSSProperties {
  if (!isActive) return {}

  return {
    colorScheme: 'dark light',
    forcedColorAdjust: 'none',
  }
}

/**
 * Get border styles for high contrast mode.
 * Ensures borders are visible in all modes.
 */
export function getHighContrastBorderStyles(
  isActive: boolean,
): React.CSSProperties {
  if (!isActive) {
    return {
      borderWidth: '1px',
      borderColor: 'transparent',
    }
  }

  return {
    borderWidth: '2px',
    borderColor: 'CanvasText',
  }
}

/**
 * CSS Media Query strings for high contrast detection.
 */
export const HIGH_CONTRAST_MEDIA_QUERIES = {
  forcedColors: '(forced-colors: active)',
  prefersContrast: '(prefers-contrast: more)',
  highContrast: '(forced-colors: active), (prefers-contrast: more)',
} as const

/**
 * Apply high contrast mode CSS to the document.
 * Call this in your app initialization to inject the styles.
 */
export function applyHighContrastStyles(): void {
  if (typeof document === 'undefined') return

  // Check if styles already applied
  if (document.getElementById('hc-styles')) return

  const style = document.createElement('style')
  style.id = 'hc-styles'
  style.textContent = HIGH_CONTRAST_CSS
  document.head.appendChild(style)
}

export type SystemColor = (typeof SYSTEM_COLORS)[keyof typeof SYSTEM_COLORS]
