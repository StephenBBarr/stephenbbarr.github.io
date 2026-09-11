"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { checkRelease } = require("../scripts/check-release.cjs");
const { settings, createFetcher, writeBlogDirectory } = require("./helpers/blog-content.cjs");

test("the release check validates the index and its browser CORS permission", async () => {
  const { fetcher, calls } = createFetcher();
  assert.deepEqual(await checkRelease({ settings, fetcher }), {
    posts: 2, bridge: settings.bridgeBase, capsule: settings.capsuleIndex,
  });
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), [
    "/blog/index",
  ]);
  assert.equal(calls[0].options.headers.Origin, "https://stephenbarr.com");
});

test("an unpublished blog or a broken index cannot pass the release check", async () => {
  let requests = 0;
  const neverFetch = async () => { requests++; assert.fail("Disabled release must not fetch"); };
  await assert.rejects(checkRelease({ settings: { enabled: false }, fetcher: neverFetch }), /not enabled/);
  assert.equal(requests, 0);
  const { fetcher } = createFetcher((response, url) => {
    if (url.pathname === "/blog/index") response.status = 404;
  });
  await assert.rejects(checkRelease({ settings, fetcher }), /index: HTTP 404/);
});

test("the release check accepts the same offline snapshot as the build", async (t) => {
  const sourceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-release-"));
  t.after(() => fs.rmSync(sourceDirectory, { recursive: true, force: true }));
  writeBlogDirectory(sourceDirectory);
  const result = await checkRelease({ settings, sourceDirectory, fetcher: async () => assert.fail("Unexpected network request") });
  assert.equal(result.posts, 2);
});

test("release checks reject a bridge that does not allow the portfolio origin", async () => {
  for (const allowed of [undefined, "https://another.example.test"]) {
    const { fetcher } = createFetcher((response) => {
      if (allowed === undefined) delete response.headers["access-control-allow-origin"];
      else response.headers["access-control-allow-origin"] = allowed;
    });
    await assert.rejects(checkRelease({ settings, fetcher }), /does not allow browser requests from https:\/\/stephenbarr\.com/);
  }
  const { fetcher } = createFetcher((response) => { response.headers["access-control-allow-origin"] = "*"; });
  assert.equal((await checkRelease({ settings, fetcher })).posts, 2);
});
