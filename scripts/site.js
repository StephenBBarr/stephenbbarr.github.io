(function initialiseSite(portfolio) {
  "use strict";

  function initialiseThemeButton() {
    const themeButton = document.querySelector("#theme-toggle");
    if (!themeButton) {
      return;
    }

    themeButton.hidden = false;
    updateThemeLabel(themeButton);
    themeButton.addEventListener("click", () => {
      const nextTheme = portfolio.theme.current() === "dark" ? "light" : "dark";
      portfolio.theme.apply(nextTheme);
      updateThemeLabel(themeButton);
    });
  }

  function updateThemeLabel(button) {
    button.textContent = portfolio.theme.current() === "dark"
      ? "Light appearance"
      : "Dark appearance";
  }

  function redirectLegacyPost() {
    const query = new URLSearchParams(location.search);
    const slug = query.get("post");
    if (!slug || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return;
    }
    // Keep previously shared /blog/?post=... links working.
    location.replace(`/blog/${slug}/${location.hash || ""}`);
  }

  initialiseThemeButton();
  if (document.documentElement.dataset.page === "blog") {
    redirectLegacyPost();
  }
})(globalThis.Portfolio);
