(function initialiseGemtext(portfolio) {
  "use strict";

  function render(text, { renderLink } = {}) {
    const article = document.createElement("article");
    article.className = "blog-post";

    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    // A final newline ends the preceding line.
    // It does not create an additional blank line.
    if (lines.at(-1) === "") {
      lines.pop();
    }

    let list = null;
    let preLines = null;
    let preLabel = "";

    function appendBlock(tag, content, className = "") {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = content;
      article.append(node);
      return node;
    }

    function finishPreformatted() {
      const pre = appendBlock("pre", preLines.join("\n"));

      pre.tabIndex = 0;
      pre.setAttribute("role", "region");
      pre.setAttribute(
        "aria-label",
        preLabel || "Preformatted text",
      );

      preLines = null;
    }

    for (const [lineNumber, line] of lines.entries()) {
      if (line.startsWith("```")) {
        list = null;

        if (preLines === null) {
          preLines = [];
          preLabel = line.slice(3).trim();
        } else {
          finishPreformatted();
        }

        continue;
      }

      if (preLines !== null) {
        preLines.push(line);
        continue;
      }

      if (line.startsWith("* ")) {
        if (list === null) {
          list = appendBlock("ul", "");
        }

        const item = document.createElement("li");
        item.textContent = line.slice(2);
        list.append(item);
        continue;
      }

      list = null;

      if (line.trim() === "") {
        const blank = appendBlock(
          "div",
          "",
          "gemtext-blank",
        );

        blank.setAttribute("aria-hidden", "true");
        continue;
      }

      if (line.startsWith("=>")) {
        const customLink = renderLink?.(line, lineNumber);

        if (customLink) {
          article.append(customLink);
        } else {
          appendBlock("p", line, "gemtext-link");
        }
        continue;
      }

      const heading = /^(#{1,3})[ \t]*(.*)$/.exec(line);

      if (heading) {
        appendBlock(
          `h${heading[1].length + 1}`,
          heading[2],
        );
        continue;
      }

      if (line.startsWith(">")) {
        appendBlock(
          "blockquote",
          line.slice(1).replace(/^[ \t]+/, ""),
        );
        continue;
      }

      appendBlock("p", line);
    }

    if (preLines !== null) {
      finishPreformatted();
    }

    return article;
  }

  portfolio.gemtext = Object.freeze({
    render,
  });
})(globalThis.Portfolio);
