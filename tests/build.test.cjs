"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const test = require("node:test");
const { parseHTML } = require("linkedom");
const { buildPages, buildFiles, distributionFiles } = require("../scripts/build.cjs");

const root = path.resolve(__dirname, "..");
const { blog, disabledBlog, settings, postTexts, writeBlogDirectory } = require("./helpers/blog-content.cjs");
const pages = buildPages({ blog });
const content = require("../scripts/content.cjs");
const documentFor = (file) => parseHTML(pages.get(file)).document;
const normaliseText = (text) => text.replace(/\s+/g, " ").trim();
const routes = [
  ["index.html", "/", "about", "About"],
  ["cv/index.html", "/cv/", "cv", "CV"],
  ["blog/index.html", "/blog/", "blog", "Blog"],
  ["contact/index.html", "/contact/", "contact", "Contact"],
  ["404.html", "/404.html", "not-found", "Page not found"],
  ...blog.posts.map((post) => [`blog/${post.slug}/index.html`, `/blog/${post.slug}/`, "blog-post", post.title]),
];

function achievementText(achievements) {
  return achievements.flatMap(({ lead, body }) => [lead, body]);
}

function createBuildFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-build-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  for (const name of ["scripts", "templates", "styles", "assets", "favicon.svg"]) {
    fs.cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  fs.writeFileSync(path.join(directory, "scripts/config.cjs"), `module.exports = ${JSON.stringify(settings)};\n`);
  writeBlogDirectory(path.join(directory, "blog-source"));
  return directory;
}

function compareFileNames([first], [second]) {
  return first.localeCompare(second);
}

function snapshotFiles(directory, prefix = "") {
  const files = [];
  const entries = fs.readdirSync(path.join(directory, prefix), { withFileTypes: true });
  for (const entry of entries) {
    if (!prefix && entry.name === "dist") {
      continue;
    }

    const name = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...snapshotFiles(directory, name));
    } else {
      const bytes = fs.readFileSync(path.join(directory, name));
      files.push([name, bytes]);
    }
  }
  return files.sort(compareFileNames);
}

function runBuildCommand(directory, flags = []) {
  return spawnSync(process.execPath, ["scripts/build.cjs", ...flags], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
  });
}

function distributionSnapshot(snapshot = blog) {
  return [...distributionFiles({ blog: snapshot })]
    .map(([name, bytes]) => [name, Buffer.from(bytes)])
    .sort(compareFileNames);
}

function policyDirectives(policy) {
  const directives = policy.split(";").map((part) => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  });
  return Object.fromEntries(directives);
}

