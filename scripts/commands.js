(function registerCommands(portfolio) {
  "use strict";

  const commandDefinitions = Object.freeze(
    [
      {
        name: "about",
        description: "Show Stephen's profile",
        group: "portfolio",
        response: "about",
      },
      {
        name: "about read",
        description: "Read the About section aloud",
        group: "portfolio",
        parent: "about",
        action: "readAloud",
        reading: "about",
      },
      {
        name: "cv",
        description: "Show Stephen's abridged public CV",
        group: "portfolio",
        response: "cv",
      },
      {
        name: "cv read",
        description: "Hear a short chronological career story",
        group: "portfolio",
        parent: "cv",
        action: "readAloud",
        reading: "cv",
      },
      {
        name: "cv download",
        description: "Open the public PDF CV in a new tab",
        group: "portfolio",
        parent: "cv",
        action: "openPdf",
      },
      {
        name: "confused",
        description: "Explain how this page works",
        group: "terminal",
        response: "confused",
      },
      {
        name: "contact",
        description: "Contact Stephen",
        group: "portfolio",
        response: "contact",
      },
      {
        name: "clear",
        description: "Clear terminal history",
        group: "terminal",
        action: "clear",
      },
      {
        name: "help",
        description: "Show this help",
        group: "terminal",
        response: "help",
      },
      {
        name: "theme",
        description: "Show theme options",
        group: "themes",
        showCurrentTheme: true,
        response: "themeHelp",
      },
      {
        name: "theme dark",
        description: "Use the dark terminal theme",
        group: "themes",
        parent: "theme",
        action: "theme",
        theme: "dark",
      },
      {
        name: "theme light",
        description: "Use the muted light terminal theme",
        group: "themes",
        parent: "theme",
        action: "theme",
        theme: "light",
      },
      {
        name: "work",
        description: "Selected work",
        group: "placeholder",
      },
      {
        name: "blog",
        description: "List blog posts",
        group: "portfolio",
        action: "blogIndex",
      },
      {
        name: "blog read",
        description: "Read a post: blog read <number>",
        group: "portfolio",
        parent: "blog",
        action: "blogRead",
      },
    ].map(Object.freeze),
  );
  const commandsByName = new Map(
    commandDefinitions.map((definition) => [definition.name, definition]),
  );
  const easterEggs = Object.freeze(
    [
      { name: "ping", message: "pong. Well, that's reassuring." },
      { name: "pwd", message: "/portfolio" },
      { name: "ls", message: "about  blog  contact  cv  work" },
      {
        name: "whoami",
        message: "A visitor with excellent command-line instincts.",
      },
      {
        name: "cd",
        message: "You are already in /portfolio. There is nowhere else to go.",
      },
      {
        name: "sudo",
        message: "Permission denied. Least privilege applies here too.",
      },
      {
        name: "rm",
        message: "Easy. This is a portfolio, not production.",
      },
      {
        name: "exit",
        message: "Permission denied. I would have let you, but the browser sandbox said no.",
      },
      {
        name: "history",
        message: "Use the up and down arrow keys to browse recent commands.",
      },
      { name: "man", message: "No manual entry. Type help." },
    ].map(Object.freeze),
  );
  const responseRenderers = Object.freeze({
    about: () => portfolio.components.renderAbout(),
    contact: () => portfolio.components.renderContact(),
    confused: () => portfolio.components.renderConfused(),
    cv: () => portfolio.components.renderCv(),
    help: () =>
      portfolio.components.renderHelp(
        commandDefinitions,
        document.documentElement.dataset.theme || "dark",
      ),
    themeHelp: () =>
      portfolio.components.renderThemeHelp(
        document.documentElement.dataset.theme || "dark",
      ),
  });

  function normalise(command) {
    return String(command).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function findDefinition(normalisedCommand) {
    if (normalisedCommand.startsWith("blog read ")) {
      return commandsByName.get("blog read");
    }

    return (
      commandsByName.get(normalisedCommand) ||
      easterEggs.find(
        ({ name }) =>
          normalisedCommand === name ||
          normalisedCommand.startsWith(`${name} `),
      )
    );
  }

  function isAvailable(command) {
    const definition = findDefinition(normalise(command));
    return Boolean(definition && definition.group !== "placeholder");
  }

  function createResponse(definition, normalisedCommand) {
    const { components, content } = portfolio;

    if (!definition) {
      return components.createMessage(content.terminal.unknownCommand);
    }

    if (definition.group === "placeholder") {
      return components.createMessage(
        `${normalisedCommand}${content.terminal.placeholderSuffix}`,
      );
    }

    if (definition.action === "theme") {
      const joke =
        definition.theme === "light"
          ? ` ${content.terminal.lightThemeJoke}`
          : "";

      return components.createMessage(
        `${content.terminal.themeSetPrefix}${definition.theme}.${joke}`,
      );
    }

    if (definition.message) {
      return components.createMessage(definition.message);
    }

    const renderer = responseRenderers[definition.response];

    if (!renderer) {
      throw new Error(`No response renderer for "${definition.name}".`);
    }

    return renderer();
  }

  function dispatch(command) {
    const normalisedCommand = normalise(command);
    const definition = findDefinition(normalisedCommand);

    if (definition?.action === "blogIndex") {
      return Object.freeze({
        type: "output",
        response: portfolio.blog.showIndex(),
      });
    }

    if (definition?.action === "blogRead") {
      const argument = normalisedCommand
        .slice("blog read".length)
        .trim();

      return Object.freeze({
        type: "output",
        response: portfolio.blog.readPost(argument),
      });
    }

    if (definition?.action === "clear") {
      return Object.freeze({ type: "clear" });
    }

    if (definition?.action === "openPdf") {
      return Object.freeze({
        type: "open",
        href: portfolio.content.cv.pdf.href,
        response: portfolio.components.createMessage(
          portfolio.content.cv.pdf.opened,
        ),
      });
    }

    if (definition?.action === "readAloud") {
      const reading =
        definition.reading === "about"
          ? {
              text: portfolio.content.about.paragraphs.join(" "),
              started: portfolio.content.about.readingStarted,
            }
          : portfolio.content.cv.reading;

      return Object.freeze({
        type: "speech",
        text: reading.text,
        response: portfolio.components.createMessage(reading.started),
      });
    }

    if (definition?.action === "theme") {
      return Object.freeze({
        type: "theme",
        theme: definition.theme,
        response: createResponse(definition, normalisedCommand),
      });
    }

    return Object.freeze({
      type: "output",
      response: createResponse(definition, normalisedCommand),
    });
  }

  portfolio.commands = Object.freeze({
    dispatch,
    isAvailable,
  });
})(globalThis.Portfolio || (globalThis.Portfolio = {}));
