"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseHTML } = require("linkedom");
const { buildPages, buildFiles, distributionFiles } = require("../scripts/build.cjs");

const root = path.resolve(__dirname, "..");
const pages = buildPages();
const content = require("../scripts/content.cjs");
const blogConfiguration = require("../scripts/config.js");
const production = blogConfiguration.resolve(blogConfiguration.profiles.production.portfolioOrigins[0]);
const documentFor = (file) => parseHTML(pages.get(file)).document;
const normaliseText = (text) => text.replace(/\s+/g, " ").trim();
const routes = [
  ["index.html", "/", "about", "About"],
  ["cv/index.html", "/cv/", "cv", "CV"],
  ["blog/index.html", "/blog/", "blog", "Blog"],
  ["contact/index.html", "/contact/", "contact", "Contact"],
  ["accessibility/index.html", "/accessibility/", "accessibility", "Accessibility"],
  ["404.html", "/404.html", "not-found", "Page not found"],
];

test("generated core HTML contains the real portfolio content without running visitor scripts", () => {
  const about = documentFor("index.html").querySelector("main");
  for (const paragraph of content.about.paragraphs) {
    assert(normaliseText(about.textContent).includes(paragraph));
  }
  assert.equal(about.querySelector("form,input,textarea"), null);

  const cv = normaliseText(documentFor("cv/index.html").querySelector("main").textContent);
  for (const project of content.cv.projects.entries) {
    for (const text of [project.name, ...project.achievements.flatMap(({ lead, body }) => [lead, body])]) {
      assert(cv.includes(text), text);
    }
  }
  for (const text of [content.person.name, content.cv.profile.body, content.cv.technology.body]) {
    assert(cv.includes(text), text);
  }
  for (const entry of content.cv.experience.entries) {
    for (const text of [entry.organisation, entry.role, ...entry.achievements.flatMap(({ lead, body }) => [lead, body])]) {
      assert(cv.includes(text), text);
    }
  }
  for (const entry of content.cv.education.entries) {
    assert(cv.includes(entry.institution));
    assert(cv.includes(entry.qualification));
  }
  assert(cv.includes(content.cv.notice.prefix.trim()));
});

test("the static CV, contact route and still portrait are available as real links and assets", () => {
  const cv = documentFor("cv/index.html");
  const pdf = cv.querySelector('main a[href="/assets/Stephen-Barr-CV.pdf"]');
  assert(pdf);
  assert.match(pdf.textContent, /PDF/);
  assert.equal(fs.readFileSync(path.join(root, pdf.getAttribute("href"))).subarray(0, 5).toString(), "%PDF-");

  const contact = documentFor("contact/index.html").querySelector("main");
  assert(contact.textContent.includes(content.person.location));
  const linkedIn = [...contact.querySelectorAll("a")].find((link) => link.getAttribute("href") === content.person.linkedin.href);
  assert(linkedIn);
  assert.match(linkedIn.textContent, /linkedin\.com/);

  const about = documentFor("index.html");
  const portrait = about.querySelector("main .about-portrait img");
  assert(portrait);
  assert.equal(portrait.getAttribute("src"), content.about.portrait.source);
  assert.equal(portrait.getAttribute("alt"), content.about.portrait.alternativeText);
  assert(Number(portrait.getAttribute("width")) > 0);
  assert(Number(portrait.getAttribute("height")) > 0);
  assert.equal(about.querySelector(".transfer-progress,.transfer-status"), null);
});

