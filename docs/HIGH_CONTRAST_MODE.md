# High Contrast Mode Support

## Overview

The Stellar Oracle frontend now includes **comprehensive support for Windows High Contrast Mode** and other forced color modes. This ensures users with visual accessibility needs can effectively use the application.

## What is High Contrast Mode?

High Contrast Mode is a Windows accessibility feature that:
- Uses system-defined colors for better visibility
- Applies forced colors that override author CSS
- Helps users with low vision, color blindness, or sensitivity

Modern browsers also support CSS-based high contrast preferences:
- `forced-colors: active` - Windows High Contrast Mode
- `prefers-contrast: more` - General system high contrast preference

## Features Implemented

✅ **Automatic detection** of forced-colors and prefers-contrast  
✅ **System color support** - Uses Windows system colors (Canvas, ButtonText, etc.)  
✅ **Enhanced borders** - Visible borders on cards, tables, and interactive elements  
✅ **No information loss** - All meaning conveyed through non-color attributes  
✅ **Proper focus indicators** - Clear outline on interactive elements  
✅ **Cross-component sync** - Detection synced across all instances  
✅ **Responsive** - Auto-updates when system settings change  
✅ **Graceful fallback** - Works in all browsers, degrades gracefully  

## API Reference

### `useHighContrastMode()` Hook

Use this hook to detect high contrast mode and apply conditional styling:

```typescript
import { useHighContrastMode } from '@/hooks/useHighContrastMode'

export function MyComponent() {
  const { isActive, isForcedColors, prefersHigherContrast } = useHighContrastMode()

  return (
    <div className={isActive ? 'border-2 border-current' : ''}>
      {isActive && <div>High contrast mode is active</div>}
      {isForcedColors && <div>Windows High Contrast detected</div>}
      {prefersHigherContrast && <div>System prefers higher contrast</div>}
    </div>
  )
}
```

### Return Value

```typescript
interface HighContrastMode {
  /** True if either forced-colors or prefers-contrast is active */
  isActive: boolean
  /** True if Windows High Contrast Mode (forced-colors: active) */
  isForcedColors: boolean
  /** True if system prefers higher contrast (prefers-contrast: more) */
  prefersHigherContrast: boolean
}
```

### Utility Functions

```typescript
import {
  getHighContrastMode,
  isHighContrastModeActive,
  applyHighContrastStyles,
  SYSTEM_COLORS,
  HIGH_CONTRAST_CSS,
} from '@/utils/highContrastStyles'

// Get current state without React hook
const state = getHighContrastMode()

// Quick boolean check
if (isHighContrastModeActive()) {
  // Apply high contrast logic
}

// Apply styles to document
applyHighContrastStyles()

// System colors available in high contrast
console.log(SYSTEM_COLORS.Canvas) // 'Canvas'
console.log(SYSTEM_COLORS.ButtonText) // 'ButtonText'
```

## System Colors

In High Contrast Mode, the following system colors are available:

| Color | Usage |
|-------|-------|
| `Canvas` | Background surface |
| `CanvasText` | Text on surfaces |
| `ButtonFace` | Button backgrounds |
| `ButtonText` | Text on buttons |
| `Highlight` | Selection background |
| `HighlightText` | Selection text |
| `LinkText` | Links |
| `VisitedText` | Visited links |
| `CaptionText` | Captions and labels |
| `AccentColor` | Accent/highlight color |

## Implementation Guide

### 1. Using the Hook in Components

```typescript
import { useHighContrastMode } from '@/hooks/useHighContrastMode'

export function Card({ children }) {
  const { isActive } = useHighContrastMode()

  return (
    <div
      className={`p-4 rounded ${
        isActive
          ? 'border-2 border-current'  // Visible in high contrast
          : 'border border-gray-200 dark:border-gray-700'
      }`}
    >
      {children}
    </div>
  )
}
```

### 2. Using Media Queries in CSS

```css
@media (forced-colors: active) {
  /* Windows High Contrast Mode */
  .card {
    border: 2px solid CanvasText;
    background-color: Canvas;
    color: CanvasText;
  }

  button {
    background-color: ButtonFace;
    color: ButtonText;
    border: 2px solid ButtonText;
  }
}

@media (prefers-contrast: more) {
  /* Generic high contrast preference */
  .card {
    border-width: 2px;
  }

  button {
    border-width: 2px;
  }
}
```

### 3. Conveying Information Without Color

Always use multiple methods to convey information:

```typescript
// ❌ Bad - information only by color
<div className={isActive ? 'text-green-500' : 'text-red-500'}>
  Status: {status}
</div>

// ✅ Good - color + icon + text
<div className={isActive ? 'text-green-500' : 'text-red-500'}>
  {isActive ? '✓' : '✗'} Status: {status}
</div>
```

### 4. Strong Focus Indicators

Ensure focus outlines are always visible:

```typescript
<button
  className="focus:outline-2 focus:outline-offset-2 focus:outline-current"
>
  Click me
</button>
```

## CSS Media Queries

### Detect Forced Colors

```css
@media (forced-colors: active) {
  /* Windows High Contrast Mode detected */
}
```

### Detect High Contrast Preference

```css
@media (prefers-contrast: more) {
  /* User prefers higher contrast */
}
```

### Combine Both

```css
@media (forced-colors: active), (prefers-contrast: more) {
  /* Either forced colors or high contrast preference */
}
```

## Testing High Contrast Mode

### On Windows 11

