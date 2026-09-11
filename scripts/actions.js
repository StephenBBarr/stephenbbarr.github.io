(function initialiseSpeech() {
  "use strict";

  let active = null;
  const unsupported = "Text-to-speech is not available in this browser.";

  function isSupported() {
    return "speechSynthesis" in window
      && typeof window.SpeechSynthesisUtterance === "function";
  }

  function stop({ announce = true, refocus = false } = {}) {
    if (!active) {
      return;
    }
    const reading = active;
    active = null;

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Clean up controls even if speech fails.
    }
    reading.stopButton.remove();
    if (announce) {
      reading.response.textContent = "Reading stopped.";
    }
    if (refocus) {
      reading.focusTarget?.focus({ preventScroll: true });
    }
  }

  function start(text, response, { focusTarget } = {}) {
    if (!isSupported()) {
      return false;
    }
    stop({ announce: active?.response !== response });

    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const stopButton = createStopButton();
      const reading = { utterance, stopButton, response, focusTarget };
      active = reading;

      stopButton.addEventListener("click", () => {
        if (active === reading) {
          stop({ refocus: true });
        }
      });
      utterance.lang = document.documentElement.lang || "en-GB";
      utterance.rate = 0.95;
      utterance.addEventListener("end", () => finish(reading, false));
      utterance.addEventListener("error", () => finish(reading, true));

      // Keep controls outside the atomic live region, which only announces
      // reading status. The stop button follows Read aloud in keyboard order.
      response.before(stopButton);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      active?.stopButton.remove();
      active = null;
      return false;
    }
  }

  function finish(reading, failed) {
    if (active !== reading) {
      return;
    }
    const shouldFocus = document.activeElement === reading.stopButton;
    active = null;
    reading.stopButton.remove();
    reading.response.textContent = failed ? unsupported : "";
    if (shouldFocus) {
      reading.focusTarget?.focus({ preventScroll: true });
    }
  }

  function createStopButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button speech-stop";
    button.textContent = "Stop";
    button.setAttribute("aria-label", "Stop reading aloud");
    return button;
  }

  function initialiseReadingButton(button) {
    button.hidden = !isSupported();
    button.addEventListener("click", () => {
      const status = button.parentElement.querySelector("[data-speech-status]");
      status.textContent = button.dataset.readingStarted;
      const started = start(button.dataset.readingText, status, { focusTarget: button });
      if (!started) {
        status.textContent = unsupported;
      }
    });
  }

  document.querySelectorAll("[data-reading]").forEach(initialiseReadingButton);

  window.addEventListener("pagehide", () => {
    const response = active?.response;
    stop({ announce: false });
    if (response) {
      response.textContent = "";
    }
  });
})();
