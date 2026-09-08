"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const content = require("./content.cjs");
const { renderPage, escape } = require("./pages.cjs");
const blogConfiguration = require("./config.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const asset = (file) => `/${file}?v=${createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex").slice(0, 12)}`;
const sections = [...content.navigation,
  { id: "accessibility", label: "Accessibility", href: "/accessibility/" },
  { id: "not-found", label: "Page not found", href: "/404.html" },
];
const descriptions = {
  about: "Stephen Barr, a software architect and engineering lead in Northern Ireland, building public-service platforms with C#, .NET and Azure.",
  cv: "Stephen Barr's abridged CV: software architecture, engineering leadership, selected projects and experience. Includes a downloadable PDF.",
  blog: "Stephen Barr's writing about software and things he is learning.",
  contact: "Contact Stephen Barr, a software architect and engineering lead based in Northern Ireland, through LinkedIn.",
  accessibility: "Help using Stephen Barr's portfolio and how to report a problem.",
  "not-found": "This page could not be found. Return to Stephen Barr's portfolio.",
};

function contentSecurityPolicy({ localPreview = false } = {}) {
  const origin = localPreview ? "http://127.0.0.1:8000" : content.siteOrigin;
  const configuration = blogConfiguration.resolve(origin);
  const connect = configuration.ready ? new URL(configuration.bridgeBase).origin : "'none'";
  return `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src ${connect}; base-uri 'none'; object-src 'none'; form-action 'none'; frame-src 'none'`;
}

function buildPages(options = {}) {
  const config = blogConfiguration.resolve(content.siteOrigin);
  const pages = new Map();
  for (const { id: section, label, href } of sections) {
    const title = `${label} — Stephen Barr`;
    const canonical = new URL(href, content.siteOrigin).href;
    const scripts = ["config"];
    if (section === "about" || section === "cv") scripts.push("actions");
    if (section === "blog") scripts.push("gemtext", "blog");
    scripts.push("site");
    const main = section === "blog" ? `
      <h1 class="visually-hidden">Blog</h1>
      <p>${config.ready ? "The blog list will appear here." : "The blog has not been published yet."}</p>
      <noscript><p>Reading the blog here needs JavaScript. The rest of the portfolio is available using the links above.</p>
        ${config.ready ? `<a href="${escape(config.capsuleIndex)}">Read the blog in a Gemini browser</a>` : ""}
      </noscript>` : renderPage(section);
    const html = `<!doctype html>
<html lang="en-GB" data-theme="light" data-page="${section}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${escape(contentSecurityPolicy(options))}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(descriptions[section])}">
  ${section === "not-found" ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${escape(canonical)}">`}
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(descriptions[section])}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:locale" content="en_GB">
  <meta name="theme-color" content="#f7f5ef">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${escape(title)}</title>
  <link rel="icon" href="${asset("favicon.svg")}" type="image/svg+xml" sizes="any">
  <script src="${asset("scripts/theme.js")}"></script>
  <link rel="stylesheet" href="${asset("styles/site.css")}">
  ${scripts.map((script) => `<script src="${asset(`scripts/${script}.js`)}" defer></script>`).join("\n  ")}
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="site-shell">
    <header class="site-header"><a class="site-name" href="/">${escape(content.person.name)}</a></header>
    <nav class="site-nav" aria-label="Portfolio sections">
      ${content.navigation.map((item) => `<a href="${item.href}" data-section="${item.id}"${item.id === section ? ' aria-current="page"' : ""}${item.id === "blog" && !config.ready ? " hidden" : ""}>${escape(item.label)}</a>`).join("\n      ")}
    </nav>
    <main id="main-content" tabindex="-1">${main}</main>
    <footer class="site-footer">
      <a class="accessibility-link" href="/accessibility/"${section === "accessibility" ? ' aria-current="page"' : ""}>Accessibility</a>
      <button id="theme-toggle" class="text-button" type="button" hidden>Dark appearance</button>
    </footer>
  </div>
</body>
</html>
`;
    pages.set(href.endsWith("/") ? `${href.slice(1)}index.html` : href.slice(1), html);
  }
  return pages;
}

function buildFiles(options = {}) {
  const files = buildPages(options);
  const production = blogConfiguration.resolve(content.siteOrigin);
  const urls = sections.filter(({ id }) => id !== "not-found" && (id !== "blog" || production.ready))
    .map(({ href }) => `  <url><loc>${escape(new URL(href, content.siteOrigin).href)}</loc></url>`).join("\n");
  files.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  files.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${content.siteOrigin}/sitemap.xml\n`);
  files.set(".nojekyll", "");
  return files;
}

function distributionFiles(options = {}) {
  const files = buildFiles(options);
  for (const file of ["favicon.svg", "styles/site.css", "assets/stephen-barr.jpg", "assets/Stephen-Barr-CV.pdf",
    ...["theme", "config", "actions", "gemtext", "blog", "site"].map((name) => `scripts/${name}.js`)]) {
    files.set(file, fs.readFileSync(path.join(root, file)));
  }
  return files;
}

function run({ check = false, dist = false, localPreview = false } = {}) {
  if (localPreview && (!dist || check)) throw new Error("A local preview must use --dist and cannot replace or validate published root files.");
  const destination = dist ? path.join(root, "dist") : root;
  if (dist) fs.rmSync(destination, { recursive: true, force: true });
  let differs = false;
  for (const [name, html] of dist ? distributionFiles({ localPreview }) : buildFiles()) {
    const file = path.join(destination, name);
    if (check) {
      if (!fs.existsSync(file) || read(name) !== html) {
        console.error(`Generated page needs rebuilding: ${name}`);
        differs = true;
      }
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, html);
    }
  }
  if (differs) process.exitCode = 1;
  else console.log(check ? "Generated files match their source." : `Built ${sections.length} portfolio pages${dist ? " and public assets in dist/" : ""}.`);
}

if (require.main === module) run({ check: process.argv.includes("--check"), dist: process.argv.includes("--dist"), localPreview: process.argv.includes("--local") });
module.exports = { buildPages, buildFiles, distributionFiles, contentSecurityPolicy };
