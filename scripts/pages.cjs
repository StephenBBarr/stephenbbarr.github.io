"use strict";

const fs = require("node:fs");
const path = require("node:path");
const defaultContent = require("./content.cjs");

const templateDirectory = path.join(__dirname, "../templates");
const htmlEntities = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function renderPage(section, content = defaultContent) {
  switch (section) {
    case "not-found":
      return renderTemplate("not-found", {});
    case "about":
      return renderAbout(content.about);
    case "contact":
      return renderContact(content);
    case "cv":
      return renderCv(content);
    default:
      throw new Error(`Unknown static page: ${section}`);
  }
}

function renderAbout(about) {
  const paragraphs = about.paragraphs
    .map((text) => renderParagraph(text))
    .join("");
  const readingText = about.paragraphs.join(" ");

  return renderTemplate("about", {
    ariaLabel: escape(about.ariaLabel),
    headline: escape(about.headline),
    paragraphs,
    portraitSource: escape(about.portrait.source),
    portraitDescription: escape(about.portrait.alternativeText),
    portraitWidth: escape(about.portrait.width),
    portraitHeight: escape(about.portrait.height),
    readingControls: renderReadingControls("about", readingText, about.readingStarted),
  });
}

function renderContact(content) {
  const { person, contact } = content;

  return renderTemplate("contact", {
    ariaLabel: escape(contact.ariaLabel),
    heading: renderPageHeading("contact", content),
    locationLabel: escape(contact.labels.location),
    location: escape(person.location),
    linkedInLabel: escape(contact.labels.linkedin),
    linkedIn: renderLinkedIn(person.linkedin),
  });
}

function renderCv(content) {
  const { person, cv } = content;
  const profile = renderParagraph(cv.profile.body);
  const experience = cv.experience.entries.map(renderExperience).join("");
  const projects = cv.projects.entries.map(renderProject).join("");
  const technology = renderParagraph(cv.technology.body);
  const education = renderEducation(cv.education.entries);

  return renderTemplate("cv", {
    ariaLabel: escape(cv.ariaLabel),
    heading: renderPageHeading("cv", content),
    noticeLabel: escape(cv.notice.label),
    noticePrefix: escape(cv.notice.prefix),
    noticeLink: renderLinkedIn(person.linkedin, cv.notice.linkLabel),
    noticeSuffix: escape(cv.notice.suffix),
    pdfLink: renderPdfLink(cv.pdf),
    name: escape(person.name),
    identityTitle: renderParagraph(cv.identity.title),
    location: escape(person.location),
    linkedIn: renderLinkedIn(person.linkedin),
    profile: renderCvSection(cv.profile.ariaLabel, profile),
    experience: renderCvSection(cv.experience.ariaLabel, experience),
    projects: renderCvSection(cv.projects.ariaLabel, projects),
    technology: renderCvSection(cv.technology.ariaLabel, technology),
    education: renderCvSection(cv.education.ariaLabel, education),
    readingControls: renderReadingControls("cv", cv.reading.text, cv.reading.started),
  });
}

function renderTemplate(name, values) {
  const templatePath = path.join(templateDirectory, `${name}.html`);
  // Page fragments end at their closing tag, without the file's final newline.
  const template = fs.readFileSync(templatePath, "utf8").trimEnd();

  // Values contain escaped text or HTML already produced by a rendering helper.
  // Replace once so inserted content is never interpreted as another template.
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`Unknown ${name} template value: ${key}`);
    }
    return values[key];
  });
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

function renderPageHeading(section, content) {
  const navigationItem = content.navigation.find((item) => item.id === section);
  return `<h1 class="visually-hidden">${escape(navigationItem.label)}</h1>`;
}

function renderParagraph(text, className = "") {
  return `<p class="${className}">${escape(text)}</p>`;
}

function renderLinkedIn(link, label = link.label) {
  const address = escape(link.href);
  const text = escape(label);
  return `<a href="${address}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

function renderPdfLink(pdf) {
  const address = escape(pdf.href);
  const label = escape(pdf.downloadLabel);
  return `<a class="action-link cv-download" href="${address}" download>${label}</a>`;
}

function renderAchievements(achievements) {
  const items = [];
  for (const achievement of achievements) {
    const lead = escape(achievement.lead);
    const body = escape(achievement.body);
    items.push(`<li><strong>${lead}</strong> ${body}</li>`);
  }

  return `<ul class="bullet-list stack">${items.join("")}</ul>`;
}

function renderExperience(entry) {
  const organisation = escape(entry.organisation);
  const role = renderParagraph(entry.role, "meta");
  const achievements = renderAchievements(entry.achievements);
  let subrole = "";
  if (entry.subrole) {
    subrole = renderParagraph(entry.subrole.role, "meta");
  }

  return `<article class="entry stack">
          <header class="entry-header"><div><h3>${organisation}</h3>${role}</div></header>
          ${subrole}
          ${achievements}
        </article>`;
}

function renderProject(entry) {
  const name = escape(entry.name);
  const achievements = renderAchievements(entry.achievements);

  return `<article class="entry stack">
    <header class="entry-header"><h3>${name}</h3></header>
    ${achievements}
  </article>`;
}

function renderEducation(entries) {
  const qualifications = [];
  for (const entry of entries) {
    const institution = escape(entry.institution);
    const qualification = escape(entry.qualification);
    qualifications.push(`<div>
          <dt>${institution}</dt><dd>${qualification}</dd>
        </div>`);
  }

  return `<dl class="cv-education stack">${qualifications.join("")}</dl>`;
}

function renderCvSection(label, body) {
  const heading = escape(label);
  return `<section class="stack" aria-label="${heading}">
    <h2>${heading}</h2>${body}
  </section>`;
}

function renderReadingControls(section, text, startedMessage) {
  const buttonLabel = section === "cv" ? "Read CV summary aloud" : "Read aloud";
  const attributes = [
    'class="text-button"',
    'type="button"',
    `data-reading="${section}"`,
    `data-reading-text="${escape(text)}"`,
    `data-reading-started="${escape(startedMessage)}"`,
    "hidden",
  ];

  return `<div class="reading-controls">
    <button ${attributes.join(" ")}>${buttonLabel}</button>
    <span class="meta" data-speech-status role="status"></span>
  </div>`;
}

module.exports = {
  renderPage,
  renderTemplate,
  escape,
};
