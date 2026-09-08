"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const rootPath = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootPath, file), "utf8");
const scripts = [
  "scripts/config.js",
  "scripts/gemtext.js",
  "scripts/blog.js",
];

// Deliberately small DOM stand-in. These tests exercise actual application
// scripts, not browser layout, focus, live-region announcements or CORS.
class Element {
  constructor(tagName, ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.parentNode = null;
    this.connected = false;
    this.listeners = new Map();
  }

  get textContent() {
    return this.children
      .map((child) => typeof child === "string" ? child : child.textContent)
      .join("");
  }

  set textContent(value) {
    const text = String(value);
    this.replaceChildren(...(text ? [text] : []));
  }

  get isConnected() {
    return this.connected || Boolean(this.parentNode?.isConnected);
  }

  append(...items) {
    for (const item of items) {
      if (item?.tagName === "#fragment") {
        this.append(...item.children);
        item.children = [];
      } else {
        if (typeof item !== "string") item.parentNode = this;
        this.children.push(item);
      }
    }
  }

  replaceChildren(...items) {
    for (const item of this.children) {
      if (typeof item !== "string") item.parentNode = null;
    }
    this.children = [];
    this.append(...items);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() { this.listeners.get("click")?.(); }

  focus() { this.ownerDocument.activeElement = this; }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }

  querySelector(selector) {
    const tags = selector.split(",").map((part) => part.trim());
    function find(node) {
      for (const child of node.children || []) {
        if (tags.includes(child.tagName)) return child;
        const nested = find(child);
        if (nested) return nested;
      }
      return null;
    }
    return find(this);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }
}

const index = [
  "\uFEFF# Blog",
  "Introduction",
  "",
  "## Posts",
  "=> posts/new.gmi 2026-09-03 New",
  "=> posts/old.gmi 2026-09-02 Old",
  "=> ../ Back",
  "",
].join("\r\n");

function response(text, status = 200, type = "text/plain; charset=utf-8") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => type },
    text: async () => text,
  };
}

function createApp({
  origin = "http://127.0.0.1:8000",
  fetch = async () => response(index),
  settings,
  timer = setTimeout,
} = {}) {
  const metadata = parseHTML('<html><head><link rel="canonical" href="https://stephenbbarr.github.io/blog/"><meta property="og:url" content="https://stephenbbarr.github.io/blog/"><meta property="og:title" content="Blog — Stephen Barr"></head></html>').document;
  const document = {
    activeElement: null,
    title: "Blog — Stephen Barr",
    createElement: (tag) => new Element(tag, document),
    createDocumentFragment: () => new Element("#fragment", document),
    createTextNode: (text) => String(text),
    querySelector: (selector) => metadata.querySelector(selector),
  };
  const context = vm.createContext({
    document,
    Portfolio: {},
    location: { origin },
    URL,
    AbortController,
    setTimeout: timer,
    clearTimeout,
    TypeError,
    Error,
    fetch,
  });

  for (const file of scripts) {
    vm.runInContext(read(file), context, { filename: file });
    if (file === "scripts/config.js" && settings) {
      const configuration = context.Portfolio.blogConfiguration;
      context.Portfolio.blogConfiguration = Object.freeze({
        profiles: settings,
        resolve: (address) => configuration.resolve(address, settings),
      });
    }
  }

  const root = new Element("root");
  root.connected = true;

  return {
    portfolio: context.Portfolio,
    configuration: context.Portfolio.blogConfiguration.resolve(origin),
    document,
    root,
    showIndex() {
      return attach({ root }, context.Portfolio.blog.showIndex());
    },
    readPost(slug) {
      return attach({ root }, context.Portfolio.blog.readPostBySlug(slug));
    },
  };
}

const drain = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setImmediate(resolve));
};

function productionSettings(overrides = {}) {
  const defaults = createApp().portfolio.blogConfiguration.profiles;
  return {
    local: defaults.local,
    production: {
      ...defaults.production,
      enabled: true,
      bridgeBase: "https://bridge.example.test/",
      capsuleIndex: "gemini://capsule.example.test/blog/",
      ...overrides,
    },
  };
}

