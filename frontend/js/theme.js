/**
 * ECHO BYTES – Theme Manager
 * Persists light/dark theme in localStorage.
 * Runs immediately (before DOMContentLoaded) to avoid flash.
 */
(function () {
  const KEY = 'eb-theme';
  const saved = localStorage.getItem(KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);

  function applyThemeUI(theme) {
    const sun   = document.getElementById('ti-sun');
    const moon  = document.getElementById('ti-moon');
    const label = document.getElementById('theme-label');
    if (theme === 'dark') {
      if (sun)   sun.style.display  = 'none';
      if (moon)  moon.style.display = 'block';
      if (label) label.textContent  = 'Light Mode';
    } else {
      if (sun)   sun.style.display  = 'block';
      if (moon)  moon.style.display = 'none';
      if (label) label.textContent  = 'Dark Mode';
    }
  }

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
    applyThemeUI(next);
  };

  // Apply UI state after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyThemeUI(saved));
  } else {
    applyThemeUI(saved);
  }
})();
