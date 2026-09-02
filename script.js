(function initialiseTerminal(portfolio) {
  "use strict";

  const form = document.querySelector("#terminal-form");
  const input = document.querySelector("#terminal-command");
  const log = document.querySelector("#terminal-log");
  const main = document.querySelector("main");
  const prompt = form.querySelector("[aria-hidden]").textContent;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const historyStorageKey = "portfolio-command-history";
  const historyLimit = 50;
  const themes = Object.freeze({
    dark: "#1c1f1c",
    light: "#f1ede2",
  });
  let commandHistory = loadCommandHistory();
  let historyIndex = commandHistory.length;
  let draftCommand = "";
  let activeReading = null;

  function createUniqueHistory(commands) {
    const uniqueCommands = new Map();

    commands.forEach((command) => {
      if (typeof command !== "string") return;

      const value = command.trim();
      if (!value || !portfolio.commands.isAvailable(value)) return;

      const key = value.toLowerCase().replace(/\s+/g, " ");
      uniqueCommands.delete(key);
      uniqueCommands.set(key, value);
    });

    return Array.from(uniqueCommands.values()).slice(-historyLimit);
  }

  function loadCommandHistory() {
    try {
      const savedHistory = JSON.parse(localStorage.getItem(historyStorageKey));

      if (!Array.isArray(savedHistory)) return [];

      return createUniqueHistory(savedHistory);
    } catch {
      return [];
    }
  }

  function saveCommand(command) {
    commandHistory = createUniqueHistory([...commandHistory, command]);
    historyIndex = commandHistory.length;
    draftCommand = "";

    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(commandHistory));
    } catch {
      // History still works for this visit when storage is unavailable.
    }
  }

  function showHistoryCommand(index) {
    historyIndex = index;
    input.value =
      historyIndex === commandHistory.length
        ? draftCommand
        : commandHistory[historyIndex];
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function navigateHistory(direction) {
    if (!commandHistory.length) return;

    if (historyIndex === commandHistory.length) {
      draftCommand = input.value;
    }

    const nextIndex = Math.min(
      commandHistory.length,
      Math.max(0, historyIndex + direction),
    );
    showHistoryCommand(nextIndex);
  }

  function applyTheme(theme, persist = true) {
    document.documentElement.dataset.theme = theme;
    themeMeta.content = themes[theme];

    if (!persist) return;

    try {
      localStorage.setItem("portfolio-theme", theme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }

  function focusInput() {
    input.focus({ preventScroll: true });
  }

  function finishReading(reading) {
    if (activeReading !== reading) return;

    const shouldRefocus = document.activeElement === reading.stopButton;
    reading.stopButton.remove();
    activeReading = null;

    if (shouldRefocus) focusInput();
  }

  function stopReading(refocus = false) {
    if (!activeReading) return;

    const reading = activeReading;
    activeReading = null;
    reading.response.textContent = portfolio.content.terminal.speechStopped;

    try {
      window.speechSynthesis.cancel();
    } catch {
      // The stop control should still clean up if the speech engine fails.
    }

    if (refocus) focusInput();
  }

  function createStopReadingButton(reading) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.textContent = "[stop]";
    button.setAttribute("aria-label", "Stop reading aloud");
    button.addEventListener("click", () => {
      if (activeReading === reading) stopReading(true);
    });
    return button;
  }

  function readAloud(text, response) {
    if (
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    ) {
      return false;
    }

    try {
      stopReading();
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const reading = { response, stopButton: null, utterance };
      reading.stopButton = createStopReadingButton(reading);
      activeReading = reading;
      utterance.lang = document.documentElement.lang || "en-GB";
      utterance.rate = 0.95;
      utterance.addEventListener("end", () => {
        finishReading(reading);
      });
      utterance.addEventListener("error", () => {
        if (activeReading !== reading) return;

        const shouldRefocus = document.activeElement === reading.stopButton;
        activeReading = null;
        response.textContent = portfolio.content.terminal.speechUnsupported;

        if (shouldRefocus) focusInput();
      });
      response.append(reading.stopButton);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      activeReading?.stopButton.remove();
      activeReading = null;
      return false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const command = input.value.trim();
    if (!command) return;

    saveCommand(command);
    const result = portfolio.commands.dispatch(command);

    if (result.type === "clear") {
      stopReading();
      log.replaceChildren();
      input.value = "";
      focusInput();
      return;
    }

    if (result.type === "theme") {
      applyTheme(result.theme);
    }

    if (result.type === "open") {
      window.open(result.href, "_blank", "noopener,noreferrer");
    }

    if (result.type === "speech" && !readAloud(result.text, result.response)) {
      result.response.textContent = portfolio.content.terminal.speechUnsupported;
    }

    const entry = document.createElement("section");
    entry.className = "terminal-entry";
    entry.append(
      portfolio.components.createCommandEcho(prompt, command),
      result.response,
    );
    log.append(entry);

    input.value = "";
    focusInput();
    entry.querySelector(".command-echo").scrollIntoView({ block: "start" });
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      navigateHistory(event.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    form.requestSubmit();
  });

  main.addEventListener("click", (event) => {
    if (event.target === main) focusInput();
  });
  window.addEventListener("focus", focusInput);

  try {
    const savedTheme = localStorage.getItem("portfolio-theme");
    if (themes[savedTheme]) applyTheme(savedTheme, false);
  } catch {
    // Dark remains the default when storage is unavailable.
  }

  focusInput();
})(globalThis.Portfolio);