test("all shipped scripts parse and load in HTML dependency order", () => {
  for (const file of scripts) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }));
  }
  const { document } = parseHTML(read("blog/index.html"));
  const scriptElements = [...document.querySelectorAll("script[src]")];
  const scriptPath = (script) => new URL(script.getAttribute("src"), "https://portfolio.example.test").pathname;
  const sources = scriptElements.map(scriptPath);
  for (const script of scriptElements) {
    const source = scriptPath(script);
    assert(script.getAttribute("src").startsWith("/"), `Script source must use an absolute site path: ${source}`);
    assert(fs.existsSync(path.join(rootPath, source.slice(1))), `Missing script: ${source}`);
    if (source === "/scripts/theme.js") assert(!script.hasAttribute("defer"));
    else assert(script.hasAttribute("defer"), `Script must defer until the page is ready: ${source}`);
  }
  const positions = scripts.map((file) => sources.indexOf(`/${file}`));
  assert(positions.every((value, i) => value >= 0 && (i === 0 || value > positions[i - 1])));
});

test("direct post reads omit credentials and redirects and request fresh content", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url, options) => {
    requests.push(url.pathname);
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return response("# New post");
  } });
  const output = app.readPost("new");
  await drain();
  assert.equal(descendants(output, "h1")[0].textContent, "New post");
  app.readPost("new");
  await drain();
  assert.deepEqual(requests, ["/blog/posts/new", "/blog/posts/new"]);
});

test("each blog page reads fresh content and post pages do not need the index", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    return response(url.pathname === "/blog/index" ? index : "# Old post");
  } });
  app.showIndex();
  await drain();
  app.root.replaceChildren();
  app.readPost("old");
  await drain();
  app.root.replaceChildren();
  app.showIndex();
  await drain();
  assert.deepEqual(requests, ["/blog/index", "/blog/posts/old", "/blog/index"]);
});

test("detached index output stays removed when the request finishes", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => {
    await pending;
    return response(index);
  } });
  const output = app.showIndex();
  await drain();
  const before = output.textContent;
  app.root.replaceChildren();
  release();
  await drain();
  assert.equal(app.root.children.length, 0);
  assert.equal(output.textContent, before);
});

test("failed index loads can be retried", async () => {
  let fail = true;
  let count = 0;
  const app = createApp({ fetch: async () => {
    count++;
    return fail ? response("", 502) : response(index);
  } });
  const failed = app.showIndex();
  await drain();
  assert.match(failed.textContent, /temporarily unavailable/);
  fail = false;
  const retried = app.showIndex();
  await drain();
  assert.match(retried.textContent, /Introduction/);
  assert.equal(count, 2);
});

test("empty index still displays its complete content", async () => {
  const output = createApp({ fetch: async () => response("# Empty\nIntroduction\n") }).showIndex();
  await drain();
  assert.match(output.textContent, /EmptyIntroduction/);
  assert.match(output.textContent, /There are no published posts/);
});

test("Gemtext renders structure and treats HTML and link targets as text", () => {
  const renderer = createApp().portfolio.gemtext;
  const article = renderer.render("# Title\n## Sub\n### Minor\n* One\n* Two\n\n> Quote\n```Code\n# Literal\n<script>alert(1)</script>\n```\n=> javascript:alert(1) literal\n<strong>plain</strong>\n");
  assert.deepEqual(article.children.map((node) => node.tagName), ["h1", "h2", "h3", "ul", "blockquote", "pre", "p", "p"]);
  assert.equal(article.children[3].children.length, 2);
  const pre = article.children[5];
  assert.equal(pre.textContent, "# Literal\n<script>alert(1)</script>");
  assert.equal(pre.attributes["aria-label"], "Code");
  assert.equal(pre.tabIndex, 0);
  assert.equal(article.children[6].textContent, "=> javascript:alert(1) literal");
  assert.equal(article.children[7].textContent, "<strong>plain</strong>");
  assert.equal(descendants(renderer.render("```\nUnclosed\n"), "pre")[0].textContent, "Unclosed");
});

