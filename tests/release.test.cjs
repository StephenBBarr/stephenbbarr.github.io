"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { checkRelease } = require("../scripts/check-release.cjs");
const { siteOrigin } = require("../scripts/content.cjs");

const settings = { production: {
  enabled: true, portfolioOrigins: [siteOrigin],
  bridgeBase: "https://bridge.example.test/", capsuleIndex: "gemini://capsule.example.test/blog/",
} };
const index = "# Blog\n=> posts/first.gmi 2026-09-03 First post\n=> posts/second.gmi 2026-09-04 Second post\n";
function fixture(change = () => {}) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url: url.href, options });
    const headers = new Headers({ "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    if (settings.production.portfolioOrigins.includes(options.headers.Origin)) headers.set("access-control-allow-origin", options.headers.Origin);
    const response = { headers, status: 200, body: url.pathname === "/blog/index" ? index : "# A post\nText.\n" };
    change(response, url, options);
    return new Response(response.body, { headers: response.headers, status: response.status });
  } };
}

test("the release check refuses an unpublished blog before making any request", async () => {
  const { fetcher, calls } = fixture();
  await assert.rejects(checkRelease({ settings: { production: { ...settings.production, enabled: false } }, fetcher }), /Public blog is not ready/);
  assert.equal(calls.length, 0);
});

test("the release check reads every indexed public post and verifies CORS boundaries", async () => {
  const { fetcher, calls } = fixture();
  assert.equal((await checkRelease({ settings, fetcher })).posts, 2);
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), ["/blog/index", "/blog/posts/first", "/blog/posts/second", "/blog/index"]);
  for (const { options } of calls) {
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert(options.signal instanceof AbortSignal);
  }
});

test("a broken public article blocks the release even when the index is healthy", async () => {
  const { fetcher } = fixture((r, url) => { if (url.pathname.endsWith("/second")) r.status = 404; });
  await assert.rejects(checkRelease({ settings, fetcher }), /second: HTTP 404/);
});

test("wrong media types, missing CORS and unsafe response headers block a release", async () => {
  for (const [header, value, expected] of [
    ["content-type", "text/html", /plain Gemtext/],
    ["access-control-allow-origin", "*", /exact origin/],
    ["x-content-type-options", "", /nosniff/],
    ["cache-control", "public", /no-store/],
  ]) {
    const { fetcher } = fixture((r) => r.headers.set(header, value));
    await assert.rejects(checkRelease({ settings, fetcher }), expected);
  }
});

test("bad or duplicate dated blog entries and empty indexes cannot pass release checks", async () => {
  for (const body of ["# Blog\n", index + "=> posts/first.gmi 2026-09-03 Duplicate\n",
    "# Blog\n=> posts/first.gmi 2026-02-31 Bad date\n",
    "# Blog\n=> gemini://other.example.test/blog/posts/first.gmi 2026-09-03 Wrong capsule\n"]) {
    const { fetcher } = fixture((r, url) => { if (url.pathname === "/blog/index") r.body = body; });
    await assert.rejects(checkRelease({ settings, fetcher }), /invalid or duplicate|no dated posts/);
  }
});

test("CORS permission for an unrelated site blocks the release", async () => {
  const { fetcher } = fixture((r, url, options) => r.headers.set("access-control-allow-origin", options.headers.Origin));
  await assert.rejects(checkRelease({ settings, fetcher }), /unapproved browser origin/);
});

test("fenced examples are not treated as published posts during release checks", async () => {
  const { fetcher, calls } = fixture((r, url) => {
    if (url.pathname === "/blog/index") r.body = index + "```Example\n=> posts/example.gmi 2026-09-08 Example\n```\n";
    if (url.pathname === "/blog/posts/example") r.status = 404;
  });
  assert.equal((await checkRelease({ settings, fetcher })).posts, 2);
  assert(!calls.some(({ url }) => url.endsWith("/example")));
});

test("a fenced-only index cannot satisfy the published-post requirement", async () => {
  const { fetcher } = fixture((r, url) => {
    if (url.pathname === "/blog/index") r.body = "# Blog\n```Example\n=> posts/example.gmi 2026-09-08 Example\n```\n";
  });
  await assert.rejects(checkRelease({ settings, fetcher }), /no dated posts/);
});