test("generated core HTML contains the real portfolio content without running visitor scripts", () => {
  const about = documentFor("index.html").querySelector("main");
  for (const paragraph of content.about.paragraphs) {
    assert(normaliseText(about.textContent).includes(paragraph));
  }
  assert.equal(about.querySelector("form,input,textarea"), null);

  const cv = normaliseText(documentFor("cv/index.html").querySelector("main").textContent);
  for (const project of content.cv.projects.entries) {
    const facts = [project.name, ...achievementText(project.achievements)];
    for (const text of facts) {
      assert(cv.includes(text), text);
    }
  }
  for (const text of [content.person.name, content.cv.profile.body, content.cv.technology.body]) {
    assert(cv.includes(text), text);
  }
  for (const entry of content.cv.experience.entries) {
    const facts = [entry.organisation, entry.role, ...achievementText(entry.achievements)];
    for (const text of facts) {
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
  const pdfBytes = fs.readFileSync(path.join(root, pdf.getAttribute("href")));
  assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");

  const contact = documentFor("contact/index.html").querySelector("main");
  assert(contact.textContent.includes(content.person.location));
  const linkedIn = [...contact.querySelectorAll("a")].find((link) => {
    return link.getAttribute("href") === content.person.linkedin.href;
  });
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
    const heading = document.querySelector("h1");
    const expectedHeading = section === "about" ? content.about.headline : label;
    const headingIsHidden = !["about", "not-found", "blog-post"].includes(section);
    assert.equal(heading.textContent, expectedHeading);
    assert.equal(heading.classList.contains("visually-hidden"), headingIsHidden, file);
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    for (let i = 1; i < headings.length; i += 1) {
      const level = Number(headings[i].tagName[1]);
      const previousLevel = Number(headings[i - 1].tagName[1]);
      assert(level <= previousLevel + 1, file);
    }
    const navigation = document.querySelector('nav[aria-label="Portfolio sections"]');
    assert(navigation);
    assert.equal(navigation.querySelectorAll('[aria-current="page"]').length, section === "not-found" ? 0 : 1);
    assert.equal(document.querySelector('[aria-current="page"]')?.getAttribute("href"), section === "not-found" ? undefined : section === "blog-post" ? "/blog/" : href);
    assert.equal(document.querySelector(".skip-link").getAttribute("href"), "#main-content");
    assert.equal(document.querySelector("main").id, "main-content");
    assert.equal(document.querySelector("#view-toggle"), null);
    const navigationLinks = [...navigation.querySelectorAll("a")]
      .map((link) => link.getAttribute("href"));
    const expectedLinks = content.navigation.map(({ href }) => href);
    assert.deepEqual(navigationLinks, expectedLinks);
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
    for (const button of document.querySelectorAll("[data-reading]")) {
      assert.equal(button.hidden, true);
    }
  }
});

test("the active project has no removed pages or archived interface files", () => {
  for (const file of ["work", "command", "script.js", "scripts/commands.js", "styles/terminal.css", "archived"]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
  for (const [, html] of pages) {
    assert(!html.includes("/command/"));
  }
});

test("the build provides a complete index and indexed post shells before visitor scripts run", () => {
  for (const [file] of routes) {
    const link = documentFor(file).querySelector('nav a[data-section="blog"]');
    assert.equal(link.hidden, false);
    assert.equal(link.getAttribute("href"), "/blog/");
  }
  const main = documentFor("blog/index.html").querySelector("main");
  assert.match(main.textContent, /Writing about software/);
  assert.equal(main.querySelector("noscript"), null);
  for (const post of blog.posts) {
    assert(main.querySelector(`a[href="/blog/${post.slug}/"]`));
    const document = documentFor(`blog/${post.slug}/index.html`);
    assert.equal(document.title, `${post.title} — Stephen Barr`);
    assert.equal(document.querySelector("#blog-body").textContent, "");
    assert(!document.querySelector("main").textContent.includes(postTexts[post.slug].split("\n")[1]));
    assert.equal(document.querySelectorAll("main article").length, 1);
    assert.equal(document.querySelector("main h1").textContent, post.title);
    assert(document.querySelector('main a[href="/blog/"]'));
    assert.equal(document.querySelector('meta[property="og:type"]').content, "article");
    assert.equal(document.querySelector('meta[property="og:url"]').content, `${content.siteOrigin}/blog/${post.slug}/`);
    assert.equal(document.querySelector('meta[property="og:title"]').content, document.title);
    assert(document.querySelector("noscript"));
    assert.equal(document.querySelector("#blog-status").getAttribute("role"), "status");
    assert.equal(document.querySelector("#blog-retry").hidden, true);
    assert(!document.querySelector("main").textContent.includes("Loading the post"));
  }
});

test("index titles stay escaped in post shells and metadata", () => {
  const snapshot = structuredClone(blog);
  const title = 'A <script>alert("title")</script> & {{title}}';
  snapshot.index = snapshot.index.replace(snapshot.posts[0].title, title);
  snapshot.posts[0].title = title;
  const generated = buildPages({ blog: snapshot });
  const { document } = parseHTML(generated.get("blog/new/index.html"));
  assert.equal(document.title, `${title} — Stephen Barr`);
  assert.equal(document.querySelector('meta[property="og:title"]').content, document.title);
  assert.equal(document.querySelector("main h1").textContent, title);
  assert.equal(document.querySelector('script:not([src]), [onerror], img[src="x"]'), null);
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), `${content.siteOrigin}/blog/new/`);
  const index = parseHTML(generated.get("blog/index.html")).document;
  assert.equal(index.querySelector('main a[href="/blog/new/"]').textContent, title);
  assert.equal(index.querySelector("main script"), null);
});

test("all generated local scripts, styles, images, links and fragment targets exist", () => {
  const files = distributionFiles({ blog });
  for (const [file, html] of pages) {
    const { document } = parseHTML(html);
    const base = new URL(file === "index.html" ? "/" : `/${file}`, "https://portfolio.example");
    for (const element of document.querySelectorAll("script[src],link[href],img[src],a[href]")) {
      const href = element.getAttribute("src") ?? element.getAttribute("href");
      const url = new URL(href, base);
      assert(["https:", "http:", "gemini:", "mailto:"].includes(url.protocol), `${file}: ${href}`);
      if (url.origin !== base.origin) {
        continue;
      }
      if (href.startsWith("#")) {
        assert(document.getElementById(decodeURIComponent(url.hash.slice(1))), `${file}: ${href}`);
        continue;
      }
      assert(href.startsWith("/"), `Nested pages need an absolute path: ${file}: ${href}`);
      const pathname = decodeURIComponent(url.pathname);
      const relative = (pathname.endsWith("/") ? `${pathname}index.html` : pathname).slice(1);
      assert(files.has(relative), `${file}: missing ${href} in the distribution`);
    }
  }
});

