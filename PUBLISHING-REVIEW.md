# Publishing and security review — 8 September 2026

The portfolio and its public blog were launched on 8 September 2026. The public
profile uses `https://bridge.stoathoughts.com/` and
`gemini://gemini.stoathoughts.com/blog/`. GitHub Pages serves the `main` branch
root at `https://stephenbbarr.github.io/`, with HTTPS enforced.

## Security changes prepared after launch

- Added a restrictive Content Security Policy to every generated page. Public
  pages allow browser requests only to the public bridge. The local preview is
  built separately in `dist/` and allows only the local bridge. Neither policy
  permits inline/evaluated scripts, forms, embedded documents or base changes.
- Fixed release checks to ignore dated example links inside Gemtext fences.
  An index containing only fenced examples cannot count as published posts.
- Added a `Portfolio checks` GitHub workflow covering tests, generated files,
  dependency vulnerabilities and the public distribution build. Official
  actions are pinned to full commit hashes and run with read-only permissions.
- Added monthly Dependabot checks for npm and GitHub Actions. GitHub dependency
  vulnerability alerts and automatic security-update pull requests are enabled;
  automatic merging is not enabled by this work.
- Confirmed GitHub account two-factor authentication is enabled. Secret
  scanning and secret push protection were already enabled for this repository.

## Verification

| Check | Result |
| --- | --- |
| Automated tests after changes | 116 passed, including fenced-link regressions and production/local CSP boundaries. |
| Generated files | Match current source after rebuilding. |
| Current dependency audit | Zero reported vulnerabilities; dependencies are used only for tests. |
| Rendering review | Gemtext remains text inserted through DOM APIs; unsafe protocols and credential-bearing links are rejected. Nine extra malicious-input cases produced no active injected markup. |
| CSP browser checks | Isolated Chromium tests passed for production and local-preview policies: core pages, remembered theme and direct blog reload worked without unexpected errors; injected inline scripts and foreign requests were blocked. These used local response fixtures, not the live bridge. |
| Fetch boundaries | Requests omit credentials, reject redirects, check plain-text responses and use a timeout. Post names are validated before requests. |
| GitHub Pages | Authenticated settings confirm HTTPS enforced, no custom domain, main/root source and built status at the time of review. |
| Earlier launch checks | Public index and both articles, direct article reload, HTTPS, CV download and restricted server ports passed at launch. |
| Earlier accessibility checks | 24 axe-core scans passed across six routes/states, two appearances and desktop/narrow enlarged-text layouts. See the accessibility review for scope. |

The CSP and new workflow changes remain pending publication until their commit
is pushed and GitHub finishes deployment. The first workflow run must pass
before its check is made mandatory on `main`. Recheck live pages and the blog
after deployment; local tests do not substitute for that step.

## Publishing and remaining limits

Run `npm run build`, then `npm run prepare:release` before publishing. The latter
checks the public HTTPS bridge, every dated article and exact allowed browser
origins before creating the production distribution. GitHub checks intentionally
do not depend on the personal server being online.

GitHub Pages serves committed root files. The allowlisted `dist/` build is also
available for another static host; it excludes source templates, tests, review
documents and dependencies. This repository contains only public portfolio
material and must never contain server credentials or private backups.

The HTML-carried CSP cannot set directives that require response headers, such
as `frame-ancestors`. No claim is made that a meta policy provides them.
No runtime third-party scripts, analytics, login forms or cookies are introduced.

The [accessibility review](ACCESSIBILITY-REVIEW.md) records outstanding human
screen-reader, actual-device and PDF certification checks. Full WCAG or PDF/UA
conformance is not claimed. Blog articles require JavaScript; clients that do
not execute it receive generic blog metadata. The initial posts are labelled as
learning notes from the local prototype.