test("each public section has a direct route, useful title, main landmark and ordered headings", () => {
  assert.deepEqual([...pages.keys()].sort(), routes.map(([file]) => file).sort());
  for (const [file, href, section, label] of routes) {
    const document = documentFor(file);
    assert.equal(document.title, `${label} — Stephen Barr`);
    assert.equal(document.querySelectorAll("main").length, 1);
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert.equal(document.querySelector("h1").textContent, section === "about" ? content.about.headline : label);
    assert.equal(document.querySelector("h1").classList.contains("visually-hidden"), !["about", "accessibility", "not-found"].includes(section), file);
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    for (let i = 1; i < headings.length; i += 1) {
      assert(Number(headings[i].tagName[1]) <= Number(headings[i - 1].tagName[1]) + 1, file);
    }
    const navigation = document.querySelector('nav[aria-label="Portfolio sections"]');
    assert(navigation);
    assert.equal(navigation.querySelectorAll('[aria-current="page"]').length, ["accessibility", "not-found"].includes(section) ? 0 : 1);
    assert.equal(document.querySelector('[aria-current="page"]')?.getAttribute("href"), section === "not-found" ? undefined : href);
    assert.equal(document.querySelector(".skip-link").getAttribute("href"), "#main-content");
    assert.equal(document.querySelector("main").id, "main-content");
    assert.equal(document.querySelector("#view-toggle"), null);
    assert.deepEqual([...navigation.querySelectorAll("a")].map((link) => link.getAttribute("href")), content.navigation.map(({ href }) => href));
  }

});

test("the site starts light and does not ship the archived interface", () => {
  for (const [file, html] of pages) {
    const { document } = parseHTML(html);
    assert.equal(document.documentElement.hasAttribute("data-view"), false);
    assert.equal(document.documentElement.dataset.theme, "light");
    assert.equal(document.querySelector('meta[name="theme-color"]').content, "#f7f5ef");
    const themeScript = document.querySelector('script[src^="/scripts/theme.js?"]');
    assert(themeScript);
    assert.equal(themeScript.hasAttribute("defer"), false);
    assert(html.indexOf('src="/scripts/theme.js?') < html.indexOf('rel="stylesheet"'));
    assert.equal(Boolean(document.querySelector('script[src^="/script.js?"]')), false);
    assert.equal(Boolean(document.querySelector('script[src^="/scripts/commands.js?"]')), false);
    assert.equal(Boolean(document.querySelector("#terminal-command")), false);
    assert.equal(document.querySelector("#view-toggle, #terminal-form, .portrait-image"), null);
    assert.equal(document.querySelector('link[href*="terminal.css"]'), null);
    assert.equal(document.querySelector("#theme-toggle").hidden, true);
    for (const button of document.querySelectorAll("[data-reading]")) assert.equal(button.hidden, true);
  }
});

test("the active project has no removed pages or archived interface files", () => {
  for (const file of ["work", "command", "templates", "script.js", "scripts/commands.js", "styles/terminal.css", "archived"]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
  for (const [, html] of pages) assert(!html.includes("/command/"));
});

test("the publication setting gives the blog honest static navigation and fallback text", () => {
  for (const [file] of routes) {
    const link = documentFor(file).querySelector('nav a[data-section="blog"]');
    assert.equal(link.hidden, !production.ready);
    assert.equal(link.getAttribute("href"), "/blog/");
  }
  const main = documentFor("blog/index.html").querySelector("main");
  if (!production.ready) {
    assert.match(main.textContent, /The blog has not been published yet\./);
    assert.equal(main.querySelector('a[href^="gemini:"]'), null);
  } else {
    assert.equal(main.querySelector("noscript a").getAttribute("href"), production.capsuleIndex);
  }
  assert.match(main.querySelector("noscript").textContent, /needs JavaScript/);
  assert.match(main.querySelector("noscript").textContent, /rest of the portfolio is available/);
});

test("all generated local scripts, styles, images, links and fragment targets exist", () => {
  for (const [file, html] of pages) {
    const { document } = parseHTML(html);
    const base = new URL(file === "index.html" ? "/" : `/${file}`, "https://portfolio.example");
    for (const element of document.querySelectorAll("script[src],link[href],img[src],a[href]")) {
      const href = element.getAttribute("src") ?? element.getAttribute("href");
      const url = new URL(href, base);
      assert(["https:", "http:", "gemini:", "mailto:"].includes(url.protocol), `${file}: ${href}`);
      if (url.origin !== base.origin) continue;
      if (href.startsWith("#")) {
        assert(document.getElementById(decodeURIComponent(url.hash.slice(1))), `${file}: ${href}`);
        continue;
      }
      assert(href.startsWith("/"), `Nested pages need an absolute path: ${file}: ${href}`);
      const pathname = decodeURIComponent(url.pathname);
      const relative = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      const target = path.join(root, relative);
      assert(fs.existsSync(target) && fs.statSync(target).isFile(), `${file}: missing ${href}`);
    }
  }
});

test("generation is repeatable and all published HTML matches its current source", () => {
  assert.deepEqual([...buildPages()], [...pages]);
  for (const [file, html] of buildFiles()) {
    assert.equal(fs.readFileSync(path.join(root, file), "utf8"), html, `${file} needs npm run build`);
  }
});

test("publishing metadata identifies pages and keeps missing pages out of search", () => {
  const descriptions = new Set();
  for (const [file, href, section] of routes) {
    const document = documentFor(file);
    const description = document.querySelector('meta[name="description"]').content;
    assert(description.length > 30);
    descriptions.add(description);
    if (section === "not-found") {
      assert.equal(document.querySelector('meta[name="robots"]').content, "noindex");
      assert.equal(document.querySelector('link[rel="canonical"]'), null);
      assert.equal(document.querySelector("main a").getAttribute("href"), "/");
    } else {
      assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), new URL(href, content.siteOrigin).href);
    }
  }
  assert.equal(descriptions.size, routes.length);
  const files = buildFiles();
  assert(files.get("robots.txt").includes(`${content.siteOrigin}/sitemap.xml`));
  assert(!files.get("sitemap.xml").includes("404.html"));
  assert.equal(files.get("sitemap.xml").includes(`${content.siteOrigin}/blog/`), production.ready);
  assert(files.has(".nojekyll"));
});

