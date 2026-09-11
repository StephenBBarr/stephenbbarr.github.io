(function initialisePost(renderer) {
  "use strict";

  const post = document.querySelector("#blog-post");
  if (!post) {
    return;
  }
  const body = document.querySelector("#blog-body");
  const status = document.querySelector("#blog-status");
  const retry = document.querySelector("#blog-retry");
  let loading = false;
  let retryAt = 0;
  let retryTimer;
  let missingPostMetadata;

  async function load() {
    if (loading || Date.now() < retryAt) {
      return;
    }

    loading = true;
    const restoreFocus = document.activeElement === retry;
    body.setAttribute("aria-busy", "true");
    retry.setAttribute("aria-disabled", "true");
    showStatus("Loading the post…");

    try {
      const address = postAddress();
      const text = await fetchPost(address);
      const article = renderer.render(text, {
        baseUrl: new URL(`posts/${post.dataset.postSlug}.gmi`, post.dataset.capsuleIndex).href,
        capsuleIndex: post.dataset.capsuleIndex,
        titleFallback: "",
      });
      const heading = article.querySelector("h1");
      if (!heading.textContent.trim()) {
        throw postError("The post returned no readable title. Please try again.");
      }
      heading.remove();

      if (!post.isConnected) {
        return;
      }
      const content = document.createDocumentFragment();
      while (article.firstChild) {
        content.append(article.firstChild);
      }
      body.replaceChildren(content);
      missingPostMetadata?.remove();
      missingPostMetadata = undefined;
      showStatus("Post loaded.", true);
      if (restoreFocus && document.activeElement === retry) {
        body.setAttribute("tabindex", "-1");
        body.focus({ preventScroll: true });
      }
      retry.hidden = true;
    } catch (error) {
      if (!post.isConnected) {
        return;
      }
      showStatus(errorMessage(error));
      if (error?.missingPost && !missingPostMetadata) {
        missingPostMetadata = document.createElement("meta");
        missingPostMetadata.name = "robots";
        missingPostMetadata.content = "noindex";
        document.head.append(missingPostMetadata);
      }
      if (error?.retryDelay) {
        retryAt = Date.now() + error.retryDelay;
      }
      retry.hidden = error?.retryable === false;
    } finally {
      loading = false;
      body.removeAttribute("aria-busy");
      updateRetry();
    }
  }

  function postAddress() {
    let address;
    let capsule;
    try {
      address = post.dataset.postUrl && new URL(post.dataset.postUrl, location.href);
      capsule = new URL(post.dataset.capsuleIndex);
    } catch {
      throw invalidAddress();
    }
    if (!address) {
      throw invalidAddress();
    }
    const validAddress = ["http:", "https:"].includes(address.protocol)
      && !address.username && !address.password && !address.search && !address.hash;
    if (!validAddress || capsule.protocol !== "gemini:" || !renderer.postName(post.dataset.postSlug)) {
      throw invalidAddress();
    }
    return address;
  }

  function invalidAddress() {
    const error = postError("This post address is not valid. Return to the blog to choose another post.");
    error.retryable = false;
    return error;
  }

  function postError(message) {
    const error = new Error(message);
    error.userFacing = true;
    return error;
  }

  function errorMessage(error) {
    if (error?.userFacing) {
      return error.message;
    }
    if (error instanceof TypeError) {
      return "The post could not be reached. Check your connection and try again.";
    }
    return "The post could not be loaded. Please try again.";
  }

  async function fetchPost(address) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(address, {
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "text/plain" },
      });
      try {
        validateResponse(response);
      } catch (error) {
        try {
          await response.body?.cancel();
        } catch {
          // Keep the useful response error if cancelling its body also fails.
        }
        throw error;
      }
      return await readText(response);
    } catch (error) {
      if (controller.signal.aborted) {
        throw postError("The post took too long to respond. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function validateResponse(response) {
    if (!response.ok) {
      if (response.status === 429) {
        const error = postError("The blog is receiving too many requests. Please wait before trying again.");
        error.retryDelay = retryDelay(response.headers.get("Retry-After"));
        throw error;
      }
      if (response.status === 404) {
        const error = postError("This post could not be found. Return to the blog to choose another post.");
        error.missingPost = true;
        throw error;
      }
      throw postError("The post is temporarily unavailable. Please try again.");
    }

    const mediaType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (mediaType !== "text/plain") {
      throw postError("The blog returned a page that could not be read. Please try again.");
    }
    if (Number(response.headers.get("Content-Length")) > 1024 * 1024) {
      throw postError("The post is too large to display.");
    }
  }

  async function readText(response) {
    if (!response.body) {
      throw postError("The post was empty. Please try again.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let byteCount = 0;
    let text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        byteCount += value.byteLength;
        if (byteCount > 1024 * 1024) {
          throw postError("The post is too large to display.");
        }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } catch (error) {
      try {
        await reader.cancel();
      } catch {
        // Keep the original read error.
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  function retryDelay(header) {
    const wait = /^\d+$/.test(header || "")
      ? Number(header) * 1000
      : Date.parse(header) - Date.now();
    return Number.isFinite(wait) ? Math.max(1000, wait) : 60000;
  }

  function updateRetry() {
    clearTimeout(retryTimer);
    if (loading) {
      retry.setAttribute("aria-disabled", "true");
      return;
    }
    const remaining = retryAt - Date.now();
    if (remaining > 0) {
      retry.setAttribute("aria-disabled", "true");
      retryTimer = setTimeout(updateRetry, Math.min(remaining, 2147483647));
    } else {
      retry.removeAttribute("aria-disabled");
    }
  }

  function showStatus(message, hidden = false) {
    status.className = hidden ? "message visually-hidden" : "message";
    status.textContent = message;
  }

  retry.addEventListener("click", load);
  load();
})(globalThis.Portfolio.gemtext);