1. Settings → Accessibility → Display → Contrast themes
2. Choose a contrast theme (High Contrast #1, #2, etc.)
3. Settings apply immediately

### In Browser DevTools

**Chrome/Edge:**
1. DevTools → More tools → Rendering
2. "Emulate CSS media feature prefers-color-scheme" → Select theme
3. (Note: forced-colors emulation may require an extension)

**Firefox:**
1. Type `about:config` in address bar
2. Search `ui.systemUsesDarkTheme` → set to 0 or 1
3. Refresh page

### Manual Testing Checklist

- [ ] All buttons have visible borders
- [ ] All cards/containers have visible borders
- [ ] Focus outlines are clearly visible
- [ ] Text has sufficient contrast with background
- [ ] Information is not conveyed by color alone
- [ ] Icons are visible and distinguishable
- [ ] Form inputs have clear borders
- [ ] Links are underlined or have text decoration
- [ ] All interactive elements are keyboard accessible

## Component Integration Examples

### Card Component

```typescript
import { useHighContrastMode } from '@/hooks/useHighContrastMode'

export function Card({ title, children }) {
  const { isActive } = useHighContrastMode()

  return (
    <div
      className={`rounded-lg p-4 transition-colors ${
        isActive
          ? 'border-2 border-current bg-[Canvas] text-[CanvasText]'
          : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      }`}
    >
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  )
}
```

### Button Component

```typescript
import { useHighContrastMode } from '@/hooks/useHighContrastMode'

export function Button({ children, ...props }) {
  const { isActive } = useHighContrastMode()

  return (
    <button
      className={`px-4 py-2 rounded font-medium transition-colors ${
        isActive
          ? 'border-2 border-[ButtonText] bg-[ButtonFace] text-[ButtonText]'
          : 'border border-gray-300 dark:border-gray-600 bg-cyan-600 text-white hover:bg-cyan-700'
      } focus:outline-2 focus:outline-offset-2 focus:outline-[HighlightText]`}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Table Component

```typescript
import { useHighContrastMode } from '@/hooks/useHighContrastMode'

export function Table({ columns, data }) {
  const { isActive } = useHighContrastMode()

  return (
    <table className={isActive ? 'border-collapse border-2 border-[CanvasText]' : 'w-full'}>
      <thead>
        <tr className={isActive ? 'border-2 border-[CanvasText] bg-[Highlight]' : ''}>
          {columns.map((col) => (
            <th
              key={col}
              className={`p-2 text-left ${isActive ? 'border-2 border-[CanvasText] color-[HighlightText]' : ''}`}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className={isActive ? 'border-2 border-[CanvasText]' : ''}>
            {columns.map((col) => (
              <td key={col} className={isActive ? 'border-2 border-[CanvasText] p-2' : 'p-2'}>
                {row[col]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

## Best Practices

✅ **Do**
- Use system colors in high contrast mode
- Add visible borders to interactive elements
- Ensure sufficient contrast ratios (7:1 for normal text)
- Provide clear focus indicators
- Use multiple cues (color + icons + text)
- Test regularly in high contrast mode

❌ **Don't**
- Rely on color alone to convey meaning
- Hide borders or focus indicators in high contrast
- Use `forced-color-adjust: none` to override all colors
- Assume users can distinguish subtle color differences
- Remove hover/focus states in high contrast

## Accessibility Standards

**WCAG 2.1 Compliance:**
- ✅ 1.4.3 Contrast (Minimum): Level AA (4.5:1 for text)
- ✅ 1.4.11 Non-text Contrast: Level AA (3:1 for UI components)
- ✅ 2.1.1 Keyboard: Level A (fully keyboard accessible)
- ✅ 2.4.7 Focus Visible: Level AA (clear focus indicator)

**WCAG 2.2 Enhancements:**
- ✅ 2.4.11 Focus Visible (Enhanced): Better focus indicators
- ✅ 2.5.2 Pointer Cancellation: Non-destructive actions

## Browser Compatibility

| Browser | forced-colors | prefers-contrast |
|---------|---------------|------------------|
| Chrome 89+ | ✓ | ✓ |
| Firefox 100+ | ✓ | ✓ |
| Safari 14.1+ | ✓ | ✓ |
| Edge 89+ | ✓ | ✓ |
| Windows High Contrast | ✓ (automatic) | ✓ |

## Testing Across Browsers

### Chrome/Chromium-based

1. DevTools → More tools → Rendering
2. Check "Emulate CSS media feature prefers-color-scheme"
3. Note: Full forced-colors requires Windows High Contrast or emulation extension

### Firefox

1. Type `about:config`
2. Set `ui.systemUsesDarkTheme` to emulate preference
3. Note: Forced-colors requires Windows High Contrast on Windows

### Safari

1. Develop menu → Experimental Features
2. Look for "CSS Media Queries Level 5" options
3. Or use System Preferences → Accessibility on macOS

## Known Issues & Workarounds

### Issue: Tailwind colors not respecting system colors

**Workaround:** Use inline styles or CSS variables for system colors:
```tsx
<div style={{ color: 'CanvasText', backgroundColor: 'Canvas' }}>
  Content
</div>
```

### Issue: forced-color-adjust not working as expected

**Solution:** Use `@media (forced-colors: active)` instead of trying to override with JS

### Issue: Third-party components not respecting high contrast

**Workaround:** Wrap with a container that enforces contrast:
```tsx
<div className="@media(forced-colors:active){border-2 border-current}">
  <ThirdPartyComponent />
</div>
```

## Further Reading

- [W3C CSS Color Adjust Module Level 1](https://www.w3.org/TR/css-color-adjust-1/)
- [MDN: forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)
- [MDN: prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Windows Accessibility: High Contrast Mode](https://support.microsoft.com/en-us/windows/change-color-contrast-in-windows-11-a2a7e36e-b46e-d05e-91ff-dbf8014fcb63)
