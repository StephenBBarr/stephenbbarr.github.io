"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootPath = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootPath, file), "utf8");
const scripts = [
  "scripts/content.js",
  "scripts/components.js",
  "scripts/config.js",
  "scripts/gemtext.js",
  "scripts/blog.js",
  "scripts/commands.js",
];

// Deliberately small DOM stand-in. These tests exercise actual application
// scripts, not browser layout, focus, live-region announcements or CORS.
class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.parentNode = null;
    this.connected = false;
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
  const document = {
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element("#fragment"),
    createTextNode: (text) => String(text),
  };
  const context = vm.createContext({
    document,
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
    root,
    run(command) {
      const result = context.Portfolio.commands.dispatch(command);
      if (result.type === "clear") root.replaceChildren();
      if (result.response) root.append(result.response);
      return result.response;
    },
  };
}

const drain = () => new Promise((resolve) => setImmediate(resolve));

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
  for (const file of [...scripts, "script.js"]) {
    assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }));
  }
  const html = read("index.html");
  const positions = [...scripts, "script.js"].map((file) =>
    html.indexOf(`<script src="${file}" defer></script>`),
  );
  assert(positions.every((value, i) => value >= 0 && (i === 0 || value > positions[i - 1])));
});

test("direct read loads the index and the highest number selects the newest post", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url, options) => {
    requests.push(url.pathname);
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return response(url.pathname === "/blog/index" ? index : "# New post");
  } });
  const output = app.run("blog read 2");
  await drain();
  assert.equal(output.textContent, "New post");
  assert.deepEqual(requests, ["/blog/index", "/blog/posts/new"]);
});

test("index preserves its content, descending numbers, literal links and command highlight", async () => {
  const output = createApp().run("blog");
  await drain();
  assert.match(output.textContent, /BlogIntroduction/);
  assert.match(output.textContent, /2\. 2026-09-03 — New/);
  assert.match(output.textContent, /1\. 2026-09-02 — Old/);
  assert.match(output.textContent, /=> \.\.\/ Back/);
  assert(output.children.some((child) => child.children?.some((node) =>
    node.tagName === "code" && node.textContent === "blog read <number>",
  )));
});

test("clear retains the index while each post read fetches fresh content", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    return response(url.pathname === "/blog/index" ? index : "# Old post");
  } });
  app.run("blog read 1");
  await drain();
  app.run("clear");
  app.run("blog");
  await drain();
  app.run("blog read 1");
  await drain();
  assert.equal(requests.filter((url) => url === "/blog/index").length, 1);
  assert.equal(requests.filter((url) => url === "/blog/posts/old").length, 2);
  assert(!read("script.js").includes("portfolio.blog.reset"));
});

test("invalid numbers do not fetch; out-of-range numbers fetch only the missing index", async () => {
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    return response(index);
  } });
  for (const command of ["blog read", "blog read 0", "blog read -1", "blog read abc", "blog read 1.5", "blog read 9007199254740992"]) {
    const output = app.run(command);
    await drain();
    assert.match(output.textContent, /Usage:|too large/);
  }
  assert.equal(requests.length, 0);
  const output = app.run("blog read 999");
  await drain();
  assert.match(output.textContent, /not in the current blog index/);
  assert.deepEqual(requests, ["/blog/index"]);
});

test("concurrent commands share a pending index and cleared output stays removed", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requests = [];
  const app = createApp({ fetch: async (url) => {
    requests.push(url.pathname);
    if (url.pathname === "/blog/index") await pending;
    return response(url.pathname === "/blog/index" ? index : "# Post");
  } });
  app.run("blog read 2");
  app.run("blog");
  assert.deepEqual(requests, ["/blog/index"]);
  app.run("clear");
  release();
  await drain();
  assert.equal(app.root.children.length, 0);
  app.run("blog");
  await drain();
  assert.equal(requests.filter((url) => url === "/blog/index").length, 1);
});

