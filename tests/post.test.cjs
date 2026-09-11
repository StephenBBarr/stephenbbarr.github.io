"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPostApp, textResponse, drain, manualClock } = require("./helpers/post-app.cjs");

function assertMetadataUnchanged(app) {
  assert.equal(app.document.title, app.initial.title);
  assert.equal(app.document.querySelector("h1"), app.initial.heading);
  assert.equal(app.document.querySelector("time"), app.initial.date);
  assert.equal(app.document.querySelectorAll("h1").length, 1);
  assert.equal(app.document.querySelector('link[rel="canonical"]').getAttribute("href"), app.initial.canonical);
  assert.equal(app.document.querySelector('meta[property="og:title"]').content, app.initial.openGraph);
}

test("opening a post fetches only its body and preserves its indexed title, date and metadata", async () => {
  const app = createPostApp({ fetcher: async () => textResponse("# A different source title\nThe requested post body.\n## A section\n=> old.gmi Older post\n") });
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].url, "https://bridge.example.test/blog/posts/new");
  assert.equal(app.requests[0].statusMounted, true);
  assert.match(app.requests[0].statusText, /Loading/);
  const options = app.requests[0].options;
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  assert.equal(options.headers.Accept, "text/plain");
  assert(options.signal instanceof AbortSignal);
  const elsewhere = app.document.querySelector("nav a");
  elsewhere.focus();
  await drain();
  assert.match(app.body.textContent, /The requested post body/);
  assert(!app.body.textContent.includes("A different source title"));
  assert.equal(app.body.querySelector("h2").textContent, "A section");
  assert.equal(app.body.querySelector("a").getAttribute("href"), "/blog/old/");
  assert.equal(app.document.activeElement, elsewhere);
  assert.equal(app.retry.hidden, true);
  assert.equal(app.body.hasAttribute("aria-busy"), false);
  assert.match(app.status.textContent, /Post loaded/);
  assert(app.status.classList.contains("visually-hidden"));
  assertMetadataUnchanged(app);
});

test("the index and nonblog pages make no post request", async () => {
  for (const file of ["blog/index.html", "index.html", "contact/index.html"]) {
    const app = createPostApp({ file, fetcher: async () => assert.fail("Unexpected fetch") });
    await drain();
    assert.equal(app.requests.length, 0);
  }
});

test("HTTP, network and malformed-content errors leave the shell readable with retry", async () => {
  const responses = [
    [async () => textResponse("", 404), /could not be found/],
    [async () => textResponse("", 502), /temporarily unavailable/],
    [async () => textResponse("", 504), /temporarily unavailable/],
    [async () => { throw new TypeError("offline"); }, /could not be reached/],
    [async () => textResponse("<html>", 200, { "content-type": "text/html" }), /could not be read/],
    [async () => new Response(new Uint8Array([1])), /could not be read/],
    [async () => textResponse(""), /readable title|empty/],
    [async () => textResponse("```Code\n# Fenced title\n```\nText"), /readable title/],
  ];
  for (const [fetcher, expected] of responses) {
    const app = createPostApp({ fetcher });
    const status = app.status;
    await drain();
    assert.match(app.status.textContent, expected);
    assert.equal(app.document.querySelector("#blog-status"), status);
    assert.equal(app.body.textContent, "");
    assert.equal(app.retry.hidden, false);
    assert.equal(app.retry.hasAttribute("aria-disabled"), false);
    assertMetadataUnchanged(app);
  }
});

