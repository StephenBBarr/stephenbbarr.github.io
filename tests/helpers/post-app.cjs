"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const { buildPages } = require("../../scripts/build.cjs");
const { blog, postTexts } = require("./blog-content.cjs");

function textResponse(text = postTexts.new, status = 200, headers = {}) {
  return new Response(new TextEncoder().encode(text), {
    status, headers: { "content-type": "text/plain; charset=utf-8", ...headers },
  });
}

function createPostApp({
  file = "blog/new/index.html",
  fetcher = async () => textResponse(),
  timer = setTimeout,
  clearTimer = clearTimeout,
  date = Date,
  editDocument = () => {},
} = {}) {
  const { document } = parseHTML(buildPages({ blog }).get(file));
  editDocument(document);
  const body = document.querySelector("#blog-body");
  const retry = document.querySelector("#blog-retry");
  const status = document.querySelector("#blog-status");
  const requests = [];
  for (const node of [body, retry, document.querySelector("nav a")].filter(Boolean)) {
    node.focus = () => { document.activeElement = node; };
  }
  const initial = {
    title: document.title,
    heading: document.querySelector("h1"),
    date: document.querySelector("time"),
    canonical: document.querySelector('link[rel="canonical"]').getAttribute("href"),
    openGraph: document.querySelector('meta[property="og:title"]').content,
  };
  const context = vm.createContext({
    document, location: new URL(`https://portfolio.example/${file}`),
    URL, AbortController, TextDecoder, Uint8Array, TypeError, Error,
    Date: date, setTimeout: timer, clearTimeout: clearTimer,
    fetch: (url, options) => {
      requests.push({ url: url.href, options, statusMounted: status?.isConnected, statusText: status?.textContent });
      return fetcher(url, options, requests.length);
    },
  });
  for (const file of ["gemtext.js", "blog.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "../../scripts", file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  return { document, body, retry, status, requests, initial };
}

async function drain() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setImmediate(resolve));
}

function manualClock() {
  let now = Date.parse("2026-09-11T12:00:00Z");
  let nextId = 0;
  const timers = new Map();
  class ClockDate extends Date {
    static now() { return now; }
  }
  return {
    date: ClockDate,
    timer(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay, delay });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, entry]) => entry.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, entry] = next;
        timers.delete(id);
        now = entry.at;
        entry.callback();
      }
      now = target;
    },
    get pendingDelays() { return [...timers.values()].map((entry) => entry.delay); },
  };
}

module.exports = { createPostApp, textResponse, drain, manualClock };