test("generation is repeatable", () => {
  assert.deepEqual([...buildPages({ blog })], [...pages]);
  assert.deepEqual([...distributionFiles({ blog })], [...distributionFiles({ blog })]);
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
  const files = buildFiles({ blog });
  assert(files.get("robots.txt").includes(`${content.siteOrigin}/sitemap.xml`));
  assert(!files.get("sitemap.xml").includes("404.html"));
  assert.equal(files.get("sitemap.xml").includes(`${content.siteOrigin}/blog/`), blog.ready);
  for (const post of blog.posts) {
    assert(files.get("sitemap.xml").includes(`${content.siteOrigin}/blog/${post.slug}/`));
  }
  assert(files.has(".nojekyll"));
});

test("the distribution contains only generated public files and runtime assets", () => {
  const files = distributionFiles({ blog });
  assert.deepEqual([...files.keys()].sort(), [
    ...buildFiles({ blog }).keys(), "favicon.svg", "styles/site.css", "assets/stephen-barr.jpg", "assets/Stephen-Barr-CV.pdf",
    ...["theme", "actions", "site", "gemtext", "blog"].map((name) => `scripts/${name}.js`),
  ].sort());
  for (const [, bytes] of files) {
    assert(typeof bytes === "string" || Buffer.isBuffer(bytes));
  }
});

test("the offline build writes only a complete clean dist and preserves it when loading or rendering fails", (t) => {
  const fixture = createBuildFixture(t);
  const source = snapshotFiles(fixture);
  const destination = path.join(fixture, "dist");
  const flags = ["--blog-dir", "blog-source"];
  for (let pass = 0; pass < 2; pass++) {
    fs.mkdirSync(path.join(destination, "obsolete"), { recursive: true });
    fs.writeFileSync(path.join(destination, "obsolete", "page.html"), "An old page");
    const result = runBuildCommand(fixture, flags);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(snapshotFiles(fixture), source, "building must not create or change files outside dist");
    assert.deepEqual(snapshotFiles(destination), distributionSnapshot({ ...blog, sourceDirectory: path.join(fixture, "blog-source") }), "dist must contain exactly the current build and assets");
  }
  const published = snapshotFiles(destination);
  for (const post of blog.posts) {
    assert.equal(fs.readFileSync(path.join(destination, `blog-source/${post.slug}.txt`), "utf8"), postTexts[post.slug]);
    const html = fs.readFileSync(path.join(destination, `blog/${post.slug}/index.html`), "utf8");
    const { document } = parseHTML(html);
    assert.equal(document.querySelector("#blog-post").dataset.postUrl, `/blog-source/${post.slug}.txt`);
    assert.deepEqual(policyDirectives(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)["connect-src"], ["'self'"]);
  }
  for (const flag of ["--dist", "--check", "--local"]) {
    const result = runBuildCommand(fixture, [flag]);
    assert.notEqual(result.status, 0, `The obsolete ${flag} option must be rejected`);
    assert.deepEqual(snapshotFiles(destination), published, "invalid options must not change the current output");
    assert.deepEqual(snapshotFiles(fixture), source);
  }

  const missingPost = path.join(fixture, "blog-source/posts/new.gmi");
  fs.unlinkSync(missingPost);
  const missingSource = snapshotFiles(fixture);
  const missing = runBuildCommand(fixture, flags);
  assert.notEqual(missing.status, 0, "Missing source posts must stop the build");
  assert.deepEqual(snapshotFiles(destination), published);
  assert.deepEqual(snapshotFiles(fixture), missingSource);
  fs.writeFileSync(missingPost, postTexts.new);

  const preload = path.join(fixture, "fail-fetch.cjs");
  fs.writeFileSync(preload, 'global.fetch = async () => { throw new Error("test network unavailable"); };\n');
  const networkSource = snapshotFiles(fixture);
  const unavailable = spawnSync(process.execPath, ["--require", preload, "scripts/build.cjs"], {
    cwd: fixture, encoding: "utf8", env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
  });
  assert.notEqual(unavailable.status, 0);
  assert.match(unavailable.stderr, /test network unavailable/);
  assert.deepEqual(snapshotFiles(destination), published, "a fetch failure must preserve the current output");
  assert.deepEqual(snapshotFiles(fixture), networkSource);

  fs.appendFileSync(path.join(fixture, "templates/page.html"), "\n{{unknownTemplateValue}}");
  const invalidSource = snapshotFiles(fixture);
  const failed = runBuildCommand(fixture, flags);
  assert.notEqual(failed.status, 0, "An unknown template value must stop the build");
  assert.match(failed.stderr, /Unknown page template value: unknownTemplateValue/);
  assert.deepEqual(snapshotFiles(destination), published, "a template error must preserve the current output");
  assert.deepEqual(snapshotFiles(fixture), invalidSource);
});