test("index excludes foreign URLs, queries, bad dates, duplicates and fenced links", async () => {
  const source = "# Blog\n```\n=> posts/fake.gmi 2026-09-03 Fake\n```\n=> https://elsewhere.test/blog/posts/no.gmi 2026-09-03 External\n=> posts/bad.gmi 2026-02-30 Invalid date\n=> posts/new.gmi?x=1 2026-09-03 Query\n=> posts/new.gmi 2026-09-03 New\n=> posts/new.gmi 2026-09-03 Duplicate\n=> gemini://localhost:1965/blog/posts/old.gmi 2026-09-02 Old\n";
  const app = createApp({ fetch: async () => response(source) });
  const output = app.showIndex();
  await drain();
  const entries = descendants(output, "p").filter((node) => node.className === "blog-index-entry");
  assert.deepEqual(entries.map((entry) => descendants(entry, "a")[0].attributes.href), ["/blog/?post=new", "/blog/?post=old"]);
});

test("HTTP 429 gives a retry message and permits a later successful read", async () => {
  let limited = true;
  const app = createApp({ fetch: async () => limited ? response("", 429) : response(index) });
  const output = app.showIndex();
  await drain();
  assert.match(output.textContent, /too many requests.*try again/);
  limited = false;
  const retry = app.showIndex();
  await drain();
  assert.match(retry.textContent, /Introduction/);
});

test("unexpected media type and network failures display errors", async () => {
  for (const [fetch, expected] of [
    [async () => response("<html>", 200, "text/html"), /page that could not be read/],
    [async () => { throw new TypeError("network failure"); }, /could not be reached/],
  ]) {
    const output = createApp({ fetch }).showIndex();
    await drain();
    assert.match(output.textContent, expected);
  }
});

