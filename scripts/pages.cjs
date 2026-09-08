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
          <p>I want this site to be easy to read and use.</p>
        </header>
        <section class="stack" aria-labelledby="using-the-site"><h2 id="using-the-site">Using this site</h2>
          <ul class="bullet-list stack">
            <li>Use your keyboard to follow links. The first link skips to the page content.</li>
            <li>Enlarge the text using your browser settings.</li>
            <li>Switch between light and dark appearance at the bottom of any page.</li>
            <li>Listen to About or a CV summary using the read-aloud button, if your browser supports it.</li>
            <li>Read the <a href="/cv/">CV online</a> or download it as a PDF.</li>
          </ul>
        </section>
        <section class="stack" aria-labelledby="known-limitations"><h2 id="known-limitations">Known limits</h2>
          <p>The site and CV PDF still need a full review with screen readers and disabled users.</p>
          <p>The blog needs JavaScript enabled in your browser. Other pages can be read without it.</p>
        </section>
        <section class="stack" aria-labelledby="report-a-problem"><h2 id="report-a-problem">Need help?</h2>
          <p>Please <a href="/contact/">contact me through LinkedIn</a> if you have trouble using the site or need another format. Tell me which page you were using and what went wrong.</p>
        </section>
        <p class="meta">Last updated: <time datetime="2026-09-08">8 September 2026</time>.</p>
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
