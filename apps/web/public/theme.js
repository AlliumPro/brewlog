/**
 * Synchronous and external on purpose. React mounts after the first paint, so reading the
 * stored choice from a component would let the wrong theme flash first.
 *
 * It is a file rather than an inline script because the Content-Security-Policy is a static
 * header (see vercel.json): an inline script would need its hash in that header, and the hash
 * changes whenever this code does. A same-origin script needs nothing and still blocks
 * rendering, which is the property that matters here.
 *
 * The two colours mirror --color-bg in tokens.css.
 */
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
    }
    var dark =
      stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute('content', dark ? '#110d12' : '#fbf9fc');
  } catch {
    /* blocked storage: fall through to the system preference */
  }
})();