test("a missing post adds noindex until a successful retry and preserves existing robots metadata", async () => {
  let existingMetadata;
  const app = createPostApp({
    editDocument(document) {
      existingMetadata = document.createElement("meta");
      existingMetadata.name = "robots";
      existingMetadata.content = "max-snippet:50";
      document.head.append(existingMetadata);
    },
    fetcher: async (_url, _options, count) => count < 3 ? textResponse("", 404) : textResponse(),
  });
  await drain();
  const metadata = [...app.document.querySelectorAll('meta[name="robots"]')];
  assert.equal(metadata.length, 2);
  const missingPostMetadata = metadata.find((node) => node !== existingMetadata);
  assert.equal(missingPostMetadata.content, "noindex");
  assert.equal(existingMetadata.content, "max-snippet:50");

  app.retry.click();
  await drain();
  assert.deepEqual([...app.document.querySelectorAll('meta[name="robots"]')], metadata);
  app.retry.click();
  await drain();
  assert.deepEqual([...app.document.querySelectorAll('meta[name="robots"]')], [existingMetadata]);
  assert.equal(existingMetadata.content, "max-snippet:50");
  assert.equal(missingPostMetadata.isConnected, false);
  assert.equal(app.retry.hidden, true);
  assertMetadataUnchanged(app);
});

test("temporary failures leave a post indexable and unexpected errors reveal no internal details", async () => {
  const failures = [
    ...[429, 500, 502, 504].map((status) => async () => textResponse("", status)),
    async () => { throw new TypeError("private network details"); },
    async () => { throw new Error("private implementation details"); },
    async () => { throw "private error details"; },
    async () => { throw null; },
  ];
  for (const fetcher of failures) {
    const app = createPostApp({ ...manualClock(), fetcher });
    await drain();
    assert.equal(app.document.querySelector('meta[name="robots"]'), null);
    assert.equal(app.retry.hidden, false);
    assert(!app.status.textContent.includes("private"));
    assert.match(app.status.textContent, /requests|unavailable|reached|loaded/);
    assertMetadataUnchanged(app);
  }
});

test("retry reuses its control and live region, blocks duplicate clicks and focuses the loaded body", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createPostApp({ fetcher: async (_url, _options, count) => {
    if (count === 1) return textResponse("", 502);
    await pending;
    return textResponse("# Source title\nReading can resume.");
  } });
  await drain();
  const retry = app.retry;
  const status = app.status;
  retry.focus();
  retry.click();
  retry.click();
  assert.equal(app.requests.length, 2);
  assert.equal(app.document.activeElement, retry);
  assert.equal(retry.getAttribute("aria-disabled"), "true");
  assert.equal(app.body.getAttribute("aria-busy"), "true");
  release();
  await drain();
  assert.equal(app.document.querySelector("#blog-retry"), retry);
  assert.equal(app.document.querySelector("#blog-status"), status);
  assert.equal(app.document.activeElement, app.body);
  assert.equal(app.body.getAttribute("tabindex"), "-1");
  assert.equal(retry.hidden, true);
  assert.match(app.body.textContent, /Reading can resume/);
  assertMetadataUnchanged(app);
});

test("failed retries retain focus and successful retries do not steal focus from another control", async () => {
  const failed = createPostApp({ fetcher: async () => textResponse("", 502) });
  await drain();
  failed.retry.focus();
  failed.retry.click();
  await drain();
  assert.equal(failed.document.activeElement, failed.retry);
  assert.equal(failed.retry.hidden, false);
  assert.equal(failed.retry.hasAttribute("aria-disabled"), false);

  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createPostApp({ fetcher: async (_url, _options, count) => {
    if (count === 1) return textResponse("", 502);
    await pending;
    return textResponse();
  } });
  await drain();
  app.retry.focus();
  app.retry.click();
  const elsewhere = app.document.querySelector("nav a");
  elsewhere.focus();
  release();
  await drain();
  assert.equal(app.document.activeElement, elsewhere);
  assert.equal(app.body.hasAttribute("tabindex"), false);
});

