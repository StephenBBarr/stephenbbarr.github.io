(function initialisePortfolioComponents(global) {
  "use strict";

  const portfolio = global.Portfolio || (global.Portfolio = {});
  const content = portfolio.content;

  if (!content) {
    throw new Error("Portfolio content must load before portfolio components.");
  }

  function createElement(tagName, options = {}) {
    const node = document.createElement(tagName);

    if (options.className) {
      node.className = options.className;
    }

    if (options.text !== undefined) {
      node.textContent = options.text;
    }

    Object.entries(options.attributes || {}).forEach(([name, value]) => {
      node.setAttribute(name, String(value));
    });

    return node;
  }

  function createParagraph(text, className) {
    return createElement("p", { className, text });
  }

  function appendDateLines(parent, dates) {
    dates.forEach((date, index) => {
      if (index > 0) {
        parent.append(document.createElement("br"));
      }

      parent.append(document.createTextNode(date));
    });
  }

  function createOptionList(definitions, currentTheme) {
    const list = createElement("dl", {
      className: "option-list stack stack--compact",
    });

    definitions.forEach(
      ({ name, description, parent, showCurrentTheme }, index) => {
        const row = document.createElement("div");
        const term = document.createElement("dt");
        const label = parent ? name.slice(parent.length).trim() : name;
        const detail = showCurrentTheme
          ? `${description} (current: ${currentTheme})`
          : description;

        if (parent) {
          const hasFollowingSibling = definitions
            .slice(index + 1)
            .some((definition) => definition.parent === parent);
          row.className = hasFollowingSibling
            ? "option-list-subcommand option-list-subcommand--continued"
            : "option-list-subcommand";
          term.append(
            createElement("span", {
              className: "visually-hidden",
              text: `${parent} `,
            }),
          );
        }

        term.append(createElement("code", { text: label }));
        row.append(term, createElement("dd", { text: detail }));
        list.append(row);
      },
    );

    return list;
  }

  function createHelpGroup(heading, contentNode, modifier) {
    const className = modifier
      ? `stack stack--compact help-group--${modifier}`
      : "stack stack--compact";
    const group = createElement("section", { className });
    group.append(
      createElement("h2", { text: heading }),
      contentNode,
    );
    return group;
  }

  function createAchievementList(achievements) {
    const list = createElement("ul", { className: "bullet-list stack" });

    achievements.forEach((achievement) => {
      const item = document.createElement("li");
      const lead = createElement("strong", { text: achievement.lead });
      item.append(lead, document.createTextNode(` ${achievement.body}`));
      list.append(item);
    });

    return list;
  }

  function createExperienceEntry(entryContent) {
    const entry = createElement("article", { className: "entry stack" });
    const header = createElement("header", { className: "entry-header" });
    const identity = document.createElement("div");
    const date = createElement("p", { className: "entry-date meta" });

    identity.append(
      createElement("h4", {
        className: "entry-title",
        text: entryContent.organisation,
      }),
      createParagraph(entryContent.role, "meta"),
    );
    header.append(identity);

    if (entryContent.dates.length > 0) {
      appendDateLines(date, entryContent.dates);
      header.append(date);
    }
    entry.append(header);

    if (entryContent.note) {
      entry.append(createParagraph(entryContent.note, "meta"));
    }

    if (entryContent.subrole) {
      const subrole = createElement("div", { className: "entry-header meta" });
      const subroleDate = createElement("p", { className: "entry-date" });
      subrole.append(createParagraph(entryContent.subrole.role));

      if (entryContent.subrole.dates.length > 0) {
        appendDateLines(subroleDate, entryContent.subrole.dates);
        subrole.append(subroleDate);
      }

      entry.append(subrole);
    }

    entry.append(createAchievementList(entryContent.achievements));
    return entry;
  }

  function createProjectEntry(entryContent) {
    const entry = createElement("article", { className: "entry stack" });
    const header = createElement("header", { className: "entry-header" });
    header.append(
      createElement("h4", { className: "entry-title", text: entryContent.name }),
    );
    entry.append(header, createAchievementList(entryContent.achievements));
    return entry;
  }

  function createCvPdfLink(pdfContent) {
    return createElement("a", {
      className: "action-link",
      text: pdfContent.openLabel,
      attributes: {
        href: pdfContent.href,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });
  }

  function createCommandEcho(prompt, command) {
    const line = createElement("p", {
      className: "command-echo",
    });
    line.append(
      createElement("span", {
        className: "command-prompt",
        text: prompt,
        attributes: { "aria-hidden": "true" },
      }),
      createElement("span", {
        className: "visually-hidden",
        text: "Command: ",
      }),
      createElement("span", { className: "command-value", text: command }),
    );
    return line;
  }

  function createMessage(message) {
    return createParagraph(message, "message");
  }

  function renderThemeHelp(currentTheme) {
    const themeContent = content.terminal.themeHelp;
    const response = createElement("section", {
      className: "stack",
      attributes: { "aria-label": themeContent.ariaLabel },
    });
    const guidance = document.createElement("p");

    guidance.append(
      document.createTextNode(`${themeContent.currentLabel}: `),
      createElement("code", { text: currentTheme }),
      document.createTextNode(`; ${themeContent.usageLabel}: `),
      createElement("code", { text: themeContent.usage }),
    );
    response.append(
      createElement("h2", {
        text: themeContent.heading,
      }),
      guidance,
    );
    return response;
  }

  function renderHelp(commandDefinitions, currentTheme) {
    if (!Array.isArray(commandDefinitions)) {
      throw new TypeError(
        "renderHelp expects an array of command definitions.",
      );
    }

    const response = createElement("section", {
      className: "help stack prose",
      attributes: { "aria-label": content.help.ariaLabel },
    });
    const usage = createElement("p", { className: "help-usage" });
    usage.append(createElement("code", { text: content.help.usage }));
    const commandGroups = content.help.groups.map(({ id, heading, modifier }) =>
      createHelpGroup(
        heading,
        createOptionList(
          commandDefinitions.filter(({ group }) => group === id),
          currentTheme,
        ),
        modifier,
      ),
    );

    response.append(
      createHelpGroup(content.help.usageHeading, usage),
      ...commandGroups,
      createHelpGroup(
        content.help.tipHeading,
        createParagraph(content.help.tip, "help-tip meta"),
      ),
    );
    return response;
  }

  function renderConfused() {
    const response = createElement("section", {
      className: "stack",
      attributes: { "aria-label": content.confused.ariaLabel },
    });
    const copy = createElement("div", { className: "prose stack stack--compact" });

    copy.append(
      createElement("h2", {
        text: content.confused.heading,
      }),
      createParagraph(content.confused.introduction),
    );
    content.confused.instructions.forEach((instruction) => {
      copy.append(createParagraph(instruction));
    });
    copy.append(createParagraph(content.confused.reassurance));
    response.append(copy);
    return response;
  }

  function renderContact() {
    const contactContent = content.contact;
    const person = content.person;
    const response = createElement("section", {
      className: "stack",
      attributes: { "aria-label": contactContent.ariaLabel },
    });
    const address = createElement("address", {
      className: "prose stack stack--compact",
    });

    function appendDetail(label, value) {
      const line = document.createElement("p");
      line.append(
        createElement("strong", { text: `${label}:` }),
        document.createTextNode(" "),
        value,
      );
      address.append(line);
    }

    appendDetail(
      contactContent.labels.location,
      createElement("span", { text: person.location }),
    );
    appendDetail(
      contactContent.labels.linkedin,
      createElement("a", {
        text: person.linkedin.label,
        attributes: {
          href: person.linkedin.href,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    );

    response.append(
      createElement("h2", {
        text: contactContent.heading,
      }),
      address,
    );
    return response;
  }

  function renderAbout() {
    const aboutContent = content.about;
    const response = createElement("section", {
      className: "stack",
      attributes: { "aria-label": aboutContent.ariaLabel },
    });
    const copy = createElement("div", { className: "prose stack stack--compact" });
    const portrait = createElement("figure", { className: "portrait" });
    const caption = document.createElement("figcaption");
    const portraitImage = createElement("div", { className: "portrait-image" });
    const image = createElement("img", {
      attributes: {
        src: aboutContent.portrait.source,
        alt: aboutContent.portrait.alternativeText,
        width: aboutContent.portrait.width,
        height: aboutContent.portrait.height,
        decoding: "async",
      },
    });
    const transferProgress = createElement("div", {
      className: "transfer-progress",
      attributes: { "aria-hidden": "true" },
    });

    copy.append(
      createElement("h2", {
        text: aboutContent.heading,
      }),
    );
    aboutContent.paragraphs.forEach((paragraph) => {
      copy.append(createParagraph(paragraph));
    });
    caption.append(
      createElement("span", { text: aboutContent.portrait.filename }),
      createElement("span", {
        text: aboutContent.portrait.number,
        attributes: { "aria-hidden": "true" },
      }),
    );
    portraitImage.append(
      image,
      createElement("span", {
        className: "transfer-status",
        text: aboutContent.portrait.transferStatus,
        attributes: { "aria-hidden": "true" },
      }),
    );
    transferProgress.append(
      createElement("span", { className: "progress-track" }),
    );
    portrait.append(caption, portraitImage, transferProgress);
    response.append(copy, portrait);
    return response;
  }

  function renderCv() {
    const cvContent = content.cv;
    const person = content.person;
    const cv = createElement("article", {
      className: "document stack stack--spacious",
      attributes: { "aria-label": cvContent.ariaLabel },
    });
    const header = createElement("header", { className: "document-header stack" });
    const fileBar = createElement("div", { className: "row row--spread" });
    const fileStatus = createElement("p", {
      className: "row row--spread meta",
      attributes: { "aria-hidden": "true" },
    });
    const identity = createElement("div", { className: "cv-identity" });
    const identityHeading = document.createElement("div");
    const address = createElement("address", { className: "meta" });
    const notice = createElement("aside", { className: "notice row" });
    const noticeMessage = document.createElement("p");
    const profile = createElement("section", {
      className: "stack",
      attributes: { "aria-label": cvContent.profile.ariaLabel },
    });
    const experience = createElement("section", {
      className: "stack",
      attributes: { "aria-label": cvContent.experience.ariaLabel },
    });
    const projects = createElement("section", {
      className: "stack",
      attributes: { "aria-label": cvContent.projects.ariaLabel },
    });
    const technology = createElement("section", {
      className: "stack",
      attributes: { "aria-label": cvContent.technology.ariaLabel },
    });
    const education = createElement("section", {
      className: "stack",
      attributes: { "aria-label": cvContent.education.ariaLabel },
    });
    const educationList = createElement("dl", { className: "cv-education stack" });
    const footer = createElement("footer", {
      className: "document-footer row row--spread meta",
      attributes: { "aria-hidden": "true" },
    });

    fileStatus.append(
      createElement("span", { text: cvContent.fileStatus.filename }),
      createElement("span", { text: cvContent.fileStatus.mode }),
    );
    fileBar.append(fileStatus, createCvPdfLink(cvContent.pdf));
    identityHeading.append(
      createElement("h2", { className: "document-title", text: person.name }),
      createParagraph(cvContent.identity.title),
    );
    address.append(
      createElement("span", { text: person.location }),
      createElement("a", {
        text: person.linkedin.label,
        attributes: {
          href: person.linkedin.href,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    );
    noticeMessage.append(
      document.createTextNode(cvContent.notice.prefix),
      createElement("a", {
        text: cvContent.notice.linkLabel,
        attributes: {
          href: person.linkedin.href,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      document.createTextNode(cvContent.notice.suffix),
    );
    notice.append(
      createElement("strong", {
        text: cvContent.notice.label,
      }),
      noticeMessage,
    );
    identity.append(identityHeading, address);
    header.append(fileBar, notice, identity);

    profile.append(
      createElement("h3", {
        className: "section-heading",
        text: cvContent.profile.heading,
      }),
      createParagraph(cvContent.profile.body),
    );

    experience.append(
      createElement("h3", {
        className: "section-heading",
        text: cvContent.experience.heading,
      }),
    );
    cvContent.experience.entries.forEach((entry) => {
      experience.append(createExperienceEntry(entry));
    });

    projects.append(
      createElement("h3", {
        className: "section-heading",
        text: cvContent.projects.heading,
      }),
    );
    cvContent.projects.entries.forEach((entry) => {
      projects.append(createProjectEntry(entry));
    });

    technology.append(
      createElement("h3", {
        className: "section-heading",
        text: cvContent.technology.heading,
      }),
      createParagraph(cvContent.technology.body),
    );

    cvContent.education.entries.forEach((entry) => {
      const row = document.createElement("div");
      row.append(
        createElement("dt", { text: entry.institution }),
        createElement("dd", { text: entry.qualification }),
      );

      if (entry.dates) {
        row.append(
          createElement("dd", { className: "entry-date meta", text: entry.dates }),
        );
      }

      educationList.append(row);
    });
    education.append(
      createElement("h3", {
        className: "section-heading",
        text: cvContent.education.heading,
      }),
      educationList,
    );

    footer.append(
      createElement("span", { text: cvContent.footer.filename }),
      createElement("span", { text: cvContent.footer.marker }),
    );

    cv.append(
      header,
      profile,
      experience,
      projects,
      technology,
      education,
      footer,
    );
    return cv;
  }

  portfolio.components = Object.freeze({
    createCommandEcho,
    createMessage,
    renderHelp,
    renderContact,
    renderConfused,
    renderAbout,
    renderCv,
    renderThemeHelp,
  });
})(globalThis);
