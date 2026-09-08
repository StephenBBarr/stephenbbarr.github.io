"use strict";

const configuration = require("./config.js");
const content = require("./content.cjs");

async function checkRelease({ settings = configuration.profiles, fetcher = fetch } = {}) {
  const production = settings.production;
  const resolved = configuration.resolve(content.siteOrigin, settings);
  if (!resolved.ready) {
    throw new Error("Public blog is not ready. Configure and verify its HTTPS bridge, Gemini capsule and portfolio origin in scripts/config.js before publishing.");
  }
  for (const origin of production.portfolioOrigins) {
    if (!configuration.resolve(origin, settings).ready) throw new Error(`Invalid public portfolio origin: ${origin}`);
  }

  async function read(path, origin = content.siteOrigin) {
    const response = await fetcher(new URL(path, resolved.bridgeBase), {
      headers: { Origin: origin, Accept: "text/plain" },
      redirect: "error", credentials: "omit", cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/plain") {
      throw new Error(`${path}: expected plain Gemtext from the bridge.`);
    }
    if (response.headers.get("access-control-allow-origin") !== origin) {
      throw new Error(`${path}: the bridge does not permit the portfolio's exact origin.`);
    }
    if (response.headers.get("x-content-type-options") !== "nosniff" ||
        !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get("cache-control") || "")) {
      throw new Error(`${path}: expected the bridge's nosniff and no-store headers.`);
    }
    const text = await response.text();
    if (!text.trim() || Buffer.byteLength(text) > 1024 * 1024) throw new Error(`${path}: empty or oversized content.`);
    if (!/^#\s+\S/m.test(text)) throw new Error(`${path}: a meaningful article heading is required.`);
    return text;
  }

  const index = await read("blog/index");
  const slugs = new Set();
  let fenced = false;
  for (const line of index.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const entry = /^=>\s*(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(\S.*)$/.exec(line);
    if (!entry) continue;
    const [, target, date] = entry;
    const address = new URL(target, resolved.capsuleIndex);
    const capsule = new URL(resolved.capsuleIndex);
    const slug = /^\/blog\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\.gmi$/.exec(address.pathname)?.[1];
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (address.protocol !== "gemini:" || address.hostname !== capsule.hostname ||
        (address.port || "1965") !== (capsule.port || "1965") || address.username || address.password ||
        address.search || address.hash || !slug || slug.length > 80 || !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== date || slugs.has(slug)) {
      throw new Error(`The blog index contains an invalid or duplicate dated post: ${line}`);
    }
    slugs.add(slug);
  }
  if (!slugs.size) throw new Error("The public blog index has no dated posts.");
  for (const slug of slugs) await read(`blog/posts/${slug}`);
  for (const origin of production.portfolioOrigins.filter((origin) => origin !== content.siteOrigin)) {
    await read("blog/index", origin);
  }
  const untrusted = await fetcher(new URL("blog/index", resolved.bridgeBase), {
    headers: { Origin: "https://untrusted.example.invalid" }, redirect: "error",
    credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  await untrusted.body?.cancel();
  if (untrusted.headers.has("access-control-allow-origin")) {
    throw new Error("The bridge permits an unapproved browser origin.");
  }
  return { posts: slugs.size, bridge: resolved.bridgeBase, capsule: resolved.capsuleIndex };
}

if (require.main === module) {
  checkRelease().then(({ posts, bridge, capsule }) => {
    console.log(`Public blog checks passed: ${posts} posts through ${bridge} from ${capsule}`);
  }).catch((error) => {
    console.error(`Release blocked: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { checkRelease };
