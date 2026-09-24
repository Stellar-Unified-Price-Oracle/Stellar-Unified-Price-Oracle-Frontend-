/*
 * Script for the offline fallback page (public/offline.html).
 *
 * The retry button previously used an inline `onclick` attribute, which
 * `script-src 'self'` blocks — so the button did nothing on the one page
 * users see when nothing else loads. The listener is attached here instead,
 * from a same-origin file the policy allows. Precached by the service worker
 * — see SHELL_URLS in public/sw.js.
 */
document.getElementById('retry')?.addEventListener('click', () => {
  location.reload()
})
