"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parseArgs } = require("node:util");

const content = require("./content.cjs");
const { renderPage, escape } = require("./pages.cjs");
const { loadBlog, renderIndex, renderPost, postSource } = require("./blog.cjs");
const { webAddress } = require("./gemtext.js");

const projectRoot = path.resolve(__dirname, "..");
const pageDescriptions = {
  about:
    "Stephen Barr, software architect and engineering lead in Northern Ireland. " +
    "Building complex systems and helping organisations grow their capacity to deliver.",
  cv:
    "Stephen Barr's abridged CV: software architecture, engineering leadership, " +
    "selected projects and experience. Includes a downloadable PDF.",
  blog: "Stephen Barr's writing about software and things he is learning.",
  contact:
    "Contact Stephen Barr, a software architect and engineering lead based in " +
    "Northern Ireland, through LinkedIn.",
  "not-found":
    "This page could not be found. Return to Stephen Barr's portfolio.",
};

const publicAssets = [
  "favicon.svg",
  "styles/site.css",
  "assets/stephen-barr.jpg",
  "assets/Stephen-Barr-CV.pdf",
  "scripts/theme.js",
  "scripts/actions.js",
  "scripts/site.js",
  "scripts/gemtext.js",
  "scripts/blog.js",
];

// Rendering takes an explicit snapshot and never makes network requests.
function buildPages({ blog } = {}) {
  return renderPages(pageDefinitions(blog), blog);
}

function buildFiles({ blog } = {}) {
  const definitions = pageDefinitions(blog);
  const files = renderPages(definitions, blog);
  const robots = `User-agent: *
Allow: /
Sitemap: ${content.siteOrigin}/sitemap.xml
`;

  files.set("sitemap.xml", renderSitemap(definitions, blog.ready));
  files.set("robots.txt", robots);
  files.set(".nojekyll", "");
  return files;
}

function distributionFiles(options) {
  const files = buildFiles(options);
  for (const file of publicAssets) {
    files.set(file, fs.readFileSync(path.join(projectRoot, file)));
  }
  if (options.blog.sourceDirectory) {
    copyLocalPosts(files, options.blog);
  }
  return files;
}

function copyLocalPosts(files, blog) {
  for (const post of blog.posts) {
    const source = path.join(blog.sourceDirectory, "posts", `${post.slug}.gmi`);
    // Local previews serve the original text on demand, just like the bridge.
    // The .txt extension lets the static preview server use text/plain.
    files.set(postSource(post, blog).slice(1), fs.readFileSync(source));
  }
}

async function run() {
  const { values } = parseArgs({
    options: {
      "blog-dir": { type: "string" },
    },
  });
  const blog = await loadBlog({ sourceDirectory: values["blog-dir"], origin: content.siteOrigin });
  const files = distributionFiles({ blog });
  const outputDirectory = path.join(projectRoot, "dist");

  // Fetch, validate and render every page before replacing the previous build.
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  for (const [name, data] of files) {
    const outputPath = path.join(outputDirectory, name);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, data);
  }

  const pageCount = [...files.keys()].filter((name) => name.endsWith(".html")).length;
  const postLabel = blog.posts.length === 1 ? "post" : "posts";
  console.log(`Built ${pageCount} portfolio pages, including ${blog.posts.length} blog ${postLabel}, in dist/.`);
}

function pageDefinitions(blog) {
  if (!blog || typeof blog.ready !== "boolean" || !Array.isArray(blog.posts)) {
    throw new Error("Pass loaded blog content to the builder.");
  }

  const pages = [
    ...content.navigation,
    { id: "not-found", label: "Page not found", href: "/404.html" },
  ].map((page) => ({ ...page, description: pageDescriptions[page.id] }));

  if (blog.ready) {
    for (const post of blog.posts) {
      pages.push({
        id: "blog-post",
        navigationSection: "blog",
        label: post.title,
        href: webAddress(post.slug),
        description: `${post.title} — a blog post by Stephen Barr, published ${post.date}.`,
        post,
      });
    }
  }
  return pages;
}

