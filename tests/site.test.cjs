"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildPages } = require("../scripts/build.cjs");
const { blog, disabledBlog } = require("./helpers/blog-content.cjs");
const { createApp, memoryStorage } = require("./helpers/site-app.cjs");

test("the reading site starts light and retains its saved appearance", () => {
  const storage = memoryStorage();
  const app = createApp({ localStorage: storage });
  assert.equal(app.portfolio.theme.current(), "light");
  assert.equal(app.document.querySelector('meta[name="theme-color"]').content, "#f7f5ef");
  app.portfolio.theme.apply("dark");
  assert.equal(storage.getItem("portfolio-theme-text"), "dark");
  assert.equal(app.document.querySelector('meta[name="theme-color"]').content, "#1e2220");
  assert.equal(createApp({ localStorage: storage }).portfolio.theme.current(), "dark");
  assert.equal(app.portfolio.theme.apply("constructor"), false);
  assert.equal(app.portfolio.theme.current(), "dark");
});

test("appearance and reading controls work when storage is denied", () => {
  const app = createApp({
    address: "https://portfolio.example/cv/",
    loadSite: true,
    localStorage: memoryStorage({}, true),
  });
  const button = app.document.querySelector("#theme-toggle");
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, "Dark appearance");
  button.click();
  assert.equal(app.portfolio.theme.current(), "dark");
  assert.equal(button.textContent, "Light appearance");
  assert.equal(app.spoken.length, 0);
});

test("legacy blog addresses redirect to static posts without replacing page content", () => {
  for (const path of ["/blog/", "/blog/index.html"]) {
    const post = createApp({ address: `https://portfolio.example${path}?post=new`, loadSite: true });
    assert.deepEqual(post.redirects, ["/blog/new/"]);
    const index = createApp({ address: `https://portfolio.example${path}`, loadSite: true });
    assert.deepEqual(index.redirects, []);
    assert(index.document.querySelector("main").textContent.includes("A quiet morning"));
  }
  for (const path of ["/contact/", "/blog/new/"]) {
    const app = createApp({ address: `https://portfolio.example${path}?post=old`, loadSite: true });
    assert.deepEqual(app.redirects, []);
  }
});

test("invalid legacy queries leave the static index intact and duplicate queries use the first value", () => {
  for (const query of ["post=", "post", "post=..%2Fsecret", "post=UPPER", "post=a--b", "post=wrong.gmi", `post=${"a".repeat(81)}`, "post=&post=new"]) {
    const app = createApp({ address: `https://portfolio.example/blog/?${query}`, loadSite: true });
    assert.deepEqual(app.redirects, [], query);
    assert.equal(app.document.querySelector("main h1").textContent, "Blog");
    assert(app.document.querySelector('main a[href="/blog/new/"]'));
  }
  const duplicate = createApp({ address: "https://portfolio.example/blog/?post=new&post=old", loadSite: true });
  assert.deepEqual(duplicate.redirects, ["/blog/new/"]);
  const fragment = createApp({ address: "https://portfolio.example/blog/?post=new#section", loadSite: true });
  assert.deepEqual(fragment.redirects, ["/blog/new/#section"]);
});

test("speech begins only on request and the stop control cancels and restores focus", () => {
  const app = createApp({ loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const status = button.parentElement.querySelector("[data-speech-status]");
  assert.equal(button.hidden, false);
  assert.equal(app.spoken.length, 0);
  assert.equal(app.cancellations, 0);
  let focused = 0;
  button.focus = () => {
    focused += 1;
  };
  button.click();
  assert.equal(focused, 0);
  assert.equal(app.spoken.length, 1);
  assert.equal(app.spoken[0].text, app.content.about.paragraphs.join(" "));
  assert.equal(app.spoken[0].lang, "en-GB");
  assert.equal(app.spoken[0].rate, 0.95);
  assert.equal(status.textContent, app.content.about.readingStarted);
  const stop = button.parentElement.querySelector(".speech-stop");
  assert.equal(stop.textContent, "Stop");
  assert.equal(stop.getAttribute("aria-label"), "Stop reading aloud");
  assert.equal(stop.parentElement, button.parentElement);
  assert.equal(button.nextElementSibling, stop);
  assert.equal(stop.nextElementSibling, status);
  assert.equal(status.querySelector("button"), null, "live reading status must not contain controls");
  stop.click();
  assert.equal(app.cancellations, 2);
  assert.equal(focused, 1);
  assert.equal(button.parentElement.querySelector(".speech-stop"), null);
  assert.equal(status.textContent, "Reading stopped.");
});

test("speech finish and page navigation remove controls; stale events cannot stop later speech", () => {
  const app = createApp({ loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const status = button.parentElement.querySelector("[data-speech-status]");
  button.click();
  const first = app.spoken[0];
  button.click();
  assert(status.textContent.includes(app.content.about.readingStarted));
  assert(!status.textContent.includes("Reading stopped."));
  first.emit("end");
  assert(button.parentElement.querySelector(".speech-stop"));
  app.spoken[1].emit("end");
  assert.equal(status.textContent, "");
  button.click();
  const cancellations = app.cancellations;
  app.emitWindow("pagehide");
  assert.equal(app.cancellations, cancellations + 1);
  assert.equal(button.parentElement.querySelector(".speech-stop"), null);
  assert.equal(status.textContent, "");
});

test("CV speech uses the shared story and failures clean up its controls", () => {
  const app = createApp({ address: "https://portfolio.example/cv/", loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const status = button.parentElement.querySelector("[data-speech-status]");
  button.click();
  assert.equal(app.spoken[0].text, app.content.cv.reading.text);
  app.spoken[0].emit("error");
  assert.equal(status.textContent, "Text-to-speech is not available in this browser.");
  assert.equal(button.parentElement.querySelector(".speech-stop"), null);
  app.window.speechSynthesis.speak = () => {
    throw new Error("Speech unavailable");
  };
  button.click();
  assert.equal(status.textContent, "Text-to-speech is not available in this browser.");
  assert.equal(button.parentElement.querySelector(".speech-stop"), null);
});

test("speech completion and failure restore focus only when removing the focused stop control", () => {
  const app = createApp({ loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const other = app.document.querySelector("nav a");
  let focused = 0;
  button.focus = () => {
    focused++;
    app.document.activeElement = button;
  };
  for (const event of ["end", "error"]) {
    button.click();
    app.document.activeElement = button.parentElement.querySelector(".speech-stop");
    app.spoken.at(-1).emit(event);
    assert.equal(app.document.activeElement, button);
    assert.equal(button.parentElement.querySelector(".speech-stop"), null);
  }
  assert.equal(focused, 2);
  button.click();
  app.document.activeElement = other;
  app.spoken.at(-1).emit("end");
  assert.equal(focused, 2, "finishing speech must not move focus from another control");
  assert.equal(app.document.activeElement, other);
});

test("unsupported speech stays hidden and startup preserves the generated blog navigation", () => {
  for (const enabled of [false, true]) {
    const pageFiles = buildPages({ blog: enabled ? blog : disabledBlog });
    const app = createApp({ pageFiles, speechSupported: false });
    assert.equal(app.document.querySelector('[data-section="blog"]').hidden, !enabled);
    app.runSite();
    assert.equal(app.document.querySelector("[data-reading]").hidden, true);
    assert.equal(app.document.querySelector('[data-section="blog"]').hidden, !enabled);
    assert.equal(app.portfolio.blogConfiguration, undefined);
  }
});
