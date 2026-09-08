"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const content = require("../scripts/content.cjs");
const { buildPages } = require("../scripts/build.cjs");
const pages = buildPages();

const rootPath = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootPath, file), "utf8");

function memoryStorage(initial = {}, denied = false) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { if (denied) throw new Error("Storage denied"); return values.get(key) ?? null; },
    setItem(key, value) { if (denied) throw new Error("Storage denied"); values.set(key, String(value)); },
    removeItem(key) { if (denied) throw new Error("Storage denied"); values.delete(key); },
  };
}

function createApp({
  address = "https://portfolio.example/",
  localStorage = memoryStorage(), speechSupported = true,
  blogReady = false, loadSite = false,
} = {}) {
  const location = new URL(address);
  const file = location.pathname.endsWith("/") ? `${location.pathname.slice(1)}index.html` : location.pathname.slice(1);
  const { document, window: domWindow } = parseHTML(pages.get(file));
  const windowEvents = document.createElement("window-events");
  const spoken = [];
  let cancellations = 0;
  class Utterance {
    constructor(text) { this.text = text; this.events = new Map(); }
    addEventListener(name, callback) { this.events.set(name, callback); }
    emit(name) { this.events.get(name)?.(); }
  }
  const window = {
    addEventListener: (...args) => windowEvents.addEventListener(...args),
  };
  if (speechSupported) {
    window.SpeechSynthesisUtterance = Utterance;
    window.speechSynthesis = {
      cancel: () => { cancellations += 1; },
      speak: (utterance) => spoken.push(utterance),
    };
  }
  const context = vm.createContext({
    document, window, localStorage,
    location: new URL(address), URL, URLSearchParams,
    CustomEvent: domWindow.CustomEvent,
  });
  function run(file) { vm.runInContext(read(file), context, { filename: file }); }
  run("scripts/theme.js");
  const portfolio = context.Portfolio;
  const blogRequests = [];
  portfolio.blogConfiguration = { resolve: () => ({ ready: blogReady }) };
  if (document.documentElement.dataset.page === "blog") {
    run("scripts/gemtext.js");
    const heading = (label) => {
      const node = document.createElement("h1");
      node.textContent = label;
      return node;
    };
    portfolio.blog = {
      showIndex: () => { blogRequests.push("index"); return heading("Blog"); },
      readPostBySlug: (slug) => { blogRequests.push(slug); return heading("A test post"); },
    };
  }
  function runSite() {
    if (document.querySelector("[data-reading]")) run("scripts/actions.js");
    run("scripts/site.js");
  }
  if (loadSite) runSite();
  return {
    document, window, portfolio, localStorage, spoken, blogRequests, content,
    get cancellations() { return cancellations; },
    emitWindow: (name) => windowEvents.dispatchEvent(new domWindow.Event(name)),
    emit: (name, detail, target = document) => target.dispatchEvent(new domWindow.CustomEvent(name, { detail, bubbles: true })),
    runSite,
  };
}

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
    address: "https://portfolio.example/cv/", loadSite: true,
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

test("blog query parameters select the index or a direct post on both native addresses", () => {
  for (const path of ["/blog/", "/blog/index.html"]) {
    assert.deepEqual(createApp({ address: `https://portfolio.example${path}?post=hello`, loadSite: true }).blogRequests, ["hello"]);
    assert.deepEqual(createApp({ address: `https://portfolio.example${path}`, loadSite: true }).blogRequests, ["index"]);
  }
  assert.deepEqual(createApp({ address: "https://portfolio.example/contact/?post=hello", loadSite: true }).blogRequests, []);
});

test("invalid direct post addresses give a useful link without requesting a post", () => {
  const app = createApp({ address: "https://portfolio.example/blog/?post=..%2Fsecret", loadSite: true });
  assert.deepEqual(app.blogRequests, []);
  assert.equal(app.document.querySelector("main h1").textContent, "Post not found");
  assert.equal(app.document.querySelector("main a").getAttribute("href"), "/blog/");
});

test("speech begins only on request and the stop control cancels and restores focus", () => {
  const app = createApp({ loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const status = button.parentElement.querySelector("[data-speech-status]");
  assert.equal(button.hidden, false);
  assert.equal(app.spoken.length, 0);
  assert.equal(app.cancellations, 0);
  let focused = 0;
  button.focus = () => { focused += 1; };
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
  app.window.speechSynthesis.speak = () => { throw new Error("Speech unavailable"); };
  button.click();
  assert.equal(status.textContent, "Text-to-speech is not available in this browser.");
  assert.equal(button.parentElement.querySelector(".speech-stop"), null);
});

test("speech completion and failure restore focus only when removing the focused stop control", () => {
  const app = createApp({ loadSite: true });
  const button = app.document.querySelector("[data-reading]");
  const other = app.document.querySelector("nav a");
  let focused = 0;
  button.focus = () => { focused++; app.document.activeElement = button; };
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

test("unsupported speech remains hidden and blog publication controls navigation", () => {
  const app = createApp({ speechSupported: false, loadSite: true });
  assert.equal(app.document.querySelector("[data-reading]").hidden, true);
  assert.equal(app.document.querySelector('[data-section="blog"]').hidden, true);
  const published = createApp({ blogReady: true, loadSite: true });
  assert.equal(published.document.querySelector('[data-section="blog"]').hidden, false);
});
