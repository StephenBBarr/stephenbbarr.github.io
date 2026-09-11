"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parseHTML } = require("linkedom");
const { loadBlog, parsePostIndex, renderIndex, renderPost } = require("../scripts/blog.cjs");
const gemtext = require("../scripts/gemtext.js");
const { blog, disabledBlog, settings, writeBlogDirectory, createFetcher } = require("./helpers/blog-content.cjs");

const rendererDocument = parseHTML("<html><body></body></html>").document;
const renderGemtext = (text, options = {}) => gemtext.render(text, { document: rendererDocument, ...options });
const documentFor = (html) => parseHTML(`<html><body>${html}</body></html>`).document;

// The build reads the index without fetching individual articles.

test("the blog loader reads only the index and leaves post bodies for readers", async () => {
  const { fetcher, calls } = createFetcher();
  assert.deepEqual(await loadBlog({ settings, fetcher }), blog);
  assert.deepEqual(calls.map(({ url }) => url), [
    "https://bridge.example.test/blog/index",
  ]);
  for (const { options } of calls) {
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Accept, "text/plain");
    assert.equal(options.headers.Origin, undefined);
    assert(options.signal instanceof AbortSignal);
  }
});

test("disabled blogs need neither endpoints nor network access", async () => {
  const fetcher = async () => assert.fail("A disabled blog must make no request");
  assert.deepEqual(await loadBlog({ settings: { enabled: false }, fetcher }), disabledBlog);
});

test("failed index requests stop the build with the failing resource", async () => {
  for (const failedPath of ["/blog/index"]) {
    for (const status of [400, 404, 429, 500, 502, 504]) {
      const { fetcher } = createFetcher((response, url) => {
        if (url.pathname === failedPath) response.status = status;
      });
      await assert.rejects(loadBlog({ settings, fetcher }), (error) => {
        assert(error.message.includes(failedPath.slice(1)), error.message);
        assert(error.message.includes(`HTTP ${status}`), error.message);
        return true;
      });
    }
  }
  await assert.rejects(loadBlog({ settings, fetcher: async () => { throw new TypeError("network unavailable"); } }), /network unavailable/);
});

test("wrong or missing response media types cannot become published HTML", async () => {
  for (const type of [null, "text/html", "application/json"]) {
    const { fetcher } = createFetcher((response) => {
      response.headers = type ? { "content-type": type } : {};
    });
    await assert.rejects(loadBlog({ settings, fetcher }), /plain Gemtext/);
  }
  const { fetcher } = createFetcher((response) => {
    response.headers["content-type"] = "Text/Plain; charset=utf-8";
  });
  assert.equal((await loadBlog({ settings, fetcher })).posts.length, 2);
});

test("oversized streamed content is cancelled before it can be published", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  });
  const fetcher = async () => new Response(body, { headers: { "content-type": "text/plain" } });
  await assert.rejects(loadBlog({ settings, fetcher }), /oversized|too large/i);
  assert.equal(cancelled, true);
});

test("the loader supplies a bounded timeout and fails if the request is aborted", async (t) => {
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 15000);
    return AbortSignal.abort(new DOMException("test timeout", "TimeoutError"));
  });
  const fetcher = async (_url, { signal }) => {
    assert.equal(signal.aborted, true);
    throw signal.reason;
  };
  await assert.rejects(loadBlog({ settings, fetcher }), /timeout|timed out/i);
});

test("an empty index or a heading present only inside a fence stops publication", async () => {
  for (const body of ["", "  \n", "Plain text without a title", "```Example\n# A heading in code\n```\nText."]) {
    const { fetcher } = createFetcher((response, url) => {
      if (url.pathname === "/blog/index") response.body = body;
    });
    await assert.rejects(loadBlog({ settings, fetcher }), /empty|meaningful article heading/);
  }
});

test("the offline loader needs only the index and makes no requests", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-blog-source-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeBlogDirectory(directory);
  fs.writeFileSync(path.join(directory, "posts/unlisted.gmi"), "Not a published article");
  const fetcher = async () => assert.fail("Offline builds must not fetch");
  assert.deepEqual(await loadBlog({ settings, fetcher, sourceDirectory: directory }), { ...blog, sourceDirectory: directory });
  fs.unlinkSync(path.join(directory, "posts/new.gmi"));
  assert.deepEqual(await loadBlog({ settings, fetcher, sourceDirectory: directory }), { ...blog, sourceDirectory: directory });
  fs.writeFileSync(path.join(directory, "index.gmi"), "# Blog\n" + "é".repeat(1024 * 512));
  await assert.rejects(loadBlog({ settings, fetcher, sourceDirectory: directory }), /oversized|too large/i);

});

// Only valid, dated links outside code fences become published posts.

