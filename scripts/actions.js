(function initialiseSpeech() {
  "use strict";

  let active = null;
  const unsupported = "Text-to-speech is not available in this browser.";
  const supported = () => "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

  function stop({ announce = true, refocus = false } = {}) {
    if (!active) return;
    const reading = active;
    active = null;
    try { window.speechSynthesis.cancel(); } catch { /* Clean up controls even if speech fails. */ }
    reading.stopButton.remove();
    if (announce) reading.response.textContent = "Reading stopped.";
    if (refocus) reading.focusTarget?.focus({ preventScroll: true });
  }

  function start(text, response, { focusTarget } = {}) {
    if (!supported()) return false;
    stop({ announce: active?.response !== response });
    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const stopButton = document.createElement("button");
      stopButton.type = "button";
      stopButton.className = "text-button speech-stop";
      stopButton.textContent = "Stop";
      stopButton.setAttribute("aria-label", "Stop reading aloud");
      const reading = { utterance, stopButton, response, focusTarget };
      active = reading;
      stopButton.addEventListener("click", () => { if (active === reading) stop({ refocus: true }); });
      utterance.lang = document.documentElement.lang || "en-GB";
      utterance.rate = 0.95;
      function finish(failed) {
        if (active !== reading) return;
        const shouldFocus = document.activeElement === stopButton;
        active = null;
        stopButton.remove();
        response.textContent = failed ? unsupported : "";
        if (shouldFocus) focusTarget?.focus({ preventScroll: true });
      }
      utterance.addEventListener("end", () => finish(false));
      utterance.addEventListener("error", () => finish(true));
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

  document.querySelectorAll("[data-reading]").forEach((button) => {
    button.hidden = !supported();
    button.addEventListener("click", () => {
      const status = button.parentElement.querySelector("[data-speech-status]");
      status.textContent = button.dataset.readingStarted;
      if (!start(button.dataset.readingText, status, { focusTarget: button })) status.textContent = unsupported;
    });
  });

  window.addEventListener("pagehide", () => {
    const response = active?.response;
    stop({ announce: false });
    if (response) response.textContent = "";
  });
})();