test("each page loads only its enhancements and one stylesheet", () => {
  for (const [file, , section] of routes) {
    const document = documentFor(file);
    const scripts = [...document.querySelectorAll("script[src]")].map((script) =>
      new URL(script.getAttribute("src"), "https://portfolio.example").pathname);
    const expected = ["theme"];
    if (["about", "cv"].includes(section)) {
      expected.push("actions");
    }
    if (section === "blog-post") expected.push("gemtext", "blog");
    expected.push("site");
    assert.deepEqual(scripts, expected.map((name) => `/scripts/${name}.js`), file);
    assert.equal(document.querySelectorAll('link[rel="stylesheet"]').length, 1, file);
  }
});

test("the publication includes the browser renderer but no generated configuration or build source", () => {
  const files = distributionFiles({ blog });
  for (const file of ["scripts/config.js", "scripts/config.cjs", "scripts/blog.cjs", "scripts/gemtext.cjs", "scripts/build.cjs"]) {
    assert.equal(files.has(file), false, file);
  }
  for (const [file, html] of pages) {
    const { document } = parseHTML(html);
    for (const script of document.querySelectorAll("script[src]")) {
      const url = new URL(script.getAttribute("src"), content.siteOrigin);
      const bytes = files.get(url.pathname.slice(1));
      assert.equal(url.searchParams.get("v"), createHash("sha256").update(bytes).digest("hex").slice(0, 12), file);
    }
  }
});

test("an explicitly disabled blog has a readable fallback and no post pages or sitemap entries", () => {
  const files = distributionFiles({ blog: disabledBlog });
  for (const [file] of routes.filter(([, , section]) => section !== "blog-post")) {
    const { document } = parseHTML(files.get(file));
    assert.equal(document.querySelector('nav a[data-section="blog"]').hidden, true);
  }
  const { document } = parseHTML(files.get("blog/index.html"));
  assert.match(document.querySelector("main").textContent, /The blog has not been published yet\./);
  assert.equal(document.querySelector('main a[href^="gemini:"]'), null);
  assert(!files.get("sitemap.xml").includes(`${content.siteOrigin}/blog/`));
  for (const post of blog.posts) assert.equal(files.has(`blog/${post.slug}/index.html`), false);
});

test("pure builders require an explicit blog snapshot", () => {
  for (const build of [buildPages, buildFiles, distributionFiles]) {
    assert.throws(() => build(), /Pass loaded blog content/);
  }
});

test("only post shells allow a connection to the blog bridge", () => {
  for (const [file, html] of buildPages({ blog })) {
    const { document } = parseHTML(html);
    const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    assert(policy, file);
    const directives = policyDirectives(policy.content);
    assert.deepEqual(directives["default-src"], ["'none'"]);
    for (const name of ["script-src", "style-src", "img-src"]) {
      assert.deepEqual(directives[name], ["'self'"]);
    }
    for (const name of ["base-uri", "object-src", "form-action", "frame-src"]) {
      assert.deepEqual(directives[name], ["'none'"]);
    }
    const connection = file.startsWith("blog/") && file !== "blog/index.html" ? new URL(blog.bridgeBase).origin : "'none'";
    assert.deepEqual(directives["connect-src"], [connection]);
    assert(!policy.content.includes("unsafe-inline") && !policy.content.includes("unsafe-eval"));
    assert(!policy.content.includes("127.0.0.1") && !policy.content.includes("localhost"));
    assert(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf("<script"));
    assert.equal(document.querySelectorAll("script:not([src]),[style],[onclick],[onload]").length, 0);
  }
});