test("the index preserves order and labels while ignoring fenced examples", () => {
  const source = blog.index + "```Example\n=> posts/ignored.gmi 2026-09-04 Example\n```\n=> ../ Back\n";
  assert.deepEqual(parsePostIndex(source, settings.capsuleIndex), blog.posts.map(({ slug, date, title }) => ({ slug, date, title })));
});

test("invalid or duplicate dated links cannot produce paths outside the published blog", () => {
  for (const target of [
    "posts/../secret.gmi", "posts/UPPER.gmi", "posts/a--b.gmi", `posts/${"a".repeat(81)}.gmi`,
    "posts/new.gmi?query=1", "posts/new.gmi#part", "posts/new.gmi/extra", "https://elsewhere.test/blog/posts/new.gmi",
    "gemini://elsewhere.test/blog/posts/new.gmi", "gemini://user:password@capsule.example.test/blog/posts/new.gmi",
    "gemini://capsule.example.test:1966/blog/posts/new.gmi",
  ]) {
    assert.throws(() => parsePostIndex(`# Blog\n=> ${target} 2026-09-03 Invalid\n`, settings.capsuleIndex), /invalid|dated/i, target);
  }
  for (const source of [
    "# Blog\n", "# Blog\n```\n=> posts/example.gmi 2026-09-03 Example\n```\n",
    "# Blog\n=> posts/new.gmi 2026-02-30 Invalid date\n", blog.index + "=> posts/new.gmi 2026-09-04 Duplicate\n",
  ]) {
    assert.throws(() => parsePostIndex(source, settings.capsuleIndex), /invalid|duplicate|no dated posts/i);
  }
});

test("post links with missing or malformed dates cannot silently disappear from the build", () => {
  for (const entry of [
    "=> posts/unlisted.gmi Missing date",
    "=> posts/unlisted.gmi 2026-9-11 Wrong date format",
    "=> posts/unlisted.gmi 2026-09-11Title",
    "=> posts/unlisted.gmi 2026-09-11",
    "=> posts/unlisted.gmi",
    "=> gemini://capsule.example.test/blog/posts/unlisted.gmi Missing date",
  ]) {
    assert.throws(() => parsePostIndex(blog.index + entry + "\n", settings.capsuleIndex), /invalid or duplicate dated post/, entry);
  }
});

test("ordinary undated links remain part of the index without becoming posts", () => {
  const index = blog.index + [
    "=> https://example.test/ A useful website",
    "=> gemini://elsewhere.test/blog/posts/another.gmi Another writer",
    "=> / Capsule home",
    "=> /blog/ Blog home",
    "=> index.gmi This index",
  ].join("\n");
  assert.deepEqual(parsePostIndex(index, settings.capsuleIndex), blog.posts);
});

test("a hundred indexed posts still require only one build request", async () => {
  const index = "# Blog\n" + Array.from({ length: 100 }, (_, i) => `=> posts/post-${i}.gmi 2026-09-03 Post ${i}`).join("\n");
  const { fetcher, calls } = createFetcher((response) => { response.body = index; });
  const loaded = await loadBlog({ settings, fetcher });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/blog/index");
  assert.equal(loaded.posts.length, 100);
  assert.deepEqual(loaded.posts[99], { slug: "post-99", date: "2026-09-03", title: "Post 99" });
  assert(loaded.posts.every((post) => !Object.hasOwn(post, "text")));
});

// The same safe Gemtext renderer now produces HTML during the build.

test("the static index includes its text, dates and real post links", () => {
  const document = documentFor(renderIndex(blog));
  assert.match(document.body.textContent, /Writing about software/);
  assert.match(document.body.textContent, /3 September 2026/);
  assert.deepEqual([...document.querySelectorAll("time")].map((time) => time.getAttribute("datetime")), ["2026-09-03", "2026-09-02"]);
  assert(document.querySelector('a[href="/blog/new/"]'));
  assert(document.querySelector('a[href="/blog/old/"]'));
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.equal(document.querySelector("h1").textContent, "Blog");
  assert.equal(document.querySelector("script, [aria-live], button"), null);
});

test("post shells keep their index title and date but contain no article body", () => {
  const document = documentFor(renderPost(blog.posts[0], blog));
  const shell = document.querySelector("#blog-post");
  assert(shell);
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.equal(document.querySelector("h1").textContent, blog.posts[0].title);
  assert.equal(document.querySelector("time").getAttribute("datetime"), blog.posts[0].date);
  assert.equal(shell.dataset.postUrl, "https://bridge.example.test/blog/posts/new");
  assert.equal(shell.dataset.capsuleIndex, blog.capsuleIndex);
  assert.equal(shell.dataset.postSlug, "new");
  assert.equal(document.querySelector("#blog-body").textContent, "");
  assert(document.querySelector("noscript"));
  assert(document.querySelector('a[href="/blog/"]'));
});

