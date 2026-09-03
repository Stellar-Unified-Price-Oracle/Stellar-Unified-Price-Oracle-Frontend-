# Animation & Motion Guidelines

This document outlines best practices for animations and transitions in the Stellar Unified Price Oracle frontend, with emphasis on **accessibility** and **respecting the `prefers-reduced-motion` user preference**.

## Overview

Animations can enhance user experience but may cause discomfort for users with:
- Vestibular disorders (balance and spatial orientation)
- Epilepsy or photosensitivity
- Cognitive or neurological conditions

The CSS media query `prefers-reduced-motion: reduce` allows users to opt out of animations. We respect both:
1. **System-level preferences** (OS settings: Windows, macOS, iOS, Android)
2. **User settings** in the app's accessibility preferences

## Architecture

### Global Reduced-Motion Support

All animations are automatically disabled when reduced motion is active via CSS rules in `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

.reduced-motion * {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
```

**How it works:**
- `@media (prefers-reduced-motion: reduce)` — respects system-level OS settings
- `.reduced-motion *` class — applied to `<html>` when user enables toggle in accessibility preferences
- Duration of `0.001ms` ensures animations complete immediately without visual flashing

### Detection: useReducedMotion Hook

Use the `useReducedMotion()` hook to detect if reduced motion is active:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion'

export function MyComponent() {
  const reducedMotion = useReducedMotion()
  
  return (
    <div style={{ 
      transition: reducedMotion ? 'none' : 'opacity 0.3s ease'
    }}>
      Content
    </div>
  )
}
```

The hook returns `true` if **either**:
- User has enabled "Reduced Motion" in app settings (Accessibility section)
- System `prefers-reduced-motion: reduce` is active

## Examples

### 1. CSS Transitions

**Tailwind transitions** like `transition-colors`, `transition-all`, etc. are automatically handled by the global CSS rules. No code changes needed:

```tsx
// This automatically respects reduced motion
<button className="transition-colors duration-200 hover:bg-cyan-500">
  Click me
</button>
```

### 2. Custom CSS Animations

For custom `@keyframes` animations, add reduced-motion overrides:

```css
/* Define animation normally */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Disable when reduced motion is active */
.reduced-motion .spinner {
  animation: none !important;
}
```

### 3. React State-Based Animations

For animations triggered by React state/hooks (e.g., fade-in on mount):

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion'

export function Toast() {
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If reduced motion, show immediately
    if (reducedMotion) {
      el.style.opacity = '1'
      el.style.transform = 'translateX(0) scale(1)'
      el.style.transition = 'none'
      return
    }

    // Normal animation
    el.style.opacity = '0'
    el.style.transform = 'translateX(1rem) scale(0.97)'
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateX(0) scale(1)'
    })
  }, [reducedMotion])

  return <div ref={ref}>{/* content */}</div>
}
```

### 4. Recharts (Chart Animations)

For chart libraries like Recharts, disable animations programmatically:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion'
import { AreaChart, Area } from 'recharts'

export function PriceChart({ data }) {
  const reducedMotion = useReducedMotion()

  // Combine with other logic (e.g., suppress on real-time updates)
  const shouldAnimate = !isIncremental && !reducedMotion

  return (
    <AreaChart data={data}>
      <Area
        isAnimationActive={shouldAnimate}
        animationDuration={400}
        animationEasing="ease-out"
      />
    </AreaChart>
  )
}
```

### 5. Page Transitions

The `PageTransition` component respects reduced motion automatically:

```tsx
// This component already handles reduced motion internally
<PageTransition>
  {children}
