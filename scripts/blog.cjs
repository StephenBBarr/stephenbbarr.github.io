"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseHTML } = require("linkedom");
const gemtext = require("./gemtext.js");
const { renderTemplate, escape } = require("./pages.cjs");

const maximumTextBytes = 1024 * 1024;
const { document } = parseHTML("<!doctype html><html><body></body></html>");
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

async function loadBlog({ settings = require("./config.cjs"), fetcher = fetch, sourceDirectory, origin } = {}) {
  if (settings?.enabled === false) {
    return { ready: false, index: "", posts: [] };
  }

  const configuration = validateSettings(settings);
  const useSourceDirectory = sourceDirectory !== undefined;
  if (useSourceDirectory && (typeof sourceDirectory !== "string" || !sourceDirectory.trim())) {
    throw new Error("sourceDirectory must be a non-empty directory path.");
  }

  const index = useSourceDirectory
    ? await readBoundedText(fs.createReadStream(path.join(sourceDirectory, "index.gmi")), "blog/index")
    : await fetchBridgeText("blog/index", configuration.bridgeBase, fetcher, origin);
  requireTitle(index, "blog/index");
  const posts = parsePostIndex(index, configuration.capsuleIndex);

  // Titles, dates and addresses come from the index. Article bodies load on demand.
  return {
    ready: true,
    ...configuration,
    index,
    posts,
    ...(useSourceDirectory ? { sourceDirectory: path.resolve(sourceDirectory) } : {}),
  };
}

function renderIndex(blog) {
  if (!blog.ready) {
    const article = gemtext.render("# Blog\nThe blog has not been published yet.", { document });
    article.querySelector("h1").className = "visually-hidden";
    return article.outerHTML;
  }

  const publishedSlugs = new Set(blog.posts.map((post) => post.slug));
  const capsule = new URL(blog.capsuleIndex);
  const article = gemtext.render(blog.index, {
    document,
    baseUrl: blog.capsuleIndex,
    capsuleIndex: blog.capsuleIndex,
    publishedSlugs,
    titleFallback: "Blog",
    renderLink(line) {
      const post = parseDatedPost(line, capsule);
      return post && publishedSlugs.has(post.slug) ? createIndexEntry(post) : null;
    },
  });

  const heading = article.querySelector("h1");
  heading.className = "visually-hidden";
  heading.setAttribute("id", "blog-heading");
  article.setAttribute("aria-labelledby", "blog-heading");
  return article.outerHTML;
}

function renderPost(post, blog) {
  const capsuleUrl = new URL(`posts/${post.slug}.gmi`, blog.capsuleIndex).href;
  return renderTemplate("blog-post", {
    title: escape(post.title),
    date: escape(post.date),
    formattedDate: escape(dateFormat.format(new Date(`${post.date}T00:00:00Z`))),
    slug: escape(post.slug),
    postUrl: escape(postSource(post, blog)),
    capsuleIndex: escape(blog.capsuleIndex),
    capsuleUrl: escape(capsuleUrl),
  });
}

function postSource(post, blog) {
  return blog.sourceDirectory
    ? `/blog-source/${post.slug}.txt`
    : new URL(`blog/posts/${post.slug}`, blog.bridgeBase).href;
}

function parsePostIndex(index, capsuleIndex) {
  const capsule = new URL(capsuleIndex);
  const posts = [];
  const seen = new Set();
  let insideFence = false;

  for (const line of index.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (line.startsWith("```")) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) {
      continue;
    }

    const post = parseDatedPost(line, capsule);
    if (!post) {
      continue;
    }
    if (seen.has(post.slug)) {
      throw invalidPostEntry(line);
    }
    seen.add(post.slug);
    posts.push(post);
  }

  if (!posts.length) {
    throw new Error("The public blog index has no dated posts.");
  }
  return posts;
}

function parseDatedPost(line, capsule) {
  const match = /^=>[ \t]*(\S+)[ \t]+(\d{4}-\d{2}-\d{2})(?:[ \t]+(.*))?$/.exec(line);
  if (!match) {
    // A malformed post entry must not silently disappear from generated pages.
    if (isSameCapsulePostLink(line, capsule)) {
      throw invalidPostEntry(line);
    }
    return null;
  }

  const [, target, date, label] = match;
  const title = label?.trim();
  let address;
  try {
    address = new URL(target, capsule);
  } catch {
    throw invalidPostEntry(line);
  }

  const hasExtraAddressParts = address.username || address.password || address.search || address.hash;
  const slug = /^\/blog\/posts\/([^/]+)\.gmi$/.exec(address.pathname)?.[1];
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  const validDate = Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === date;

  if (!isSameCapsule(address, capsule) || hasExtraAddressParts || !gemtext.postName(slug) || !validDate || !title) {
    throw invalidPostEntry(line);
  }
  return { slug, date, title };
}

function isSameCapsulePostLink(line, capsule) {
  const target = /^=>[ \t]*(\S+)/.exec(line)?.[1];
  if (!target) {
    return false;
  }

  let address;
  try {
    address = new URL(target, capsule);
  } catch {
    return false;
  }
  return isSameCapsule(address, capsule)
    && /^\/blog\/posts\/[^/]*\.gmi$/.test(address.pathname);
}

