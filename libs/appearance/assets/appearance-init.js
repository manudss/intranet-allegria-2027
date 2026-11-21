/* Runs before paint, without a server call; keep key/validation aligned with AppearanceService. */
(function () {
  var mode = 'auto';
  try { var saved = localStorage.getItem('alegria.appearance.v1'); if (saved === 'light' || saved === 'dark') mode = saved; } catch (_) {}
  var dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'only light';
})();
