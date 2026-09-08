(function initialiseGemtext(portfolio) {
  "use strict";

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function postName(value) {
    return typeof value === "string" && value.length <= 80 && slugPattern.test(value);
  }

  function webAddress(slug) {
    return postName(slug) ? `/blog/?post=${slug}` : "/blog/";
  }

  function render(text, {
    renderLink,
    baseUrl,
    capsuleIndex,
    titleFallback = "Blog post",
  } = {}) {
    const article = document.createElement("article");
    article.className = "blog-post";
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    // A final newline ends the preceding line, not an additional blank line.
    if (lines.at(-1) === "") lines.pop();

    let list = null;
    let preLines = null;
    let preLabel = "";
    let titleLine = -1;
    let hasSectionHeading = false;

    function appendBlock(tag, content, className = "") {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = content;
      article.append(node);
      return node;
    }

    let fenced = false;
    for (const [number, line] of lines.entries()) {
      if (line.startsWith("```")) fenced = !fenced;
      if (fenced) continue;
      const heading = /^#(?!#)[ \t]*(.+)$/.exec(line);
      if (heading?.[1].trim()) {
        titleLine = number;
        appendBlock("h1", heading[1].trim());
        break;
      }
    }
    if (titleLine === -1) appendBlock("h1", titleFallback);

    function finishPreformatted() {
      const pre = appendBlock("pre", preLines.join("\n"));
      pre.tabIndex = 0;
      pre.setAttribute("role", "region");
      pre.setAttribute("aria-label", preLabel || "Preformatted text");
      preLines = null;
    }

    function appendLink(line) {
      const match = /^=>[ \t]*(\S+)(?:[ \t]+(.*))?$/.exec(line);
      if (!match) return appendBlock("p", line, "gemtext-link");
      const [, target, rawLabel] = match;
      let address;
      try {
        address = new URL(target, baseUrl || capsuleIndex);
      } catch {
        return appendBlock("p", line, "gemtext-link");
      }
      if (address.username || address.password) {
        return appendBlock("p", line, "gemtext-link");
      }

      let href = address.href;
      let suffix = "";
      if (address.protocol === "gemini:") {
        let localAddress = null;
        if (capsuleIndex) {
          const capsule = new URL(capsuleIndex);
          const sameCapsule = address.hostname.toLowerCase() === capsule.hostname.toLowerCase()
            && (address.port || "1965") === (capsule.port || "1965")
            && !address.search && !address.hash;
          if (sameCapsule) {
            const slug = /^\/blog\/posts\/([^/]+)\.gmi$/.exec(address.pathname)?.[1];
            if (postName(slug)) localAddress = webAddress(slug);
            if (["/blog/", "/blog/index.gmi"].includes(address.pathname)) {
              localAddress = webAddress(null);
            }
          }
        }
        if (localAddress) href = localAddress;
        else suffix = " (Gemini browser)";
      } else if (!["http:", "https:", "mailto:"].includes(address.protocol)) {
        return appendBlock("p", line, "gemtext-link");
      }

      const paragraph = appendBlock("p", "", "gemtext-link");
      const link = document.createElement("a");
      link.setAttribute("href", href);
      link.textContent = (rawLabel?.trim() || target) + suffix;
      paragraph.append(link);
      return paragraph;
    }

    for (const [lineNumber, line] of lines.entries()) {
      if (line.startsWith("```")) {
        list = null;
        if (preLines === null) {
          preLines = [];
          preLabel = line.slice(3).trim();
        } else finishPreformatted();
        continue;
      }
      if (preLines !== null) {
        preLines.push(line);
        continue;
      }
      if (lineNumber === titleLine) continue;
      if (line.startsWith("* ")) {
        if (list === null) list = appendBlock("ul", "");
        const item = document.createElement("li");
        item.textContent = line.slice(2);
        list.append(item);
        continue;
      }
      list = null;
      if (line.trim() === "") {
        continue;
      }
      if (line.startsWith("=>")) {
        const customLink = renderLink?.(line);
        if (customLink) article.append(customLink);
        else appendLink(line);
        continue;
      }
      const heading = /^(#{1,3})[ \t]*(.*)$/.exec(line);
      if (heading?.[2].trim()) {
        // An orphan ### starts a section until a parent section is present.
        // Repeated ### headings retain the same depth, without skipping h2.
        if (heading[1].length < 3) hasSectionHeading = true;
        const level = heading[1].length === 3 && hasSectionHeading ? 3 : 2;
        appendBlock(`h${level}`, heading[2].trim());
        continue;
      }
      if (line.startsWith(">")) {
        appendBlock("blockquote", line.slice(1).replace(/^[ \t]+/, ""));
        continue;
      }
      appendBlock("p", line);
    }
    if (preLines !== null) finishPreformatted();
    return article;
  }

  portfolio.gemtext = Object.freeze({ render, postName, webAddress });
})(globalThis.Portfolio);
