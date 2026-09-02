(function initialiseBlogConfiguration(portfolio) {
  "use strict";

  const localOrigin = "http://127.0.0.1:8000";
  const profiles = Object.freeze({
    local: Object.freeze({
      enabled: true,
      portfolioOrigins: Object.freeze([localOrigin]),
      bridgeBase: "http://127.0.0.1:5080/",
      capsuleIndex: "gemini://localhost/blog/",
    }),
    production: Object.freeze({
      // Enable only after the public bridge and capsule have been verified.
      enabled: false,
      portfolioOrigins: Object.freeze([
        "https://stephenbbarr.github.io",
      ]),
      bridgeBase: "",
      capsuleIndex: "",
    }),
  });

  function isPublicDnsHost(hostname) {
    const host = hostname.toLowerCase();
    const labels = host.split(".");
    const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    const localSuffixes = ["localhost", "local", "localdomain", "internal", "home.arpa"];

    // Require DNS names rather than trying to enumerate the many URL spellings
    // of IP addresses (shortened/octal IPv4, mapped IPv6 and so on).
    return (
      host.length <= 253 &&
      labels.length >= 2 &&
      labels.every((label) => labelPattern.test(label)) &&
      !/^\d+$/.test(labels.at(-1)) &&
      !localSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    );
  }

  function address(value, name) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${name} is missing.`);
    }

    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be an absolute URL.`);
    }

    if (!url.hostname) {
      throw new Error(`${name} must include a hostname.`);
    }

    if (url.username || url.password || url.search || url.hash) {
      throw new Error(`${name} cannot contain credentials, a query or a fragment.`);
    }

    return url;
  }

  function resolve(origin, settings = profiles) {
    const unavailable = Object.freeze({
      ready: false,
      error: "The blog is not configured for this address yet.",
    });
    const name = origin === localOrigin ? "local" : "production";
    const profile = settings?.[name];

    if (!profile || profile.enabled === false) return unavailable;

    try {
      if (profile.enabled !== true) {
        throw new Error("enabled must be true or false.");
      }

      if (
        !Array.isArray(profile.portfolioOrigins) ||
        !profile.portfolioOrigins.length
      ) {
        throw new Error("portfolioOrigins must list the permitted page origins.");
      }

      for (const allowed of profile.portfolioOrigins) {
        const url = address(allowed, "A portfolio origin");

        if (url.origin !== allowed) {
          throw new Error("Portfolio origins must not include a path or trailing slash.");
        }

        if (
          name === "production" &&
          (url.protocol !== "https:" || !isPublicDnsHost(url.hostname))
        ) {
          throw new Error("Public portfolio origins must use HTTPS and a public DNS hostname, not an IP address.");
        }
      }

      if (!profile.portfolioOrigins.includes(origin)) return unavailable;

      const bridge = address(profile.bridgeBase, "bridgeBase");
      const capsule = address(profile.capsuleIndex, "capsuleIndex");

      if (!bridge.pathname.endsWith("/")) {
        throw new Error("bridgeBase must end with a slash.");
      }

      if (capsule.protocol !== "gemini:" || capsule.pathname !== "/blog/") {
        throw new Error("capsuleIndex must be a gemini:// address ending in /blog/.");
      }

      if (name === "local") {
        if (
          bridge.href !== "http://127.0.0.1:5080/" ||
          capsule.href !== "gemini://localhost/blog/"
        ) {
          throw new Error("The local profile must use the documented local bridge and capsule.");
        }
      } else if (
        bridge.protocol !== "https:" ||
        !isPublicDnsHost(bridge.hostname) ||
        !isPublicDnsHost(capsule.hostname)
      ) {
        throw new Error("The public bridge must use HTTPS; public endpoints must use DNS hostnames, not IP addresses or local-only names.");
      }

      return Object.freeze({
        ready: true,
        profile: name,
        bridgeBase: bridge.href,
        capsuleIndex: capsule.href,
      });
    } catch (error) {
      return Object.freeze({
        ready: false,
        error: `The blog configuration is invalid: ${error.message}`,
      });
    }
  }

  portfolio.blogConfiguration = Object.freeze({ profiles, resolve });
})(globalThis.Portfolio);
