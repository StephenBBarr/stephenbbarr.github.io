(function initialiseTheme(global) {
  "use strict";

  const portfolio = global.Portfolio || (global.Portfolio = {});
  const root = document.documentElement;
  // Keep the existing reading preference when the site is updated.
  const key = "portfolio-theme-text";
  const colours = { dark: "#1e2220", light: "#f7f5ef" };

  function apply(theme, persist = true) {
    if (!Object.hasOwn(colours, theme)) return false;
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = colours[theme];
    if (persist) {
      try { localStorage.setItem(key, theme); } catch { /* The visible choice still works. */ }
    }
    return true;
  }

  let initial = "light";
  try {
    const saved = localStorage.getItem(key);
    if (Object.hasOwn(colours, saved)) initial = saved;
  } catch { /* The light default works without storage. */ }
  apply(initial, false);
  portfolio.theme = Object.freeze({ apply, current: () => root.dataset.theme });
})(globalThis);