test("Gemtext keeps markup as text and renders structure, fenced code and keyboard-accessible blocks", () => {
  const article = renderGemtext("# Title\n## Sub\n### Minor\n* One\n* Two\n\n> Quote\n```Code\n# Literal\n<script>alert(1)</script>\n```\n=> javascript:alert(1) literal\n<strong>plain</strong>\n");
  assert.deepEqual([...article.children].map((node) => node.localName), ["h1", "h2", "h3", "ul", "blockquote", "pre", "p", "p"]);
  assert.equal(article.querySelectorAll("li").length, 2);
  const pre = article.querySelector("pre");
  assert.equal(pre.textContent, "# Literal\n<script>alert(1)</script>");
  assert.equal(pre.getAttribute("aria-label"), "Code");
  assert.equal(pre.getAttribute("tabindex"), "0");
  assert.equal(article.querySelector("script, strong"), null);
  assert(article.textContent.includes("=> javascript:alert(1) literal"));
  assert(article.textContent.includes("<strong>plain</strong>"));
  assert.equal(renderGemtext("```\nUnclosed\n").querySelector("pre").textContent, "Unclosed");
});

test("same-capsule post links use clean routes while unsafe links remain text", () => {
  const source = [
    "# Links", "=> ../ Blog", "=> old.gmi Earlier", "=> unknown.gmi Unpublished",
    "=> gemini://capsule.example.test:1965/blog/index.gmi Index",
    "=> https://example.test/page Web", "=> http://example.test/ Plain web", "=> mailto:hello@example.test Email",
    "=> gemini://elsewhere.test/blog/posts/old.gmi Other capsule",
    "=> gemini://capsule.example.test:1966/blog/posts/old.gmi Different port",
    "=> old.gmi?query=1 Query", "=> old.gmi#part Fragment", "=> javascript:alert(1) Unsafe", "=> data:text/html,bad Data",
    "=> https://user:password@example.test/ Credentials", "=> bad--name.gmi Invalid slug",
  ].join("\n");
  const article = renderGemtext(source, {
    baseUrl: "gemini://capsule.example.test/blog/posts/new.gmi", capsuleIndex: settings.capsuleIndex,
  });
  const links = [...article.querySelectorAll("a")];
  assert.equal(links[0].getAttribute("href"), "/blog/");
  assert.equal(links[1].getAttribute("href"), "/blog/old/");
  assert.equal(links[2].getAttribute("href"), "/blog/unknown/");
  assert.equal(links[3].getAttribute("href"), "/blog/");
  assert.equal(links[4].getAttribute("href"), "https://example.test/page");
  assert.equal(links[5].getAttribute("href"), "http://example.test/");
  assert.equal(links[6].getAttribute("href"), "mailto:hello@example.test");
  assert(links.slice(7).every((link) => link.getAttribute("href").startsWith("gemini:")));
  for (const text of ["javascript:alert(1)", "data:text/html,bad", "https://user:password@example.test/"]) {
    assert(article.textContent.includes(text));
    assert(!links.some((link) => link.getAttribute("href") === text));
  }
});

test("Gemtext preserves one page heading and normalizes orphan subheadings", () => {
  const missing = renderGemtext("```Code\n# Code heading\n```\n## Subheading\nText");
  assert.equal(missing.querySelector("h1").textContent, "Blog post");
  assert.equal(missing.querySelector("pre").textContent, "# Code heading");
  const article = renderGemtext("# Title\n### First section\n### Another section\n## Parent section\n### Child\n### Sibling\n# Final section\n### Final child");
  assert.deepEqual([...article.children].map((node) => [node.localName, node.textContent]), [
    ["h1", "Title"], ["h2", "First section"], ["h2", "Another section"], ["h2", "Parent section"],
    ["h3", "Child"], ["h3", "Sibling"], ["h2", "Final section"], ["h3", "Final child"],
  ]);
  const blank = renderGemtext("#  \n## \n###\n### Readable section");
  assert.equal(blank.querySelector("h1").textContent, "Blog post");
  assert.equal(blank.querySelector("h2").textContent, "Readable section");
  assert.equal(blank.querySelector("h3"), null);
  assert.deepEqual([...blank.querySelectorAll("p")].map((node) => node.textContent), ["#  ", "## ", "###"]);
});

test("post names accept only the documented lowercase route format", () => {
  assert.equal(gemtext.postName("new-post"), true);
  assert.equal(gemtext.webAddress("new-post"), "/blog/new-post/");
  for (const slug of ["../secret", "wrong.gmi", "has?query", "UPPER", "a".repeat(81), "", null, "a--b"]) {
    assert.equal(gemtext.postName(slug), false, String(slug));
  }
});
