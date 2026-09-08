# Publishing review — 8 September 2026

The portfolio code and generated pages have been reviewed and the local checks
pass. **The complete portfolio with its public blog is not ready to launch yet.**
The production bridge and capsule are still unconfigured. Publishing now would
hide Blog outside the documented local development address.

## Changes made

- Added a custom 404 page with ordinary navigation and a clear link home.
- Added page-specific descriptions, canonical addresses, social metadata,
  `robots.txt` and a sitemap. Successful article loads update the article title
  and canonical/social address to preserve each post's distinct URL.
- Added a clean `dist/` build that includes only generated pages and the required
  public assets. Development sources, tests, dependencies and review documents
  are excluded. The current GitHub Pages branch/root publishing path remains
  supported.
- Added `check:release` and `prepare:release`. A release must pass the tests and
  generated-file check, then retrieve the public index and every dated post
  through HTTPS with the expected content type, CORS and response headers.
  Unconfigured services, missing posts and unintended cross-origin access block
  the release. There is no automatic publish or deployment step.
- Retained the compact CV notice, two download links, accessible interaction
  controls and the existing bridge/Gemini architecture.

## Evidence

| Check | Result |
| --- | --- |
| Automated tests | 112 passed. Covers page content, escaping, structure, contrast, links, speech, themes, blog rendering/retries, metadata, packaging and release rejection cases. |
| Generated files | Match the source build. |
| Dependency audit | npm reported zero vulnerabilities, including test dependencies. No production npm dependencies. |
| Distribution browser audit | 24 axe-core 4.13.0 scans passed with zero violations or incomplete results: six routes/states, two appearances, at normal width and at 320 CSS pixels with 200% root text and WCAG spacing overrides. No page overflow or undersized sampled standalone controls. |
| HTTP preview | The five content routes returned 200. A missing route returned 404 with the custom template. PDF, sitemap and robots responses had the expected media types. The served PDF matched the reviewed asset byte for byte. |
| Live local blog | Docker capsule and bridge were running; eight local smoke checks passed for health, exact source content, post responses, invalid/missing posts, CORS and host restrictions. |
| Browser blog behavior | Both current articles loaded; direct reload, Back and Forward worked. Article metadata used its own public post address. |
| Public release check | Correctly blocked because production blog settings remain disabled/empty. |
| Public DNS | Lookups for `bridge.stoathoughts.com` and `gemini.stoathoughts.com` returned SERVFAIL. Neither public service could be verified. |

Temporary audit fixtures are removed from the final distribution. The local
server at `http://127.0.0.1:8000/` remains available. No source was committed or
pushed and no public service was started by this review.

## Remaining launch dependency

Complete the public server, DNS, capsule certificate and HTTPS bridge setup in
the [launch guide](../gemini-lab/docs/one-hour-launch.md). Then configure the
verified production addresses in `scripts/config.js` and run:

```sh
npm run build
npm run prepare:release
```

Both commands must pass before publishing the reviewed files. The local origin
always uses the local Docker stack, so a successful local preview does not prove
the public connection. Verify the public website again after GitHub Pages deploys.

## Declared limitations

The [accessibility review](ACCESSIBILITY-REVIEW.md) still records the outstanding
human screen-reader, actual-device and PDF certification checks. No full WCAG or
PDF/UA conformance is claimed. The blog remains JavaScript-dependent; clients
that do not run JavaScript receive the generic blog metadata. The two initial
posts are explicitly labelled as learning notes from the local prototype.
