"use strict";

const defaultContent = require("./content.cjs");

// Escape both visible copy and attribute values. Templates contain markup;
// portfolio content always remains text.
function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderPage(section, content = defaultContent) {
  const { person, about, cv } = content;
  const label = { accessibility: "Accessibility", "not-found": "Page not found" }[section]
    || content.navigation.find(({ id }) => id === section).label;
  const heading = `<h1 class="visually-hidden">${escape(label)}</h1>`;
  const paragraph = (text, className = "") => `<p class="${className}">${escape(text)}</p>`;
  const linkedIn = (label = person.linkedin.label) =>
    `<a href="${escape(person.linkedin.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(label.includes("opens in a new tab") ? label : `${label} (opens in a new tab)`)}">${escape(label)}</a>`;
  const pdfLink = `<a class="action-link cv-download" href="${escape(cv.pdf.href)}" download>${escape(cv.pdf.downloadLabel)}</a>`;
  const achievements = (items) => `<ul class="bullet-list stack">${items.map(({ lead, body }) =>
    `<li><strong>${escape(lead)}</strong> ${escape(body)}</li>`).join("")}</ul>`;
  const project = (entry, level) => `<article class="entry stack">
    <header class="entry-header"><h${level}>${escape(entry.name)}</h${level}></header>
    ${achievements(entry.achievements)}
  </article>`;
  const readingControls = (text, started) => `<div class="reading-controls">
    <button class="text-button" type="button" data-reading="${section}" data-reading-text="${escape(text)}" data-reading-started="${escape(started)}" hidden>${section === "cv" ? "Read CV summary aloud" : "Read aloud"}</button>
    <span class="meta" data-speech-status role="status"></span>
  </div>`;
  const cvSection = (label, body) => `<section class="stack" aria-label="${escape(label)}">
    <h2>${escape(label)}</h2>${body}
  </section>`;

  switch (section) {
    case "not-found":
      return `<section class="stack">
        <h1>Page not found</h1>
        <p>This address may have changed or the page may have been removed.</p>
        <p><a class="action-link" href="/">Return to the portfolio</a></p>
      </section>`;
    case "accessibility":
      return `<article class="stack stack--spacious">
        <header class="stack"><h1>Accessibility</h1>
          <p>I want everyone to be able to read this portfolio and blog. I am working towards the <a href="https://www.w3.org/TR/WCAG22/">Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA</a>, with additional improvements to contrast, focus visibility and control sizes.</p>
        </header>
        <section class="stack" aria-labelledby="using-the-site"><h2 id="using-the-site">Using this site</h2>
          <ul class="bullet-list stack">
            <li>Use a keyboard to follow links and operate controls. The first link lets you skip straight to the content.</li>
            <li>Enlarge text with your browser's zoom or text settings. The layout adapts to narrow screens and increased text spacing.</li>
            <li>Choose light or dark appearance using the control at the bottom of each page. Your choice is remembered when your browser permits it.</li>
            <li>Use your screen reader to navigate headings, links and lists. Optional read-aloud controls are available on About and CV in supporting browsers; the CV control reads a summary.</li>
            <li>Read the <a href="/cv/">CV as a web page</a> or open its downloadable PDF. The PDF has larger text, tagged headings and lists, a reading order and bookmarks.</li>
          </ul>
        </section>
        <section class="stack" aria-labelledby="known-limitations"><h2 id="known-limitations">Known limitations</h2>
          <p>A complete review with screen readers and disabled users is still needed, including the CV PDF. I am not yet claiming full WCAG conformance.</p>
          <p>Reading the blog here needs JavaScript. Other pages remain readable without it. Blog requests can fail; an error message and retry control remain available.</p>
          <p>LinkedIn and other external sites have their own accessibility arrangements.</p>
        </section>
        <section class="stack" aria-labelledby="report-a-problem"><h2 id="report-a-problem">Report an accessibility problem</h2>
          <p>Please <a href="/contact/">contact me through LinkedIn</a> if something prevents you from using the site or you need the information in another format. Include the page address, what you were trying to do, and any browser or assistive technology details you are comfortable sharing.</p>
        </section>
        <section class="stack" aria-labelledby="review"><h2 id="review">Review</h2>
          <p>Last reviewed: <time datetime="2026-09-08">8 September 2026</time>.</p>
          <p>Checks cover page structure, colour contrast, keyboard focus, text enlargement, mobile layout, speech controls and blog loading and recovery. Automated checks support this work; they do not replace testing with people who use assistive technology.</p>
        </section>
      </article>`;
    case "about":
      return `<section class="stack" aria-label="${escape(about.ariaLabel)}">
        <div class="about-layout">
          <div class="stack">
            <h1>${escape(about.headline)}</h1>
            ${about.paragraphs.map((text) => paragraph(text)).join("")}
          </div>
          <figure class="about-portrait"><img src="${escape(about.portrait.source)}" alt="${escape(about.portrait.alternativeText)}" width="${escape(about.portrait.width)}" height="${escape(about.portrait.height)}" decoding="async"></figure>
        </div>
        ${readingControls(about.paragraphs.join(" "), about.readingStarted)}
      </section>`;
    case "contact":
      return `<section class="stack" aria-label="${escape(content.contact.ariaLabel)}">
        ${heading}<address class="stack">
          <p><strong>${escape(content.contact.labels.location)}:</strong> ${escape(person.location)}</p>
          <p><strong>${escape(content.contact.labels.linkedin)}:</strong> ${linkedIn(`${person.linkedin.label} (opens in a new tab)`)}</p>
        </address>
      </section>`;
    case "cv":
      return `<article class="stack stack--spacious" aria-label="${escape(cv.ariaLabel)}">
        <header class="stack">
          ${heading}<aside class="notice stack" aria-labelledby="cv-notice-title">
            <p><strong id="cv-notice-title">${escape(cv.notice.label)}.</strong> ${escape(cv.notice.prefix)}${linkedIn(cv.notice.linkLabel)}${escape(cv.notice.suffix)}</p>
            ${pdfLink}
          </aside>
          <div class="cv-identity">
            <div><p class="document-title">${escape(person.name)}</p>${paragraph(cv.identity.title)}</div>
            <address class="meta"><span>${escape(person.location)}</span>${linkedIn()}</address>
          </div>
        </header>
        ${cvSection(cv.profile.ariaLabel, paragraph(cv.profile.body))}
        ${cvSection(cv.experience.ariaLabel, cv.experience.entries.map((entry) => `<article class="entry stack">
          <header class="entry-header"><div><h3>${escape(entry.organisation)}</h3>${paragraph(entry.role, "meta")}</div></header>
          ${entry.subrole ? paragraph(entry.subrole.role, "meta") : ""}
          ${achievements(entry.achievements)}
        </article>`).join(""))}
        ${cvSection(cv.projects.ariaLabel, cv.projects.entries.map((entry) => project(entry, 3)).join(""))}
        ${cvSection(cv.technology.ariaLabel, paragraph(cv.technology.body))}
        ${cvSection(cv.education.ariaLabel, `<dl class="cv-education stack">${cv.education.entries.map((entry) => `<div>
          <dt>${escape(entry.institution)}</dt><dd>${escape(entry.qualification)}</dd>
        </div>`).join("")}</dl>`)}
        ${pdfLink}
        ${readingControls(cv.reading.text, cv.reading.started)}
      </article>`;
    default:
      throw new Error(`Unknown static page: ${section}`);
  }
}

module.exports = { renderPage, escape };
