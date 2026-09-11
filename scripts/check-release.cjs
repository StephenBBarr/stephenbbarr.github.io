"use strict";

const configuration = require("./config.cjs");
const { siteOrigin } = require("./content.cjs");
const { loadBlog } = require("./blog.cjs");

async function checkRelease({ settings = configuration, ...options } = {}) {
  const blog = await loadBlog({ settings, origin: siteOrigin, ...options });
  if (!blog.ready) {
    throw new Error("Public blog is not enabled.");
  }
  return {
    posts: blog.posts.length,
    bridge: settings.bridgeBase,
    capsule: blog.capsuleIndex,
  };
}

if (require.main === module) {
  checkRelease()
    .then(({ posts, bridge, capsule }) => {
      const label = posts === 1 ? "post address" : "post addresses";
      console.log(`Blog index checks passed: ${posts} ${label} through ${bridge} from ${capsule}`);
    })
    .catch((error) => {
      console.error(`Release blocked: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { checkRelease };
