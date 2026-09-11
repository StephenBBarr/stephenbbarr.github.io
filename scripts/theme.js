(function initialiseTheme(global) {
  "use strict";

  const portfolio = global.Portfolio || (global.Portfolio = {});
  const root = document.documentElement;
  // Keep the existing reading preference when the site is updated.
  const storageKey = "portfolio-theme-text";
  const colours = { dark: "#1e2220", light: "#f7f5ef" };

  function apply(theme, persist = true) {
    if (!Object.hasOwn(colours, theme)) {
      return false;
    }
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = colours[theme];
    }
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // The visible choice still works.
      }
    }
    return true;
  }

  let initialTheme = "light";
  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (Object.hasOwn(colours, savedTheme)) {
      initialTheme = savedTheme;
    }
  } catch {
    // The light default works without storage.
  }
  apply(initialTheme, false);

  portfolio.theme = Object.freeze({
    apply,
    current: () => root.dataset.theme,
  });
})(globalThis);