</PageTransition>
```

## Current Implementation

### Components with Reduced-Motion Support

| Component | Animation | Implementation |
|-----------|-----------|-----------------|
| `PageTransition` | Fade + slide-up on route change | `useReducedMotion` hook, conditional animation frame |
| `PriceChart` | Chart area/line animations | Recharts `isAnimationActive` prop controlled by hook |
| `ToastContainer` | Slide in from bottom on appear | Conditional RAF with `useReducedMotion` |
| `SkeletonBone` | Shimmer sweep animation | Global CSS rules with `.reduced-motion .skeleton-shimmer::after { animation: none }` |
| All Tailwind transitions | Hover, focus, state changes | Automatic via `@media (prefers-reduced-motion: reduce)` CSS |

### Accessibility Preferences UI

Users can toggle reduced motion in **Settings → Accessibility**:
- Label: "Reduced Motion"
- Description: "Disables animations for users sensitive to motion"
- Persisted to IndexedDB
- Applied immediately via `useAccessibility()` hook which adds `reduced-motion` class to `<html>`

## Best Practices

### Do

✅ **Always test with reduced motion enabled.** Use your OS settings or toggle in the app's accessibility preferences.

✅ **Use the `useReducedMotion` hook** for animations controlled by React state or effects.

✅ **Provide instant visual feedback** when reduced motion is active. Don't hide functionality.

✅ **Consider what the animation achieves:**
  - If it's decorative (e.g., hero hover effect), disable it entirely.
  - If it communicates state (e.g., loading spinner), keep it visible but static.
  - If it's essential for UX (e.g., modal appear), provide an instant alternative.

✅ **Test with assistive technologies** like screen readers. Some animations can interfere with navigation.

### Don't

❌ **Don't create animations longer than ~0.3s** unless they're critical to understanding state.

❌ **Don't use rapid flashing** (more than 3 times per second). Even without reduced motion, this can trigger seizures.

❌ **Don't auto-play videos with motion.** Require user interaction.

❌ **Don't ignore `prefers-reduced-motion`.** It's not a feature; it's an accessibility requirement.

❌ **Don't assume everyone can perceive motion.** Some users have permanent or temporary vision loss.

## Testing

### Automated Testing

Tests for `useReducedMotion` are in `src/hooks/useReducedMotion.test.tsx`:

```bash
npm run test -- src/hooks/useReducedMotion.test.tsx
```

### Manual Testing

1. **Enable system-level reduced motion:**
   - macOS: System Preferences → Accessibility → Display → Reduce motion
   - Windows: Settings → Ease of Access → Display → Show animations
   - Linux: Depends on desktop environment (GNOME: Settings → Accessibility → Seeing → Animations)
   - iOS: Settings → Accessibility → Motion → Reduce Motion
   - Android: Settings → Accessibility → Remove animations

2. **Toggle in app:**
   - Open Settings → Accessibility → "Reduced Motion" toggle

3. **Verify:**
   - No visible animations when enabled
   - Page transitions are instant
   - Charts render without animations
   - Toasts appear immediately
   - Skeleton loaders are static

4. **Check with dev tools:**
   ```javascript
   // In browser console:
   window.matchMedia('(prefers-reduced-motion: reduce)').matches
   document.documentElement.classList.contains('reduced-motion')
   ```

## Resources

- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [WCAG 2.1 Success Criterion 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [WebAIM: Vestibular Disorders](https://webaim.org/articles/vestibular/)
- [A List Apart: Designing Safer Web Animation for Motion Sensitivity](https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/)

## Files to Know

| File | Purpose |
|------|---------|
| `src/index.css` | Global reduced-motion CSS rules |
| `src/hooks/useReducedMotion.ts` | Hook for React components |
| `src/hooks/useReducedMotion.test.tsx` | Hook tests |
| `src/hooks/useAccessibility.ts` | Applies `reduced-motion` class to root element |
| `src/preferences/PreferencesContext.tsx` | Stores user's reduced-motion preference |
| `src/components/SettingsPanel.tsx` | UI toggle for reduced-motion preference |

## Adding New Animations

When adding a new animation to the codebase:

1. **Add a hook check** if the animation is state-driven:
   ```tsx
   const reducedMotion = useReducedMotion()
   // Conditionally apply animation
   ```

2. **Add CSS fallback** if using `@keyframes`:
   ```css
   .reduced-motion .your-class {
     animation: none !important;
   }
   ```

3. **Test locally** with reduced motion enabled.

4. **Document** in this file if the animation is significant.

## Common Pitfalls

### Issue: Animation Still Plays with Reduced Motion Enabled

**Cause:** Component is not using `useReducedMotion()` hook or missing CSS rule.

**Fix:**
```tsx
// Before (❌)
const [animate, setAnimate] = useState(true)

// After (✅)
const reducedMotion = useReducedMotion()
const [animate, setAnimate] = useState(!reducedMotion)
```

### Issue: CSS `transition` Still Works with Reduced Motion

**Cause:** Tailwind class like `transition-colors` applied after global CSS.

**Fix:** Ensure `src/index.css` is imported before component styles, or use more specific selectors:
```css
.reduced-motion [class*='transition-'] {
  transition-duration: 0.001ms !important;
}
```

### Issue: Animations Break When OS Preference Changes

**Cause:** `useReducedMotion()` dependency array missing or incorrect.

**Fix:** Ensure hook re-runs when `reducedMotion` state changes:
```tsx
useEffect(() => {
  // animation setup
}, [reducedMotion]) // ✅ Include in dependency array
```

## Future Improvements

- [ ] Add E2E tests for animation states with Playwright
- [ ] Audit third-party libraries for motion accessibility
- [ ] Add performance metrics for animation frame drops
- [ ] Create animation patterns library (fade, slide, scale) with built-in reduced-motion support
