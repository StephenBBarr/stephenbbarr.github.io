"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseHTML } = require("linkedom");
const { buildPages } = require("../scripts/build.cjs");

const css = fs.readFileSync(path.join(__dirname, "../styles/site.css"), "utf8");
const stylesheet = parseHTML(`<style>${css}</style>`).document.querySelector("style").sheet;
const rules = [...stylesheet.cssRules];
const themes = [":root", ':root[data-theme="dark"]'].map((selector) => ({
  name: selector,
  style: rules.find((rule) => rule.selectorText === selector).style,
}));

// WCAG relative luminance for the sRGB colors actually shipped in the stylesheet.
function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const channels = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

test("both themes retain enhanced normal-text contrast for body text, supporting text and links", () => {
  for (const { name, style } of themes) {
    for (const foreground of ["--ink", "--muted", "--accent"]) {
      for (const background of ["--paper", "--surface"]) {
        const ratio = contrast(style.getPropertyValue(foreground), style.getPropertyValue(background));
        assert(ratio >= 7, `${name}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1, below 7:1`);
      }
    }
  }
});

test("selected text remains readable in both themes", () => {
  for (const { name, style } of themes) {
    const ratio = contrast(style.getPropertyValue("--ink"), style.getPropertyValue("--selection"));
    assert(ratio >= 7, `${name}: selected text contrast is ${ratio.toFixed(2)}:1`);
  }
});

test("keyboard focus outlines have sufficient thickness and contrast in both themes", () => {
  const focusRules = rules.filter((rule) => /:focus/.test(rule.selectorText) && rule.style.outline);
  assert(focusRules.length > 0);
  for (const rule of focusRules) {
    const outline = rule.style.outline.match(/^(\d+(?:\.\d+)?)px solid var\((--[a-z-]+)\)$/);
    assert(outline, `Review focus appearance after changing ${rule.selectorText}: ${rule.style.outline}`);
    assert(Number(outline[1]) >= 2, `${rule.selectorText}: focus outline must be at least 2px`);
    for (const { name, style } of themes) {
      for (const background of ["--paper", "--surface"]) {
        const ratio = contrast(style.getPropertyValue(outline[2]), style.getPropertyValue(background));
        assert(ratio >= 3, `${name}: ${rule.selectorText} focus contrast is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test("every generated page allows zoom, declares its language and offers a keyboard route to main content", () => {
  for (const [file, html] of buildPages()) {
    const { document } = parseHTML(html);
    assert.match(document.documentElement.lang, /^en(?:-|$)/, file);
    const viewport = document.querySelector('meta[name="viewport"]').getAttribute("content");
    assert(!/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=/i.test(viewport), `${file}: do not restrict zoom`);
    const skip = document.body.firstElementChild;
    assert(skip.matches("a.skip-link"), `${file}: the first element must be the skip link`);
    const main = document.querySelector(skip.getAttribute("href"));
    assert.equal(main.tagName, "MAIN", file);
    assert.equal(main.getAttribute("tabindex"), "-1", `${file}: skip target must accept focus`);
    for (const element of document.querySelectorAll("[tabindex]")) {
      assert(Number(element.getAttribute("tabindex")) <= 0, `${file}: preserve the natural keyboard order`);
    }
  }
});
