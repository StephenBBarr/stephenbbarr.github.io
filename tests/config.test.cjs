"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadBlog } = require("../scripts/blog.cjs");
const { settings: validSettings } = require("./helpers/blog-content.cjs");

const invalidProductionSettings = [
  ["HTTP mixed content", { bridgeBase: "http://bridge.example.test/" }],
  ["blank bridge", { bridgeBase: "" }],
  ["relative bridge", { bridgeBase: "/bridge/" }],
  ["missing bridge slash", { bridgeBase: "https://bridge.example.test/api" }],
  ["credentials", { bridgeBase: "https://user:password@bridge.example.test/" }],
  ["query", { bridgeBase: "https://bridge.example.test/?target=elsewhere" }],
  ["fragment", { capsuleIndex: "gemini://capsule.example.test/blog/#part" }],
  ["HTTP capsule", { capsuleIndex: "https://capsule.example.test/blog/" }],
  ["missing capsule host", { capsuleIndex: "gemini:/blog/" }],
  ["wrong capsule path", { capsuleIndex: "gemini://capsule.example.test/posts/" }],
  ["IPv4 loopback bridge", { bridgeBase: "https://127.0.0.1/" }],
  ["IPv6 loopback bridge", { bridgeBase: "https://[::1]/" }],
  ["mapped IPv6 bridge", { bridgeBase: "https://[::ffff:127.0.0.1]/" }],
  ["mapped IPv6 capsule", { capsuleIndex: "gemini://[::ffff:127.0.0.1]/blog/" }],
  ["shortened IPv4 bridge", { bridgeBase: "https://127.1/" }],
  ["shortened IPv4 capsule", { capsuleIndex: "gemini://127.1/blog/" }],
  ["decimal IPv4 bridge", { bridgeBase: "https://2130706433/" }],
  ["decimal IPv4 capsule", { capsuleIndex: "gemini://2130706433/blog/" }],
  ["hexadecimal IPv4 bridge", { bridgeBase: "https://0x7f000001/" }],
  ["hexadecimal IPv4 capsule", { capsuleIndex: "gemini://0x7f000001/blog/" }],
  ["octal IPv4 bridge", { bridgeBase: "https://0177.0.0.1/" }],
  ["octal IPv4 capsule", { capsuleIndex: "gemini://0177.0.0.1/blog/" }],
  ["non-loopback IPv4 bridge", { bridgeBase: "https://192.168.1.1/" }],
  ["numeric TLD capsule", { capsuleIndex: "gemini://capsule.123/blog/" }],
  ["single-label capsule", { capsuleIndex: "gemini://capsule/blog/" }],
  ["underscore in capsule hostname", { capsuleIndex: "gemini://my_capsule.example.test/blog/" }],
  ["leading hyphen in capsule label", { capsuleIndex: "gemini://-capsule.example.test/blog/" }],
  ["trailing hyphen in capsule label", { capsuleIndex: "gemini://capsule-.example.test/blog/" }],
  ["overlength capsule label", { capsuleIndex: `gemini://${"a".repeat(64)}.example.test/blog/` }],
  ["localhost bridge", { bridgeBase: "https://localhost/" }],
  ["trailing-dot localhost bridge", { bridgeBase: "https://localhost./" }],
  ["localhost capsule", { capsuleIndex: "gemini://localhost/blog/" }],
  ["uppercase localhost capsule", { capsuleIndex: "gemini://LOCALHOST/blog/" }],
  ["local bridge", { bridgeBase: "https://bridge.local/" }],
  ["localdomain capsule", { capsuleIndex: "gemini://capsule.localdomain/blog/" }],
  ["internal capsule", { capsuleIndex: "gemini://capsule.internal/blog/" }],
  ["home.arpa capsule", { capsuleIndex: "gemini://capsule.home.arpa/blog/" }],
  ["non-boolean enabled", { enabled: "true" }],
];

for (const [name, overrides] of invalidProductionSettings) {
  test(`invalid build endpoint configuration is rejected before fetching: ${name}`, async () => {
    let requests = 0;
    const fetcher = async () => { requests++; throw new Error("Unexpected fetch"); };
    await assert.rejects(loadBlog({ settings: { ...validSettings, ...overrides }, fetcher }));
    assert.equal(requests, 0);
  });
}
