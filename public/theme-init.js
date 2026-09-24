// Kept out of index.html as an inline <script> so the CSP can stay on
// script-src 'self' without needing 'unsafe-inline' or per-build hashes.
(function () {
  // Apply theme before paint to avoid flash
  var stored = localStorage.getItem('stellar-oracle-theme')
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark')
  }

  // The Inter stylesheet is requested with media="print" so it does not block
  // render; promote it to media="all" once it has loaded. Previously an inline
  // onload attribute, which CSP blocks along with other inline handlers.
  var fontCss = document.getElementById('font-css')
  if (fontCss) {
    var enable = function () {
      fontCss.media = 'all'
    }
    if (fontCss.sheet) enable()
    else fontCss.addEventListener('load', enable, { once: true })
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {})
    })
  }
})()