test("failed index loads can be retried", async () => {
  let fail = true;
  let count = 0;
  const app = createApp({ fetch: async () => {
    count++;
    return fail ? response("", 502) : response(index);
  } });
  const failed = app.run("blog");
  await drain();
  assert.match(failed.textContent, /Agate/);
  fail = false;
  const retried = app.run("blog");
  await drain();
  assert.match(retried.textContent, /Introduction/);
  assert.equal(count, 2);
});

test("empty index still displays its complete content", async () => {
  const output = createApp({ fetch: async () => response("# Empty\nIntroduction\n") }).run("blog");
  await drain();
  assert.match(output.textContent, /EmptyIntroduction/);
  assert.match(output.textContent, /No supported dated post links/);
});

test("Gemtext renders structure and treats HTML and link targets as text", () => {
  const renderer = createApp().portfolio.gemtext;
  const article = renderer.render("# Title\n## Sub\n### Minor\n* One\n* Two\n\n> Quote\n```Code\n# Literal\n<script>alert(1)</script>\n```\n=> javascript:alert(1) literal\n<strong>plain</strong>\n");
  assert.deepEqual(article.children.map((node) => node.tagName), ["h2", "h3", "h4", "ul", "div", "blockquote", "pre", "p", "p"]);
  assert.equal(article.children[3].children.length, 2);
  const pre = article.children[6];
  assert.equal(pre.textContent, "# Literal\n<script>alert(1)</script>");
  assert.equal(pre.attributes["aria-label"], "Code");
  assert.equal(pre.tabIndex, 0);
  assert.equal(article.children[7].textContent, "=> javascript:alert(1) literal");
  assert.equal(article.children[8].textContent, "<strong>plain</strong>");
  assert.equal(renderer.render("```\nUnclosed\n").children[0].textContent, "Unclosed");
});

test("index excludes foreign URLs, queries, bad dates, duplicates and fenced links", async () => {
  const source = "# Blog\n```\n=> posts/fake.gmi 2026-09-03 Fake\n```\n=> https://elsewhere.test/blog/posts/no.gmi 2026-09-03 External\n=> posts/bad.gmi 2026-02-30 Invalid date\n=> posts/new.gmi?x=1 2026-09-03 Query\n=> posts/new.gmi 2026-09-03 New\n=> posts/new.gmi 2026-09-03 Duplicate\n=> gemini://localhost:1965/blog/posts/old.gmi 2026-09-02 Old\n";
  const output = createApp({ fetch: async () => response(source) }).run("blog");
  await drain();
  assert.match(output.textContent, /2\. 2026-09-03 — New/);
  assert.match(output.textContent, /1\. 2026-09-02 — Old/);
  assert(!output.textContent.includes("3."));
});

test("HTTP 429 gives a retry message and does not poison the index cache", async () => {
  let limited = true;
  const app = createApp({ fetch: async () => limited ? response("", 429) : response(index) });
  const output = app.run("blog");
  await drain();
  assert.match(output.textContent, /too many requests.*try again/);
  limited = false;
  const retry = app.run("blog");
  await drain();
  assert.match(retry.textContent, /Introduction/);
});

test("unexpected media type and network failures display errors", async () => {
  for (const [fetch, expected] of [
    [async () => response("<html>", 200, "text/html"), /expected plain text/],
    [async () => { throw new TypeError("network failure"); }, /Cannot read the bridge/],
  ]) {
    const output = createApp({ fetch }).run("blog");
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
  const output = app.run("blog");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.match(output.textContent, /timed out.*Try again/);
});

test("only the exact local origin activates the local profile", async () => {
  const configuration = createApp().portfolio.blogConfiguration;
  assert.equal(configuration.resolve("http://127.0.0.1:8000").profile, "local");
  for (const origin of ["http://localhost:8000", "http://127.0.0.1:9000", "null", "https://stephenbbarr.github.io", "https://unlisted.example.test"]) {
    let count = 0;
    const output = createApp({ origin, fetch: async () => { count++; return response(index); } }).run("blog");
    await drain();
    assert.match(output.textContent, /not configured for this address/);
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
  const output = app.run("blog read 1");
  await drain();
  assert.equal(output.textContent, "Public post");
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
    const output = app.run("blog");
    await drain();
    assert.match(output.textContent, /configuration is invalid/);
    assert.equal(count, 0);
  });
}