test("the distribution contains only generated public files and runtime assets", () => {
  const files = distributionFiles();
  assert.deepEqual([...files.keys()].sort(), [
    ...buildFiles().keys(), "favicon.svg", "styles/site.css", "assets/stephen-barr.jpg", "assets/Stephen-Barr-CV.pdf",
    ...["theme", "config", "actions", "gemtext", "blog", "site"].map((name) => `scripts/${name}.js`),
  ].sort());
  for (const [, bytes] of files) assert(typeof bytes === "string" || Buffer.isBuffer(bytes));
});

test("each page loads only its enhancements and one stylesheet", () => {
  for (const [file, , section] of routes) {
    const document = documentFor(file);
    const scripts = [...document.querySelectorAll("script[src]")].map((script) =>
      new URL(script.getAttribute("src"), "https://portfolio.example").pathname);
    const expected = ["theme", "config"];
    if (["about", "cv"].includes(section)) expected.push("actions");
    if (section === "blog") expected.push("gemtext", "blog");
    expected.push("site");
    assert.deepEqual(scripts, expected.map((name) => `/scripts/${name}.js`), file);
    assert.equal(document.querySelectorAll('link[rel="stylesheet"]').length, 1, file);
  }
});

test("published pages restrict active content and connect only to the public bridge", () => {
  for (const [file, html] of buildPages()) {
    const { document } = parseHTML(html);
    const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    assert(policy, file);
    const directives = Object.fromEntries(policy.content.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }));
    assert.deepEqual(directives["default-src"], ["'none'"]);
    for (const name of ["script-src", "style-src", "img-src"]) assert.deepEqual(directives[name], ["'self'"]);
    for (const name of ["base-uri", "object-src", "form-action", "frame-src"]) assert.deepEqual(directives[name], ["'none'"]);
    assert.deepEqual(directives["connect-src"], [new URL(production.bridgeBase).origin]);
    assert(!policy.content.includes("unsafe-inline") && !policy.content.includes("unsafe-eval"));
    assert(!policy.content.includes("127.0.0.1") && !policy.content.includes("localhost"));
    assert(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf("<script"));
    assert.equal(document.querySelectorAll("script:not([src]),[style],[onclick],[onload]").length, 0);
  }
});

test("local preview gets a separate policy without changing the production build", () => {
  const before = [...buildFiles()];
  for (const [file, html] of distributionFiles({ localPreview: true })) {
    if (!file.endsWith(".html")) continue;
    const { document } = parseHTML(html);
    const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    assert(policy.includes("connect-src http://127.0.0.1:5080;"));
    assert(!policy.includes("bridge.stoathoughts.com"));
  }
  assert.deepEqual([...buildFiles()], before);
});
