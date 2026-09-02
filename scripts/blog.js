(function initialiseBlog(portfolio) {
  "use strict";

  const configuration = portfolio.blogConfiguration.resolve(location.origin);
  const capsuleIndex = configuration.ready
    ? new URL(configuration.capsuleIndex)
    : null;
  let posts = null;
  let postsPromise = null;
  let indexText = null;

  const message = (text) => portfolio.components.createMessage(text);

  function parseIndex(text) {
    const entries = [];
    const seen = new Set();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    let preformatted = false;

    for (const [lineNumber, line] of lines.entries()) {
      if (line.startsWith("```")) {
        preformatted = !preformatted;
        continue;
      }

      if (preformatted) continue;

      const match =
        /^=>[ \t]*(\S+)[ \t]+(\d{4}-\d{2}-\d{2})[ \t]+(.+)$/.exec(line);

      if (!match) continue;

      const [, target, date, label] = match;
      const title = label.trim();
      const timestamp = Date.parse(`${date}T00:00:00Z`);

      if (
        !title ||
        !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== date
      ) {
        continue;
      }

      let url;

      try {
        url = new URL(target, capsuleIndex);
      } catch {
        continue;
      }

      if (
        url.protocol !== capsuleIndex.protocol ||
        url.hostname.toLowerCase() !==
          capsuleIndex.hostname.toLowerCase() ||
        (url.port || "1965") !== (capsuleIndex.port || "1965") ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        continue;
      }

      const path =
        /^\/blog\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\.gmi$/.exec(
          url.pathname,
        );
      const slug = path?.[1];

      if (!slug || slug.length > 80 || seen.has(slug)) continue;

      seen.add(slug);
      entries.push({ slug, date, title, lineNumber });
    }

    return entries;
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
          400: "The bridge rejected this post name.",
          404: "The selected blog document was not found.",
          429: "The blog is receiving too many requests. Please wait a little, then try again.",
          502:
            "The bridge could not fetch the document. Check that Agate is running.",
          504: "The capsule took too long to respond. Try again.",
        };

        throw new Error(
          errors[response.status] ||
            `Blog request failed: HTTP ${response.status}.`,
        );
      }

      const mediaType = response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();

      if (mediaType !== "text/plain") {
        throw new Error(
          "The bridge did not return the expected plain text.",
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

  function asyncOutput(loadingText, operation) {
    const output = document.createElement("section");
    output.className = "blog-response stack";
    output.setAttribute("aria-busy", "true");
    output.append(message(loadingText));

    (async () => {
      try {
        const result = await operation();

        if (!output.isConnected) {
          return;
        }

        output.replaceChildren(result);
      } catch (error) {
        if (!output.isConnected) {
          return;
        }

        const detail =
          error instanceof TypeError
            ? "Cannot read the bridge. Check it is running and its CORS settings allow this portfolio address."
            : error.message;

        output.replaceChildren(message(detail));
      } finally {
        output.removeAttribute("aria-busy");
      }
    })();

    return output;
  }

  async function loadPosts() {
    if (posts !== null) {
      return posts;
    }

    if (postsPromise === null) {
      postsPromise = (async () => {
        const text = await fetchText("blog/index");
        const loaded = parseIndex(text);

        // Keep the complete page and its post numbering from the same fetch.
        indexText = text;
        posts = loaded;
        return loaded;
      })().finally(() => {
        postsPromise = null;
      });
    }

    return postsPromise;
  }

  function showIndex() {
    return asyncOutput(
      "Loading the blog index…",
      async () => {
        const availablePosts = await loadPosts();
        const postsByLine = new Map(
          availablePosts.map((post, index) => [
            post.lineNumber,
            { ...post, number: availablePosts.length - index },
          ]),
        );
        const result = document.createDocumentFragment();
        const page = portfolio.gemtext.render(indexText, {
          renderLink: (_line, lineNumber) => {
            const post = postsByLine.get(lineNumber);
            if (!post) return null;

            const entry = document.createElement("p");
            entry.textContent = `${post.number}. ${post.date} — ${post.title}`;
            return entry;
          },
        });

        const hint = message(
          "No supported dated post links were found in this index.",
        );

        if (availablePosts.length) {
          const command = document.createElement("code");
          command.textContent = "blog read <number>";
          hint.replaceChildren(
            "Use ",
            command,
            ". Newest posts have the highest numbers in the cached index for this page.",
          );
        }

        result.append(page, hint);

        return result;
      },
    );
  }

  function readPost(argument) {
    if (!/^[1-9]\d*$/.test(argument)) {
      return message(
        "Usage: blog read <number>, for example blog read 1.",
      );
    }

    const number = Number(argument);

    if (!Number.isSafeInteger(number)) {
      return message("That post number is too large.");
    }

    return asyncOutput(
      `Finding post ${number}…`,
      async () => {
        const availablePosts = await loadPosts();

        if (number > availablePosts.length) {
          return message(
            "That number is not in the current blog index. Run blog to see the available posts.",
          );
        }

        // The index is newest-first, while post numbers count up from the oldest.
        const post = availablePosts[availablePosts.length - number];
        const text = await fetchText(
          `blog/posts/${post.slug}`,
        );

        return portfolio.gemtext.render(text);
      },
    );
  }

  portfolio.blog = Object.freeze({
    showIndex,
    readPost,
  });
})(globalThis.Portfolio);
