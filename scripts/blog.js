(function initialiseBlog(portfolio) {
  "use strict";

  const configuration = portfolio.blogConfiguration.resolve(location.origin);
  const capsuleIndex = configuration.ready
    ? new URL(configuration.capsuleIndex)
    : null;
  function message(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "message";
    paragraph.textContent = text;
    return paragraph;
  }

  function postLink(line) {
    const match = /^=>[ \t]*(\S+)[ \t]+(\d{4}-\d{2}-\d{2})[ \t]+(.+)$/.exec(line);
    if (!match) return null;

    const [, target, date, label] = match;
    const title = label.trim();
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (!title || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
      return null;
    }

    let url;
    try {
      url = new URL(target, capsuleIndex);
    } catch {
      return null;
    }
    if (
      url.protocol !== capsuleIndex.protocol ||
      url.hostname.toLowerCase() !== capsuleIndex.hostname.toLowerCase() ||
      (url.port || "1965") !== (capsuleIndex.port || "1965") ||
      url.username || url.password || url.search || url.hash
    ) {
      return null;
    }
    const slug = /^\/blog\/posts\/([^/]+)\.gmi$/.exec(url.pathname)?.[1];
    return portfolio.gemtext.postName(slug) ? { slug, date, title } : null;
  }

  async function fetchText(path) {
    if (!configuration.ready) {
      throw new Error(configuration.error);
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const response = await fetch(new URL(path, configuration.bridgeBase), {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "text/plain" },
      });

      if (!response.ok) {
        const errors = {
          400: "This post address is not valid.",
          404: "This page could not be found. Return to the blog to choose another post.",
          429: "The blog is receiving too many requests. Please wait a little, then try again.",
          502:
            "The blog is temporarily unavailable. Please try again.",
          504: "The blog took too long to respond. Please try again.",
        };

        throw new Error(
          errors[response.status] ||
            "The blog could not be loaded. Please try again.",
        );
      }

      const mediaType = response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();

      if (mediaType !== "text/plain") {
        throw new Error(
          "The blog returned a page that could not be read. Please try again.",
        );
      }

      return await response.text();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          "The blog request timed out. Try again.",
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function asyncOutput(loadingText, operation, { title = "Blog", slug } = {}) {
    const output = document.createElement("section");
    output.className = "blog-response stack";
    const content = document.createElement("div");
    content.className = "blog-content stack";
    output.append(content);
    const status = message("");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    output.append(status);
    let loading = false;
    let retryButton = null;

    function pageMessage() {
      const fragment = document.createDocumentFragment();
      if (title === "Blog post") {
        const back = document.createElement("a");
        back.className = "blog-back";
        back.setAttribute("href", "/blog/");
        back.textContent = "Back to blog";
        fragment.append(back);
      }
      const heading = document.createElement("h1");
      heading.textContent = title;
      if (title === "Blog") heading.className = "visually-hidden";
      fragment.append(heading);
      return fragment;
    }

    async function run(fromRetry = false) {
      if (loading) return;
      loading = true;
      const activeRetry = retryButton;
      const restoreFocus = fromRetry && document.activeElement === activeRetry;
      content.setAttribute("aria-busy", "true");
      status.className = "message";
      status.textContent = loadingText;
      // Keep the retry control in place during the request so keyboard focus
      // remains stable. aria-disabled prevents repeated requests without the
      // focus loss caused by removing or disabling a focused button.
      if (activeRetry) activeRetry.setAttribute("aria-disabled", "true");
      content.replaceChildren(pageMessage());
      try {
        const result = await operation();
        if (!output.isConnected) return;
        const focusResult = restoreFocus && document.activeElement === activeRetry;
        content.replaceChildren(result);
        status.className = "message visually-hidden";
        status.textContent = title === "Blog post" ? "Post loaded." : "Blog loaded.";
        activeRetry?.remove();
        retryButton = null;
        if (focusResult) {
          // The index heading is visually hidden; focus its named, visible
          // article so keyboard readers can see where reading resumes.
          const readingStart = content.querySelector(title === "Blog" ? "article" : "h1") || content;
          readingStart.setAttribute("tabindex", "-1");
          readingStart.focus({ preventScroll: true });
        }
        if (title === "Blog post") {
          document.title = `${content.querySelector("h1").textContent} — Stephen Barr`;
          const canonical = document.querySelector('link[rel="canonical"]');
          if (canonical) {
            const address = new URL(portfolio.gemtext.webAddress(slug), canonical.getAttribute("href")).href;
            canonical.setAttribute("href", address);
            document.querySelector('meta[property="og:url"]')?.setAttribute("content", address);
          }
          document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
        }
      } catch (error) {
        if (!output.isConnected) return;
        const detail = !configuration.ready
          ? (configuration.error.includes("configuration is invalid")
            ? "The blog cannot be opened because its settings are incomplete."
            : "The blog has not been published yet.")
          : error instanceof TypeError
            ? "The blog could not be reached. Check your connection and try again."
            : error.message;
        content.replaceChildren(pageMessage());
        status.className = "message";
        status.textContent = detail;
        if (configuration.ready && error.code !== "invalid-post") {
          if (!retryButton) {
            retryButton = document.createElement("button");
            retryButton.setAttribute("type", "button");
            retryButton.className = "text-button blog-retry";
            retryButton.textContent = "Try again";
            retryButton.addEventListener("click", () => run(true));
            output.append(retryButton);
          }
          retryButton.removeAttribute("aria-disabled");
        }
      } finally {
        loading = false;
        if (output.isConnected) content.removeAttribute("aria-busy");
      }
    }

    content.replaceChildren(pageMessage());
    // Mount the empty live region before its first update and request.
    // An output discarded before attachment starts no request.
    setTimeout(() => { if (output.isConnected) run(); }, 0);
    return output;
  }

  function showIndex() {
    return asyncOutput("Loading the blog…", async () => {
      const indexText = await fetchText("blog/index");
      const seen = new Set();
      const dateFormat = new Intl.DateTimeFormat("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      });
      const result = document.createDocumentFragment();
      const page = portfolio.gemtext.render(indexText, {
        baseUrl: configuration.capsuleIndex,
        capsuleIndex: configuration.capsuleIndex,
        titleFallback: "Blog",
        renderLink: (line) => {
          const post = postLink(line);
          if (!post || seen.has(post.slug)) return null;
          seen.add(post.slug);
          const entry = document.createElement("p");
          entry.className = "blog-index-entry";
          const link = document.createElement("a");
          link.setAttribute("href", portfolio.gemtext.webAddress(post.slug));
          link.textContent = post.title;
          const date = document.createElement("time");
          date.setAttribute("datetime", post.date);
          date.className = "meta blog-date";
          date.textContent = dateFormat.format(new Date(`${post.date}T00:00:00Z`));
          entry.append(link, " ", date);
          return entry;
        },
      });
      const heading = page.querySelector("h1");
      if (heading) {
        heading.className = "visually-hidden";
        heading.setAttribute("id", "blog-heading");
        page.setAttribute("aria-labelledby", "blog-heading");
      }
      result.append(page);
      if (!seen.size) {
        result.append(message("There are no published posts to read yet."));
      }
      return result;
    });
  }

  async function postContent(slug) {
    if (!portfolio.gemtext.postName(slug)) {
      const error = new Error("This post address is not valid.");
      error.code = "invalid-post";
      throw error;
    }
    const text = await fetchText(`blog/posts/${slug}`);
    const content = document.createDocumentFragment();
    const back = document.createElement("a");
    back.className = "blog-back";
    back.setAttribute("href", "/blog/");
    back.textContent = "Back to blog";
    content.append(back);
    content.append(portfolio.gemtext.render(text, {
      baseUrl: new URL(`posts/${slug}.gmi`, configuration.capsuleIndex).href,
      capsuleIndex: configuration.capsuleIndex,
    }));
    return content;
  }

  function readPostBySlug(slug) {
    return asyncOutput("Loading the post…", () => postContent(slug), { title: "Blog post", slug });
  }

  portfolio.blog = Object.freeze({
    showIndex,
    readPostBySlug,
  });
})(globalThis.Portfolio);
