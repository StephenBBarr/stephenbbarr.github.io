"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const content = require("../../scripts/content.cjs");
const { buildPages } = require("../../scripts/build.cjs");
const { blog } = require("./blog-content.cjs");

const root = path.resolve(__dirname, "../..");
const pages = buildPages({ blog });

function memoryStorage(initial = {}, denied = false) {
  const values = new Map(Object.entries(initial));

  function requireAccess() {
    if (denied) {
      throw new Error("Storage denied");
    }
  }

  return {
    values,
    getItem(key) {
      requireAccess();
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      requireAccess();
      values.set(key, String(value));
    },
    removeItem(key) {
      requireAccess();
      values.delete(key);
    },
  };
}

function createSpeechSimulation() {
  const spoken = [];
  let cancellations = 0;

  class Utterance {
    constructor(text) {
      this.text = text;
      this.events = new Map();
    }

    addEventListener(name, callback) {
      this.events.set(name, callback);
    }

    emit(name) {
      this.events.get(name)?.();
    }
  }

  const synthesis = {
    cancel() {
      cancellations += 1;
    },
    speak(utterance) {
      return spoken.push(utterance);
    },
  };

  return {
    Utterance,
    synthesis,
    spoken,
    get cancellations() {
      return cancellations;
    },
  };
}

function pageFileFor(location) {
  const relativePath = location.pathname.slice(1);
  if (location.pathname.endsWith("/")) {
    return `${relativePath}index.html`;
  }
  return relativePath;
}

function createApp({
  address = "https://portfolio.example/",
  localStorage = memoryStorage(),
  speechSupported = true,
  pageFiles = pages,
  loadSite = false,
} = {}) {
  const location = new URL(address);
  const redirects = [];
  location.replace = (target) => redirects.push(target);
  const file = pageFileFor(location);
  const { document, window: domWindow } = parseHTML(pageFiles.get(file));
  const windowEvents = document.createElement("window-events");
  const speech = createSpeechSimulation();
  const window = {
    addEventListener: (...args) => windowEvents.addEventListener(...args),
  };
  if (speechSupported) {
    window.SpeechSynthesisUtterance = speech.Utterance;
    window.speechSynthesis = speech.synthesis;
  }

  const context = vm.createContext({
    document,
    window,
    localStorage,
    location,
    URL,
    URLSearchParams,
    CustomEvent: domWindow.CustomEvent,
  });

  function runScript(file) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }

  runScript("scripts/theme.js");
  const portfolio = context.Portfolio;

  function runSite() {
    if (document.querySelector("[data-reading]")) {
      runScript("scripts/actions.js");
    }
    runScript("scripts/site.js");
  }

  function emitWindow(name) {
    return windowEvents.dispatchEvent(new domWindow.Event(name));
  }

  function emit(name, detail, target = document) {
    const event = new domWindow.CustomEvent(name, { detail, bubbles: true });
    return target.dispatchEvent(event);
  }

  if (loadSite) {
    runSite();
  }

  return {
    document,
    window,
    portfolio,
    localStorage,
    spoken: speech.spoken,
    redirects,
    content,
    get cancellations() {
      return speech.cancellations;
    },
    emitWindow,
    emit,
    runSite,
  };
}

module.exports = { createApp, memoryStorage };