test("429 responses enforce Retry-After seconds, dates and the fallback delay", async () => {
  for (const [header, delay] of [["2", 2000], ["Fri, 11 Sep 2026 12:00:10 GMT", 10000], [undefined, 60000], ["0", 1000]]) {
    const clock = manualClock();
    const app = createPostApp({ ...clock, fetcher: async (_url, _options, count) => {
      const headers = header === undefined ? {} : { "retry-after": header };
      return count === 1 ? textResponse("", 429, headers) : textResponse();
    } });
    await drain();
    assert.match(app.status.textContent, /too many requests/);
    assert.equal(app.retry.getAttribute("aria-disabled"), "true");
    assert.deepEqual(clock.pendingDelays, [delay]);
    app.retry.click();
    assert.equal(app.requests.length, 1);
    clock.advance(delay);
    assert.equal(app.retry.hasAttribute("aria-disabled"), false);
    app.retry.click();
    await drain();
    assert.equal(app.requests.length, 2);
    assert.equal(app.retry.hidden, true);
    assert.deepEqual(clock.pendingDelays, []);
  }
});

test("timeouts abort the post request and offer a retry", async () => {
  const delays = [];
  const app = createPostApp({
    timer(callback, delay) { delays.push(delay); return setTimeout(callback, delay === 15000 ? 1 : delay); },
    fetcher: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert(delays.includes(15000));
  assert.equal(app.requests[0].options.signal.aborted, true);
  assert.match(app.status.textContent, /too long/);
  assert.equal(app.retry.hidden, false);
});

test("oversized response streams are cancelled without rendering their content", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  });
  const app = createPostApp({ fetcher: async () => new Response(stream, { headers: { "content-type": "text/plain" } }) });
  await drain();
  assert.equal(cancelled, true);
  assert.match(app.status.textContent, /too large/);
  assert.equal(app.body.textContent, "");
  assert.equal(app.retry.hidden, false);
});

test("a valid post with many short paragraphs renders within the response size limit", async () => {
  const paragraphCount = 130000;
  const app = createPostApp({ fetcher: async () => textResponse("# Source title\n" + "x\n".repeat(paragraphCount)) });
  await drain();
  assert.equal(app.body.children.length, paragraphCount);
  assert.equal(app.body.firstElementChild.textContent, "x");
  assert.equal(app.body.lastElementChild.textContent, "x");
  assert.equal(app.retry.hidden, true);
  assert.match(app.status.textContent, /Post loaded/);
  assertMetadataUnchanged(app);
});

test("streamed text decodes split characters and keeps HTML and unsafe links inert", async () => {
  const text = '# Source title\nCafé <img src="x" onerror="alert(1)">\n=> javascript:alert(1) Unsafe\n<script>alert(1)</script>\n';
  const bytes = new TextEncoder().encode(text);
  const boundary = bytes.indexOf(0xc3) + 1;
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.subarray(0, boundary));
    controller.enqueue(bytes.subarray(boundary));
    controller.close();
  } });
  const app = createPostApp({ fetcher: async () => new Response(stream, { headers: { "content-type": "text/plain" } }) });
  await drain();
  assert(app.body.textContent.includes('Café <img src="x" onerror="alert(1)">'));
  assert(app.body.textContent.includes("<script>alert(1)</script>"));
  assert(app.body.textContent.includes("javascript:alert(1)"));
  assert.equal(app.body.querySelector("script, img, [onerror], a"), null);
  assertMetadataUnchanged(app);
});

test("invalid shell addresses start no request and detached shells cannot receive late content", async () => {
  const invalid = createPostApp({ editDocument(document) {
    document.querySelector("#blog-post").dataset.postUrl = "javascript:alert(1)";
  } });
  await drain();
  assert.equal(invalid.requests.length, 0);
  assert.equal(invalid.retry.hidden, true);
  assert.match(invalid.status.textContent, /address is not valid/);

  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const app = createPostApp({ fetcher: async () => { await pending; return textResponse(); } });
  app.document.querySelector("#blog-post").remove();
  const status = app.status.textContent;
  release();
  await drain();
  assert.equal(app.body.textContent, "");
  assert.equal(app.status.textContent, status);
  assert.equal(app.document.title, app.initial.title);
  assert.equal(app.document.querySelector('link[rel="canonical"]').getAttribute("href"), app.initial.canonical);
});