test("a timed-out request aborts and displays a retry message", async () => {
  const app = createApp({
    timer: (callback) => setTimeout(callback, 1),
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  const output = app.showIndex();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.match(output.textContent, /timed out.*Try again/);
});

test("only the exact local origin activates the local profile", async () => {
  const configuration = createApp().portfolio.blogConfiguration;
  assert.equal(configuration.resolve("http://127.0.0.1:8000").profile, "local");
  for (const origin of ["http://localhost:8000", "http://127.0.0.1:9000", "null", "https://stephenbbarr.github.io", "https://unlisted.example.test"]) {
    let count = 0;
    const output = createApp({ origin, fetch: async () => { count++; return response(index); } }).showIndex();
    await drain();
    assert.match(output.textContent, /not been published yet/);
    assert.equal(count, 0);
  }
  assert.equal(configuration.profiles.production.enabled, false);
  assert.equal(configuration.profiles.production.bridgeBase, "");
  assert.equal(configuration.profiles.production.capsuleIndex, "");
});

test("production routes only to HTTPS and resolves absolute capsule links", async () => {
  const requests = [];
  const settings = productionSettings();
  const app = createApp({
    origin: "https://stephenbbarr.github.io",
    settings,
    fetch: async (url) => {
      requests.push(url.href);
      return response(url.pathname === "/blog/index"
        ? "# Blog\n=> gemini://capsule.example.test/blog/posts/new.gmi 2026-09-03 New\n"
        : "# Public post");
    },
  });
  app.showIndex();
  await drain();
  const output = app.readPost("new");
  await drain();
  assert.equal(descendants(output, "h1")[0].textContent, "Public post");
  assert.deepEqual(requests, ["https://bridge.example.test/blog/index", "https://bridge.example.test/blog/posts/new"]);
  const config = createApp().portfolio.blogConfiguration;
  assert.equal(config.resolve("https://unlisted.example.test", settings).ready, false);
  settings.production.portfolioOrigins = ["https://stephenbbarr.github.io", "https://portfolio.example.test"];
  assert.equal(config.resolve("https://portfolio.example.test", settings).ready, true);
  assert.equal(config.resolve("http://127.0.0.1:8000", settings).profile, "local");
});

for (const [name, overrides] of [
  ["HTTP mixed content", { bridgeBase: "http://bridge.example.test/" }],
  ["blank bridge", { bridgeBase: "" }],
  ["relative bridge", { bridgeBase: "/bridge/" }],
  ["missing bridge slash", { bridgeBase: "https://bridge.example.test/api" }],
  ["credentials", { bridgeBase: "https://user:password@bridge.example.test/" }],
  ["query", { bridgeBase: "https://bridge.example.test/?target=elsewhere" }],
  ["fragment", { capsuleIndex: "gemini://capsule.example.test/blog/#part" }],
  ["HTTP capsule", { capsuleIndex: "https://capsule.example.test/blog/" }],
  ["missing capsule host", { capsuleIndex: "gemini:/blog/" }],
  ["wrong capsule path", { capsuleIndex: "gemini://capsule.example.test/posts/" }],
  ["IPv4 loopback bridge", { bridgeBase: "https://127.0.0.1/" }],
  ["IPv6 loopback bridge", { bridgeBase: "https://[::1]/" }],
  ["mapped IPv6 bridge", { bridgeBase: "https://[::ffff:127.0.0.1]/" }],
  ["mapped IPv6 capsule", { capsuleIndex: "gemini://[::ffff:127.0.0.1]/blog/" }],
  ["mapped IPv6 origin", { portfolioOrigins: ["https://[::ffff:7f00:1]"] }],
  ["shortened IPv4 bridge", { bridgeBase: "https://127.1/" }],
  ["shortened IPv4 capsule", { capsuleIndex: "gemini://127.1/blog/" }],
  ["decimal IPv4 bridge", { bridgeBase: "https://2130706433/" }],
  ["decimal IPv4 capsule", { capsuleIndex: "gemini://2130706433/blog/" }],
  ["hexadecimal IPv4 bridge", { bridgeBase: "https://0x7f000001/" }],
  ["hexadecimal IPv4 capsule", { capsuleIndex: "gemini://0x7f000001/blog/" }],
  ["octal IPv4 bridge", { bridgeBase: "https://0177.0.0.1/" }],
  ["octal IPv4 capsule", { capsuleIndex: "gemini://0177.0.0.1/blog/" }],
  ["non-loopback IPv4 bridge", { bridgeBase: "https://192.168.1.1/" }],
  ["numeric TLD capsule", { capsuleIndex: "gemini://capsule.123/blog/" }],
  ["single-label capsule", { capsuleIndex: "gemini://capsule/blog/" }],
  ["underscore in capsule hostname", { capsuleIndex: "gemini://my_capsule.example.test/blog/" }],
  ["leading hyphen in capsule label", { capsuleIndex: "gemini://-capsule.example.test/blog/" }],
  ["trailing hyphen in capsule label", { capsuleIndex: "gemini://capsule-.example.test/blog/" }],
  ["overlength capsule label", { capsuleIndex: `gemini://${"a".repeat(64)}.example.test/blog/` }],
  ["localhost bridge", { bridgeBase: "https://localhost/" }],
  ["trailing-dot localhost bridge", { bridgeBase: "https://localhost./" }],
  ["localhost capsule", { capsuleIndex: "gemini://localhost/blog/" }],
  ["uppercase localhost capsule", { capsuleIndex: "gemini://LOCALHOST/blog/" }],
  ["local bridge", { bridgeBase: "https://bridge.local/" }],
  ["localdomain capsule", { capsuleIndex: "gemini://capsule.localdomain/blog/" }],
  ["internal capsule", { capsuleIndex: "gemini://capsule.internal/blog/" }],
  ["home.arpa capsule", { capsuleIndex: "gemini://capsule.home.arpa/blog/" }],
  ["local origin", { portfolioOrigins: ["https://portfolio.local"] }],
  ["origin path", { portfolioOrigins: ["https://stephenbbarr.github.io/"] }],
  ["HTTP origin", { portfolioOrigins: ["http://stephenbbarr.github.io"] }],
  ["non-list origins", { portfolioOrigins: "https://stephenbbarr.github.io" }],
  ["empty origins", { portfolioOrigins: [] }],
  ["non-boolean enabled", { enabled: "true" }],
]) {
  test(`invalid production configuration fails closed: ${name}`, async () => {
    let count = 0;
    const app = createApp({
      origin: "https://stephenbbarr.github.io",
      settings: productionSettings(overrides),
      fetch: async () => { count++; return response(index); },
    });
    const output = app.showIndex();
    await drain();
    assert.match(output.textContent, /settings are incomplete/);
    assert.match(app.configuration.error, /configuration is invalid/);
    assert.equal(count, 0);
  });
}

function descendants(node, tagName) {
  const result = [];
  for (const child of node.children || []) {
    if (child.tagName === tagName) result.push(child);
    if (typeof child !== "string") result.push(...descendants(child, tagName));
  }
  return result;
}

function attach(app, output) {
  app.root.append(output);
  return output;
}

test("text index keeps the complete index and offers titles with readable dates", async () => {
  const app = createApp();
  const output = attach(app, app.portfolio.blog.showIndex());
  await drain();
  assert.deepEqual(descendants(output, "h1").map((node) => node.textContent), ["Blog"]);
  assert.match(output.textContent, /Introduction/);
  assert.match(output.textContent, /New 3 September 2026/);
  assert.match(output.textContent, /Old 2 September 2026/);
  assert(!output.textContent.includes("blog read"));
  assert.deepEqual(descendants(output, "time").map((node) => node.attributes.datetime), ["2026-09-03", "2026-09-02"]);
  assert.deepEqual(descendants(output, "a").slice(0, 2).map((node) => node.attributes.href), ["/blog/?post=new", "/blog/?post=old"]);
});

test("direct post links render one article and update the document title", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    return response("# A quiet morning\nOne paragraph.\n\n## A thought\nAnother paragraph.\n# Another title\nLast paragraph.");
  } });
  const output = app.readPost("quiet-morning");
  await drain();
  assert.deepEqual(requests, ["/blog/posts/quiet-morning"]);
  assert.deepEqual(descendants(output, "h1").map((node) => node.textContent), ["A quiet morning"]);
  assert.equal(descendants(output, "article").length, 1);
  assert.equal(descendants(output, "a")[0].attributes.href, "/blog/");
  assert.equal(app.document.title, "A quiet morning — Stephen Barr");
  assert.equal(app.document.querySelector('link[rel="canonical"]').getAttribute("href"), "https://stephenbbarr.github.io/blog/?post=quiet-morning");
  assert.equal(app.document.querySelector('meta[property="og:url"]').content, "https://stephenbbarr.github.io/blog/?post=quiet-morning");
  assert.equal(app.document.querySelector('meta[property="og:title"]').content, app.document.title);
  assert.equal(output.attributes["aria-busy"], undefined);
});