function isSameCapsule(address, capsule) {
  return address.protocol === "gemini:"
    && capsule.protocol === "gemini:"
    && address.hostname.toLowerCase() === capsule.hostname.toLowerCase()
    && (address.port || "1965") === (capsule.port || "1965");
}

function invalidPostEntry(line) {
  return new Error(`The blog index contains an invalid or duplicate dated post: ${line}`);
}

async function fetchBridgeText(resourcePath, bridgeBase, fetcher, origin) {
  const signal = AbortSignal.timeout(15000);
  const response = await fetcher(new URL(resourcePath, bridgeBase), {
    headers: { Accept: "text/plain", ...(origin ? { Origin: origin } : {}) },
    redirect: "error",
    credentials: "omit",
    cache: "no-store",
    signal,
  });

  try {
    validateResponse(response, resourcePath);
    if (origin) {
      const allowedOrigin = response.headers.get("access-control-allow-origin");
      if (allowedOrigin !== origin && allowedOrigin !== "*") {
        throw new Error(`The bridge does not allow browser requests from ${origin}.`);
      }
    }
  } catch (error) {
    await response.body?.cancel();
    throw error;
  }
  return readBoundedText(response.body, resourcePath, signal);
}

function validateResponse(response, resourcePath) {
  if (!response.ok) {
    throw new Error(`${resourcePath}: HTTP ${response.status}`);
  }

  const mediaType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "text/plain") {
    throw new Error(`${resourcePath}: expected plain Gemtext from the bridge.`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > maximumTextBytes) {
    throw new Error(`${resourcePath}: empty or oversized content.`);
  }
}

async function readBoundedText(stream, resourcePath, signal) {
  if (!stream) {
    throw new Error(`${resourcePath}: empty or oversized content.`);
  }

  const chunks = [];
  let byteCount = 0;
  for await (const chunk of stream) {
    signal?.throwIfAborted();
    byteCount += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (byteCount > maximumTextBytes) {
      throw new Error(`${resourcePath}: empty or oversized content.`);
    }
    chunks.push(Buffer.from(chunk));
  }
  signal?.throwIfAborted();

  const text = Buffer.concat(chunks, byteCount).toString("utf8");
  if (!text.trim()) {
    throw new Error(`${resourcePath}: empty or oversized content.`);
  }
  return text;
}

function requireTitle(text, resourcePath) {
  let insideFence = false;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (line.startsWith("```")) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) {
      continue;
    }
    const heading = /^#(?!#)[ \t]*(.+)$/.exec(line);
    if (heading?.[1].trim()) {
      return heading[1].trim();
    }
  }
  throw new Error(`${resourcePath}: a meaningful article heading is required.`);
}

function createIndexEntry(post) {
  const entry = document.createElement("p");
  entry.className = "blog-index-entry";
  const link = document.createElement("a");
  link.setAttribute("href", gemtext.webAddress(post.slug));
  link.textContent = post.title;
  entry.append(link, " ", createDate(post.date));
  return entry;
}

function createDate(value) {
  const date = document.createElement("time");
  date.setAttribute("datetime", value);
  date.className = "meta blog-date";
  date.textContent = dateFormat.format(new Date(`${value}T00:00:00Z`));
  return date;
}

function validateSettings(settings) {
  if (settings?.enabled !== true) {
    throw new Error("enabled must be true or false.");
  }

  const bridge = parseAddress(settings.bridgeBase, "bridgeBase");
  const capsule = parseAddress(settings.capsuleIndex, "capsuleIndex");
  if (!bridge.pathname.endsWith("/")) {
    throw new Error("bridgeBase must end with a slash.");
  }
  if (capsule.protocol !== "gemini:" || capsule.pathname !== "/blog/") {
    throw new Error("capsuleIndex must be a gemini:// address ending in /blog/.");
  }

  const publicEndpoints = bridge.protocol === "https:"
    && isPublicDnsHost(bridge.hostname)
    && isPublicDnsHost(capsule.hostname);
  if (!publicEndpoints) {
    throw new Error("The public bridge must use HTTPS; public endpoints must use DNS hostnames, not IP addresses or local-only names.");
  }
  return { bridgeBase: bridge.href, capsuleIndex: capsule.href };
}

function parseAddress(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is missing.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (!url.hostname) {
    throw new Error(`${name} must include a hostname.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} cannot contain credentials, a query or a fragment.`);
  }
  return url;
}

function isPublicDnsHost(hostname) {
  const host = hostname.toLowerCase();
  const labels = host.split(".");
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (host.length > 253 || labels.length < 2) {
    return false;
  }
  if (!labels.every((label) => labelPattern.test(label))) {
    return false;
  }
  if (/^\d+$/.test(labels.at(-1))) {
    return false;
  }

  const localSuffixes = ["localhost", "local", "localdomain", "internal", "home.arpa"];
  return !localSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

module.exports = { loadBlog, renderIndex, renderPost, parsePostIndex, postSource };
