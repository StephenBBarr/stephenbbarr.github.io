"use strict";

const fs = require("node:fs");
const path = require("node:path");

const settings = {
  enabled: true,
  bridgeBase: "https://bridge.example.test/",
  capsuleIndex: "gemini://capsule.example.test/blog/",
};

const blog = {
  ready: true,
  bridgeBase: settings.bridgeBase,
  capsuleIndex: settings.capsuleIndex,
  index: [
    "# Blog",
    "Writing about software and things I am learning.",
    "",
    "## Posts",
    "=> posts/new.gmi 2026-09-03 A quiet morning",
    "=> posts/old.gmi 2026-09-02 Earlier thoughts",
    "",
  ].join("\n"),
  posts: [
    {
      slug: "new", date: "2026-09-03", title: "A quiet morning",
    },
    {
      slug: "old", date: "2026-09-02", title: "Earlier thoughts",
    },
  ],
};

const postTexts = {
  new: "# A quiet morning\nA complete article about making software simpler and easier to read.\n\n## A thought\nKeep the work focused.\n=> old.gmi Earlier thoughts\n",
  old: "# Earlier thoughts\nAn earlier article about useful work and careful decisions in software.\n=> ../ Back to the blog\n",
};

const disabledBlog = { ready: false, index: "", posts: [] };

function writeBlogDirectory(directory, content = blog) {
  fs.mkdirSync(path.join(directory, "posts"), { recursive: true });
  fs.writeFileSync(path.join(directory, "index.gmi"), content.index);
  for (const post of content.posts) {
    fs.writeFileSync(path.join(directory, "posts", `${post.slug}.gmi`), postTexts[post.slug]);
  }
}

function createFetcher(change = () => {}) {
  const calls = [];
  async function fetcher(url, options) {
    calls.push({ url: url.href, options });
    const slug = url.pathname.split("/").at(-1);
        const response = {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "access-control-allow-origin": "https://stephenbarr.com",
      },
      body: url.pathname === "/blog/index" ? blog.index : postTexts[slug],
    };
    change(response, url, options);
    return new Response(new TextEncoder().encode(response.body), {
      status: response.status, headers: response.headers,
    });
  }
  return { calls, fetcher };
}

module.exports = { blog, disabledBlog, settings, postTexts, writeBlogDirectory, createFetcher };