test("post names are checked before a request is sent", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url) => { requests.push(url.pathname); return response(""); } });
  for (const slug of ["../secret", "wrong.gmi", "has?query", "UPPER", "a".repeat(81), "", null, "a--b"]) {
    const output = app.readPost(slug);
    await drain();
    assert.match(output.textContent, /address is not valid/);
    assert.equal(descendants(output, "a")[0].attributes.href, "/blog/");
    assert.equal(descendants(output, "button").length, 0);
    assert.equal(app.document.title, "Blog — Stephen Barr");
  }
  assert.deepEqual(requests, []);
});

test("Gemtext links map only this capsule's valid blog addresses to portfolio pages", () => {
  const app = createApp();
  const source = [
    "# Links", "=> ../ Blog", "=> next.gmi Next", "=> gemini://localhost:1965/blog/index.gmi Index",
    "=> https://example.test/page Web", "=> http://example.test/ Plain web", "=> mailto:hello@example.test Email",
    "=> gemini://elsewhere.test/blog/posts/next.gmi Other capsule",
    "=> gemini://localhost:1966/blog/posts/next.gmi Different port",
    "=> next.gmi?query=1 Query", "=> javascript:alert(1) Unsafe", "=> data:text/html,bad Data",
    "=> https://user:password@example.test/ Credentials", "=> ../../ Elsewhere on this capsule",
    "=> bad--name.gmi Invalid post", "=> next.gmi#part Fragment",
  ].join("\n");
  const article = app.portfolio.gemtext.render(source, {
    baseUrl: "gemini://localhost/blog/posts/current.gmi", capsuleIndex: "gemini://localhost/blog/",
  });
  const links = descendants(article, "a");
  assert.equal(links[0].attributes.href, "/blog/");
  assert.equal(links[1].attributes.href, "/blog/?post=next");
  assert.equal(links[2].attributes.href, links[0].attributes.href);
  assert.equal(links[3].attributes.href, "https://example.test/page");
  assert.equal(links[4].attributes.href, "http://example.test/");
  assert.equal(links[5].attributes.href, "mailto:hello@example.test");
  assert(links.slice(6).every((node) => node.textContent.endsWith("(Gemini browser)")));
  assert(article.textContent.includes("=> javascript:alert(1) Unsafe"));
  assert(article.textContent.includes("=> data:text/html,bad Data"));
  assert(article.textContent.includes("=> https://user:password@example.test/ Credentials"));
  assert(links.every((node) => !node.attributes.href.startsWith("javascript:") && !node.attributes.href.startsWith("data:")));

});

