(function initialiseGemtext() {
  "use strict";

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function postName(value) {
    return typeof value === "string" && value.length <= 80 && slugPattern.test(value);
  }

  function webAddress(slug) {
    return postName(slug) ? `/blog/${slug}/` : "/blog/";
  }

  function render(text, {
    document = globalThis.document,
    renderLink,
    baseUrl,
    capsuleIndex,
    publishedSlugs,
    titleFallback = "Blog post",
  } = {}) {
    const article = document.createElement("article");
    article.className = "blog-post";
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    // A final newline ends the preceding line, not an additional blank line.
    if (lines.at(-1) === "") {
      lines.pop();
    }

    const title = findTitle(lines);
    appendBlock(article, "h1", title ? title.text : titleFallback);

    let list = null;
    let preformattedLines = null;
    let preformattedLabel = "";
    let hasSectionHeading = false;

    // Read each line in order so fences, lists and headings keep their context.
    for (const [lineNumber, line] of lines.entries()) {
      if (line.startsWith("```")) {
        list = null;
        if (preformattedLines === null) {
          preformattedLines = [];
          preformattedLabel = line.slice(3).trim();
        } else {
          appendPreformatted(article, preformattedLines, preformattedLabel);
          preformattedLines = null;
        }
        continue;
      }
      if (preformattedLines !== null) {
        preformattedLines.push(line);
        continue;
      }
      if (lineNumber === title?.lineNumber) {
        continue;
      }

      if (line.startsWith("* ")) {
        if (list === null) {
          list = appendBlock(article, "ul", "");
        }
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
        if (customLink) {
          article.append(customLink);
        } else {
          appendLink(article, line, baseUrl, capsuleIndex, publishedSlugs);
        }
        continue;
      }

      const heading = parseHeading(line);
      if (heading) {
        // An orphan ### starts a section until a parent section is present.
        // Repeated ### headings retain the same depth, without skipping h2.
        if (heading.depth < 3) {
          hasSectionHeading = true;
        }
        const level = heading.depth === 3 && hasSectionHeading ? 3 : 2;
        appendBlock(article, `h${level}`, heading.text);
        continue;
      }

      if (line.startsWith(">")) {
        appendBlock(article, "blockquote", line.slice(1).replace(/^[ \t]+/, ""));
        continue;
      }
      appendBlock(article, "p", line);
    }

    if (preformattedLines !== null) {
      appendPreformatted(article, preformattedLines, preformattedLabel);
    }
    return article;
  }

  function findTitle(lines) {
    let insideFence = false;
    for (const [lineNumber, line] of lines.entries()) {
      if (line.startsWith("```")) {
        insideFence = !insideFence;
      }
      if (insideFence) {
        continue;
      }

      const heading = /^#(?!#)[ \t]*(.+)$/.exec(line);
      if (heading?.[1].trim()) {
        return { lineNumber, text: heading[1].trim() };
      }
    }
    return null;
  }

  function parseHeading(line) {
    const heading = /^(#{1,3})[ \t]*(.*)$/.exec(line);
    if (!heading?.[2].trim()) {
      return null;
    }

    return { depth: heading[1].length, text: heading[2].trim() };
  }

  function appendBlock(article, tag, text, className = "") {
    const node = article.ownerDocument.createElement(tag);
    node.className = className;
    node.textContent = text;
    article.append(node);
    return node;
  }

  function appendPreformatted(article, lines, label) {
    const preformatted = appendBlock(article, "pre", lines.join("\n"));
    preformatted.tabIndex = 0;
    preformatted.setAttribute("role", "region");
    preformatted.setAttribute("aria-label", label || "Preformatted text");
  }

  function appendLink(article, line, baseUrl, capsuleIndex, publishedSlugs) {
    const parsedLink = parseLink(line, baseUrl || capsuleIndex);
    if (!parsedLink) {
      return appendBlock(article, "p", line, "gemtext-link");
    }

    const destination = mapLinkAddress(parsedLink.address, capsuleIndex, publishedSlugs);
    if (!destination) {
      return appendBlock(article, "p", line, "gemtext-link");
    }

    const paragraph = appendBlock(article, "p", "", "gemtext-link");
    const link = article.ownerDocument.createElement("a");
    link.setAttribute("href", destination.href);
    link.textContent = (parsedLink.rawLabel?.trim() || parsedLink.target) + destination.suffix;
    paragraph.append(link);
    return paragraph;
  }

  function parseLink(line, baseUrl) {
    const match = /^=>[ \t]*(\S+)(?:[ \t]+(.*))?$/.exec(line);
    if (!match) {
      return null;
    }

    const [, target, rawLabel] = match;
    let address;
    try {
      address = new URL(target, baseUrl);
    } catch {
      return null;
    }
    if (address.username || address.password) {
      return null;
    }

    return { address, target, rawLabel };
  }

  function mapLinkAddress(address, capsuleIndex, publishedSlugs) {
    if (address.protocol === "gemini:") {
      const localAddress = mapCapsuleAddress(address, capsuleIndex, publishedSlugs);
      if (localAddress) {
        return { href: localAddress, suffix: "" };
      }
      return { href: address.href, suffix: " (Gemini browser)" };
    }

    if (["http:", "https:", "mailto:"].includes(address.protocol)) {
      return { href: address.href, suffix: "" };
    }
    return null;
  }

  function mapCapsuleAddress(address, capsuleIndex, publishedSlugs) {
    if (!capsuleIndex) {
      return null;
    }

    const capsule = new URL(capsuleIndex);
    const sameCapsule = address.hostname.toLowerCase() === capsule.hostname.toLowerCase()
      && (address.port || "1965") === (capsule.port || "1965")
      && !address.search && !address.hash;
    if (!sameCapsule) {
      return null;
    }

    const slug = /^\/blog\/posts\/([^/]+)\.gmi$/.exec(address.pathname)?.[1];
    if (postName(slug) && (!publishedSlugs || publishedSlugs.has(slug))) {
      return webAddress(slug);
    }
    if (["/blog/", "/blog/index.gmi"].includes(address.pathname)) {
      return webAddress(null);
    }
    return null;
  }


  const renderer = Object.freeze({ render, postName, webAddress });
  if (typeof module !== "undefined" && module.exports) {
    module.exports = renderer;
  } else {
    (globalThis.Portfolio ||= {}).gemtext = renderer;
  }
})();
