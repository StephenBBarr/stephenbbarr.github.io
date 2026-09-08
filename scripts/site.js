(function initialiseSite(portfolio) {
  "use strict";

  const themeButton = document.querySelector("#theme-toggle");
  function updateThemeLabel() {
    if (themeButton) themeButton.textContent = portfolio.theme.current() === "dark" ? "Light appearance" : "Dark appearance";
  }
  if (themeButton) {
    themeButton.hidden = false;
    updateThemeLabel();
    themeButton.addEventListener("click", () => {
      portfolio.theme.apply(portfolio.theme.current() === "dark" ? "light" : "dark");
      updateThemeLabel();
    });
  }

  const configuration = portfolio.blogConfiguration.resolve(location.origin);
  document.querySelectorAll('[data-section="blog"]').forEach((link) => { link.hidden = !configuration.ready; });

  if (document.documentElement.dataset.page === "blog") {
    const main = document.querySelector("#main-content");
    const query = new URLSearchParams(location.search);
    if (query.has("post") && !portfolio.gemtext.postName(query.get("post"))) {
      const heading = document.createElement("h1");
      heading.textContent = "Post not found";
      const message = document.createElement("p");
      message.textContent = "This post address is not valid.";
      const back = document.createElement("a");
      back.href = "/blog/";
      back.className = "blog-back";
      back.textContent = "Back to blog";
      main.replaceChildren(heading, message, back);
    } else {
      main.replaceChildren(query.has("post")
        ? portfolio.blog.readPostBySlug(query.get("post"))
        : portfolio.blog.showIndex());
    }
  }
})(globalThis.Portfolio);