test("failed requests offer a working retry button in the same output", async () => {
  let fail = true;
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    return fail ? response("", 502) : response(index);
  } });
  const output = attach(app, app.portfolio.blog.showIndex());
  await drain();
  assert.match(output.textContent, /temporarily unavailable/);
  assert.equal(descendants(output, "h1").length, 1);
  const retry = descendants(output, "button")[0];
  assert.equal(retry.textContent, "Try again");
  fail = false;
  retry.click();
  assert.equal(output.children[0].attributes["aria-busy"], "true");
  await drain();
  assert.match(output.textContent, /Introduction/);
  assert.equal(descendants(output, "button").length, 0);
  assert.deepEqual(requests, ["/blog/index", "/blog/index"]);
});

test("detached post results cannot alter output or announce a new reading location", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => { await pending; return response("# Late result"); } });
  const output = attach(app, app.portfolio.blog.readPostBySlug("late"));
  await drain();
  const before = output.textContent;
  app.root.replaceChildren();
  release();
  await drain();
  assert.equal(output.textContent, before);
  assert.equal(app.document.title, "Blog — Stephen Barr");
});

test("unpublished blog and missing posts give a readable page with one title and useful links", async () => {
  const app = createApp({ origin: "https://stephenbbarr.github.io" });
  const output = attach(app, app.portfolio.blog.showIndex());
  await drain();
  assert.equal(app.configuration.ready, false);
  assert.match(output.textContent, /has not been published yet/);
  assert.equal(descendants(output, "h1").length, 1);
  assert.equal(descendants(output, "button").length, 0);
  const missingApp = createApp({ fetch: async () => response("", 404) });
  const missing = attach(missingApp, missingApp.portfolio.blog.readPostBySlug("missing"));
  await drain();
  assert.match(missing.textContent, /could not be found/);
  assert.equal(descendants(missing, "h1").length, 1);
  assert.equal(descendants(missing, "a")[0].attributes.href, "/blog/");
  assert.equal(missingApp.document.title, "Blog — Stephen Barr");
});

test("text articles without a title and with fenced headings retain exactly one page heading", () => {
  const renderer = createApp().portfolio.gemtext;
  const article = renderer.render("```Code\n# Code heading\n```\n## Subheading\nText");
  assert.deepEqual(descendants(article, "h1").map((node) => node.textContent), ["Blog post"]);
  assert.equal(descendants(article, "pre")[0].textContent, "# Code heading");
});

