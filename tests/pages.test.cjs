"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseHTML } = require("linkedom");
const defaultContent = require("../scripts/content.cjs");
const { renderPage } = require("../scripts/pages.cjs");

function createApp(updateContent) {
  const content = updateContent ? updateContent(defaultContent) : defaultContent;
  const render = (section) => parseHTML(`<html><body>${renderPage(section, content)}</body></html>`).document.body.firstElementChild;
  return { content, render };
}

test("CV includes the selected projects", () => {
  const { content, render } = createApp();

  {
    const cv = render("cv");
    for (const entry of content.cv.projects.entries) {
      assert(cv.textContent.includes(entry.name));
      for (const achievement of entry.achievements) {
        for (const fact of [achievement.lead, achievement.body]) {
          assert(cv.textContent.includes(fact));
        }
      }
    }
  }
});

test("navigation keeps the text section names and public addresses together", () => {
  const { content } = createApp();
  assert.deepEqual(
    Array.from(content.navigation, ({ id, label, href }) => [id, label, href]),
    [
      ["about", "About", "/"],
      ["cv", "CV", "/cv/"],
      ["blog", "Blog", "/blog/"],
      ["contact", "Contact", "/contact/"],
    ],
  );
});

test("text sections have one main heading and no skipped heading levels", () => {
  const { render } = createApp();
  for (const name of ["About", "Cv", "Contact"]) {
    const page = render(name.toLowerCase());
    const headings = [...page.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    assert.equal(page.querySelectorAll("h1").length, 1, name);
    assert.equal(headings[0].tagName, "H1", name);
    assert.equal(headings[0].classList.contains("visually-hidden"), name !== "About", name);
    for (let i = 1; i < headings.length; i += 1) {
      assert(Number(headings[i].tagName[1]) <= Number(headings[i - 1].tagName[1]) + 1, name);
    }
  }
  assert.deepEqual(
    [...render("cv").querySelectorAll("h2")].map((heading) => heading.textContent),
    ["Profile", "Professional experience", "Selected projects", "Core technology", "Education"],
  );
});

test("About retains every paragraph and uses a still portrait", () => {
  const { content, render } = createApp();
  const textPage = render("about");
  const expected = Array.from(content.about.paragraphs);
  assert.deepEqual([...textPage.querySelectorAll("p")].map((node) => node.textContent), expected);
  assert.equal(textPage.querySelector("h1").textContent, content.about.headline);
  assert.equal(textPage.querySelectorAll(".about-layout .about-portrait img").length, 1);
  assert.equal(textPage.querySelector("img").getAttribute("src"), "/assets/stephen-barr.jpg");
  assert.equal(textPage.querySelector("img").getAttribute("alt"), content.about.portrait.alternativeText);
  assert.equal(textPage.querySelector(".transfer-progress, .transfer-status, figcaption"), null);
});

test("CV preserves all public facts with a useful PDF link near the top", () => {
  const { content, render } = createApp();
  const { person, cv } = content;
  const facts = [person.name, person.location, person.linkedin.label, cv.identity.title,
    cv.profile.body, cv.technology.body, cv.notice.prefix, cv.notice.suffix];
  for (const entry of cv.experience.entries) {
    facts.push(entry.organisation, entry.role, ...(entry.dates || []));
    if (entry.subrole) facts.push(entry.subrole.role, ...(entry.subrole.dates || []));
    for (const achievement of entry.achievements) facts.push(achievement.lead, achievement.body);
  }
  for (const entry of cv.education.entries) facts.push(entry.institution, entry.qualification);

  {
    const page = render("cv");
    for (const fact of facts) assert(page.textContent.includes(fact), fact);
    const pdf = page.querySelector('a[href="/assets/Stephen-Barr-CV.pdf"]');
    assert(pdf);
    assert(pdf.hasAttribute("download"));
    assert.equal(pdf.parentElement.tagName === "HEADER" || pdf.parentElement.parentElement.tagName === "HEADER", true);
  }
  const page = render("cv");
  assert.equal(page.querySelector("header .action-link").textContent, "Download CV (PDF)");
});

test("Contact offers the existing public route without a form", () => {
  const { content, render } = createApp();
  const page = render("contact");
  assert.equal(page.querySelector("h1").textContent, "Contact");
  assert(page.textContent.includes(content.person.location));
  const link = page.querySelector("a");
  assert.equal(link.getAttribute("href"), content.person.linkedin.href);
  assert.match(link.textContent, /opens in a new tab/);
  assert.equal(page.querySelector("form"), null);
});

test("speech enhancement starts hidden and has a separate announcement area", () => {
  const { render } = createApp();
  for (const name of ["About", "Cv"]) {
    const page = render(name.toLowerCase());
    const button = page.querySelector("button[data-reading]");
    assert(button.hasAttribute("hidden"));
    assert.equal(button.getAttribute("type"), "button");
    assert.equal(button.getAttribute("data-reading"), name.toLowerCase());
    assert.equal(button.nextElementSibling.getAttribute("role"), "status");
    assert(button.nextElementSibling.hasAttribute("data-speech-status"));
  }
});

test("templates escape text and attribute values without interpreting markup", () => {
  const input = '<img src=x onerror="alert(1)">';
  const { render } = createApp((content) => ({
    ...content, about: { ...content.about, paragraphs: [input] },
  }));
  const page = render("about");
  assert.equal(page.querySelector("p").textContent, input);
  assert.equal(page.querySelector("[onerror]"), null);
  assert.equal(page.querySelector("[data-reading]").dataset.readingText, input);
  assert.match(page.outerHTML, /&lt;img/);
});