function renderPages(definitions, blog) {
  const templatePath = path.join(projectRoot, "templates/page.html");
  const template = fs.readFileSync(templatePath, "utf8");
  const pages = new Map();

  for (const page of definitions) {
    let outputPath = page.href.slice(1);
    if (page.href.endsWith("/")) {
      outputPath += "index.html";
    }
    pages.set(outputPath, renderDocument(template, page, blog));
  }
  return pages;
}

function renderDocument(template, page, blog) {
  const title = `${page.label} — Stephen Barr`;
  const canonicalUrl = new URL(page.href, content.siteOrigin).href;
  let indexingMetadata = `<link rel="canonical" href="${escape(canonicalUrl)}">`;
  if (page.id === "not-found") {
    indexingMetadata = '<meta name="robots" content="noindex">';
  }

  let mainContent;
  if (page.post) {
    mainContent = renderPost(page.post, blog);
  } else if (page.id === "blog") {
    mainContent = blog.ready
      ? renderIndex(blog)
      : '<h1 class="visually-hidden">Blog</h1><p>The blog has not been published yet.</p>';
  } else {
    mainContent = renderPage(page.id);
  }

  // Text is escaped here; the rendering helpers supply complete HTML fragments.
  const values = {
    section: escape(page.id),
    title: escape(title),
    description: escape(page.description),
    canonicalUrl: escape(canonicalUrl),
    pageType: page.post ? "article" : "website",
    securityPolicy: escape(contentSecurityPolicy(page.post ? postSource(page.post, blog) : undefined)),
    siteName: escape(content.person.name),
    faviconUrl: assetUrl("favicon.svg"),
    themeScriptUrl: assetUrl("scripts/theme.js"),
    stylesheetUrl: assetUrl("styles/site.css"),
    indexingMetadata,
    pageScripts: renderPageScripts(page.id),
    navigationLinks: renderNavigation(page.navigationSection || page.id, blog.ready),
    mainContent,
  };

  // Replace once so inserted content is never interpreted as another template.
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) => {
    if (!Object.hasOwn(values, name)) {
      throw new Error(`Unknown page template value: ${name}`);
    }
    return values[name];
  });
}

function assetUrl(file) {
  const data = fs.readFileSync(path.join(projectRoot, file));
  const version = createHash("sha256").update(data).digest("hex").slice(0, 12);
  return `/${file}?v=${version}`;
}

function contentSecurityPolicy(postUrl) {
  const connectSource = postUrl
    ? (postUrl.startsWith("/") ? "'self'" : new URL(postUrl).origin)
    : "'none'";
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    `connect-src ${connectSource}`,
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join("; ");
}

function renderPageScripts(section) {
  const sources = [];
  if (section === "about" || section === "cv") {
    sources.push(assetUrl("scripts/actions.js"));
  }
  if (section === "blog-post") {
    sources.push(assetUrl("scripts/gemtext.js"), assetUrl("scripts/blog.js"));
  }
  sources.push(assetUrl("scripts/site.js"));
  return sources
    .map((source) => `<script src="${source}" defer></script>`)
    .join("\n  ");
}

function renderNavigation(currentSection, blogReady) {
  const links = [];
  for (const item of content.navigation) {
    const attributes = [
      `href="${item.href}"`,
      `data-section="${item.id}"`,
    ];
    if (item.id === currentSection) {
      attributes.push('aria-current="page"');
    }
    if (item.id === "blog" && !blogReady) {
      attributes.push("hidden");
    }
    links.push(`<a ${attributes.join(" ")}>${escape(item.label)}</a>`);
  }
  return links.join("\n      ");
}

function renderSitemap(definitions, blogReady) {
  const entries = [];
  for (const page of definitions) {
    if (page.id === "not-found" || (page.id === "blog" && !blogReady)) {
      continue;
    }
    const url = new URL(page.href, content.siteOrigin).href;
    entries.push(`  <url><loc>${escape(url)}</loc></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPages,
  buildFiles,
  distributionFiles,
  contentSecurityPolicy,
};