test("Gemtext keeps orphan subheadings at a consistent depth until a parent section appears", () => {
  const renderer = createApp().portfolio.gemtext;
  const article = renderer.render("# Title\n### First section\n### Another section\n## Parent section\n### Child\n### Sibling\n# Final section\n### Final child");
  assert.deepEqual(article.children.map((node) => [node.tagName, node.textContent]), [
    ["h1", "Title"], ["h2", "First section"], ["h2", "Another section"],
    ["h2", "Parent section"], ["h3", "Child"], ["h3", "Sibling"],
    ["h2", "Final section"], ["h3", "Final child"],
  ]);
});

test("blank Gemtext headings cannot become an empty page title or empty outline entries", () => {
  const renderer = createApp().portfolio.gemtext;
  const article = renderer.render("#  \n## \n###\n### Readable section");
  assert.deepEqual(descendants(article, "h1").map((node) => node.textContent), ["Blog post"]);
  assert.deepEqual(descendants(article, "h2").map((node) => node.textContent), ["Readable section"]);
  assert.equal(descendants(article, "h3").length, 0);
  assert.deepEqual(descendants(article, "p").map((node) => node.textContent), ["#  ", "## ", "###"]);
});

test("keyboard retry keeps focus during loading and moves to the article when it succeeds", async () => {
  let release;
  let count = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => {
    count++;
    if (count === 1) return response("", 502);
    await pending;
    return response("# Reading can resume\nThe post content.");
  } });
  const output = attach(app, app.portfolio.blog.readPostBySlug("resume"));
  await drain();
  const retry = descendants(output, "button")[0];
  retry.focus();
  retry.click();
  assert.equal(app.document.activeElement, retry);
  assert.equal(retry.isConnected, true);
  assert.equal(retry.attributes["aria-disabled"], "true");
  retry.click();
  assert.equal(count, 2, "repeated clicks while loading must not start another request");
  release();
  await drain();
  const heading = descendants(output, "h1")[0];
  assert.equal(app.document.activeElement, heading);
  assert.equal(heading.textContent, "Reading can resume");
  assert.equal(heading.attributes.tabindex, "-1");
  assert.equal(retry.isConnected, false);
});

test("failed keyboard retry keeps the same focused control available for another attempt", async () => {
  const app = createApp({ fetch: async () => response("", 502) });
  const output = attach(app, app.portfolio.blog.showIndex());
  await drain();
  const retry = descendants(output, "button")[0];
  retry.focus();
  retry.click();
  await drain();
  assert.equal(app.document.activeElement, retry);
  assert.equal(descendants(output, "button")[0], retry);
  assert.equal(retry.isConnected, true);
  assert.equal(retry.attributes["aria-disabled"], undefined);
  assert.match(output.textContent, /temporarily unavailable/);
});

test("successful index retry focuses the visible article named by its hidden heading", async () => {
  let requests = 0;
  const app = createApp({ fetch: async () => ++requests === 1 ? response("", 502) : response(index) });
  const output = app.showIndex();
  await drain();
  const retry = descendants(output, "button")[0];
  retry.focus();
  retry.click();
  await drain();
  const article = descendants(output, "article")[0];
  const heading = descendants(article, "h1")[0];
  assert.equal(app.document.activeElement, article);
  assert.equal(article.attributes.tabindex, "-1");
  assert(!article.className.includes("visually-hidden"), "the retry target must support a visible focus outline");
  assert.equal(article.attributes["aria-labelledby"], heading.attributes.id);
  assert.equal(heading.attributes.id, "blog-heading");
  assert.equal(heading.textContent, "Blog");
  assert(heading.className.includes("visually-hidden"));
  assert.equal(heading.attributes.tabindex, undefined);
});

test("initial loading and a retry the reader leaves do not move focus from another control", async () => {
  let release;
  let count = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => {
    count++;
    if (count === 1) return response("", 502);
    await pending;
    return response(index);
  } });
  const other = app.document.createElement("a");
  app.root.append(other);
  other.focus();
  const output = attach(app, app.portfolio.blog.showIndex());
  await drain();
  assert.equal(app.document.activeElement, other);
  const retry = descendants(output, "button")[0];
  retry.focus();
  retry.click();
  other.focus();
  release();
  await drain();
  assert.equal(app.document.activeElement, other);
  assert.equal(descendants(output, "h1")[0].attributes.tabindex, undefined);
});

function statusParagraphs(output) {
  return descendants(output, "p").filter((node) => node.attributes.role === "status");
}

test("text blog mounts one empty live region before requesting and updates it when the index is ready", async () => {
  let release;
  let requests = 0;
  let status;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => {
    requests++;
    assert.equal(status.isConnected, true, "the live region must be mounted before the first request");
    assert.equal(status.textContent, "Loading the blog…");
    await pending;
    return response(index);
  } });
  const output = app.portfolio.blog.showIndex();
  [status] = statusParagraphs(output);
  assert(status);
  assert.equal(status.textContent, "");
  assert.equal(status.isConnected, false);
  assert.equal(requests, 0);
  attach(app, output);
  await drain();
  assert.equal(requests, 1);
  assert.equal(statusParagraphs(output).length, 1);
  assert.equal(statusParagraphs(output)[0], status);
  assert.equal(status.attributes["aria-live"], "polite");
  assert.equal(status.attributes["aria-atomic"], "true");
  assert.equal(output.attributes["aria-busy"], undefined, "the status must remain outside the busy content");
  assert.equal(output.children[0].attributes["aria-busy"], "true");
  assert.equal(status.textContent, "Loading the blog…");
  release();
  await drain();
  assert.equal(statusParagraphs(output)[0], status);
  assert.equal(status.textContent, "Blog loaded.");
  assert(status.className.includes("visually-hidden"));
  assert.equal(output.children[0].attributes["aria-busy"], undefined);
  assert(!status.textContent.includes("Introduction"), "announce completion without reading the whole article");
});

test("one post status region survives errors and retry through to successful reading", async () => {
  let requests = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createApp({ fetch: async () => {
    requests++;
    if (requests === 1) return response("", 502);
    await pending;
    return response("# A readable post\nThe article remains outside the live region.");
  } });
  const output = attach(app, app.portfolio.blog.readPostBySlug("readable"));
  const [status] = statusParagraphs(output);
  await drain();
  assert.equal(statusParagraphs(output)[0], status);
  assert.equal(status.textContent, "The blog is temporarily unavailable. Please try again.");
  assert(!status.className.includes("visually-hidden"));
  assert.equal(output.textContent.split("temporarily unavailable").length - 1, 1);
  const retry = descendants(output, "button")[0];
  retry.focus();
  retry.click();
  assert.equal(statusParagraphs(output)[0], status);
  assert.equal(status.textContent, "Loading the post…");
  assert.equal(app.document.activeElement, retry);
  release();
  await drain();
  assert.equal(statusParagraphs(output).length, 1);
  assert.equal(statusParagraphs(output)[0], status);
  assert.equal(status.textContent, "Post loaded.");
  assert(status.className.includes("visually-hidden"));
  assert.equal(app.document.activeElement, descendants(output, "h1")[0]);
  assert.equal(statusParagraphs(descendants(output, "article")[0]).length, 0);
});

test("unused index and post outputs start no request", async () => {
  let requests = 0;
  const app = createApp({ fetch: async () => { requests++; return response(index); } });
  const indexOutput = app.portfolio.blog.showIndex();
  const postOutput = app.portfolio.blog.readPostBySlug("new");
  await drain();
  assert.equal(requests, 0);
  assert.equal(statusParagraphs(indexOutput)[0].textContent, "");
  assert.equal(statusParagraphs(postOutput)[0].textContent, "");
  assert.equal(app.document.title, "Blog — Stephen Barr");
});
