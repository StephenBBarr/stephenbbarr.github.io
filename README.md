# Stephen Barr's portfolio

Four main pages with ordinary links: About, CV, Blog and Contact. An
accessibility statement is linked from every footer.
The portfolio uses system fonts, a still portrait, and a light appearance with
a remembered dark option. About and CV offer optional read-aloud controls.

## Run locally

```sh
npm start
```

Open http://127.0.0.1:8000/. This builds the HTML and serves it with Python 3.
Node.js and Python 3 are required. Building and serving need no npm dependencies.
Stop the server with Ctrl+C. Rebuild after editing source files, then refresh.

To enable the local blog, start Docker Desktop and run this in `../gemini-lab`:

```sh
docker compose up -d
```

Use the exact portfolio address above. `localhost`, another port, or a file URL
will not enable the local blog connection.

## Source

| File | Purpose |
| --- | --- |
| `scripts/content.cjs` | Professional content, navigation and speech text. Selected projects remain in the CV. |
| `scripts/pages.cjs` | Small HTML templates that escape content as text. |
| `scripts/build.cjs` | Generates six HTML pages, including a 404 page, metadata and an optional public-files distribution using Node's built-in modules. |
| `scripts/check-release.cjs` | Verifies the real public bridge, each dated post and browser-origin permissions before release. |
| `styles/site.css` | All layout, appearance, responsive and print styles. |
| `scripts/theme.js` | Applies the saved appearance before the page paints. |
| `scripts/actions.js` | Read-aloud controls on About and CV, including Stop and cleanup. |
| `scripts/site.js` | Appearance button, blog visibility and blog query handling. |
| `scripts/config.js` | Local and public blog settings, shared by the build and browser. |
| `scripts/blog.js` | Bridge requests, index and article display, errors and retries. |
| `scripts/gemtext.js` | Safe formatting of Gemini text and links. |

Do not edit generated HTML, `robots.txt` or `sitemap.xml`. Run `npm run build` after source
changes. Publish the source and generated HTML together. Asset links contain
content versions so browsers load changed scripts and styles.

Visitors receive the generated content directly. The content model and page
templates run only during the build. Blog scripts load only on Blog; speech
loads only on About and CV. All pages use one stylesheet. About, CV,
photo, PDF, navigation and contact links work without JavaScript.

The previous command interface is preserved at
`../archived/command-view-2026-09-05/`. The current build does not read it.

## Blog

Posts live in the Gemini capsule. The portfolio requests plain text from the
bridge at `http://127.0.0.1:5080/`, which reads the capsule in Docker. The web
site does not maintain another copy of the posts.

- `/blog/` requests `/blog/index` and shows the capsule's index with dated links.
- `/blog/?post=post-name` requests `/blog/posts/post-name` directly.
- Every page load and retry requests fresh content; there is no client index cache.
- Failed requests show a retry control. Keyboard focus and a lasting status
  area make retries usable without a mouse.
- Requests have a timeout and omit credentials and redirects. Post names,
  returned media types and links are checked before use.
- Links to this capsule's posts open in the portfolio. Other Gemini links are
  labelled for a Gemini browser. Unsupported links remain text.

Add posts in `../gemini-lab/content/blog/posts/` as `.gmi` files. Keep
`../gemini-lab/content/blog/index.gmi` in newest-first order, with entries like:

```text
=> posts/my-post.gmi 2026-09-03 My post title
```

Use real YYYY-MM-DD dates. Post names use lowercase letters, numbers and single
hyphens, up to 80 characters. Updating mounted content takes effect on refresh;
it does not require rebuilding the portfolio or bridge.

Public blog hosting is still unconfigured. The production profile in
`scripts/config.js` has `enabled: false` and blank service addresses. Public
navigation hides Blog, and a direct visit explains it has not been published.
Follow `../gemini-lab/docs/deployment.md` to set up and verify public services,
then configure the HTTPS bridge, Gemini capsule and permitted portfolio origin,
enable the profile, and rebuild. Public pages cannot fall back to local services.

## Publish to GitHub Pages

See [the publishing review](PUBLISHING-REVIEW.md) for checked behavior and the
remaining public-hosting dependency.

The live site is `https://stephenbbarr.github.io/`. Its existing publication
history uses the `main` branch. The root `.nojekyll` file tells GitHub to serve
the generated files directly; the Node build runs on this Mac before publishing.
The step-by-step server launch guide is
[`../gemini-lab/docs/one-hour-launch.md`](../gemini-lab/docs/one-hour-launch.md).

After the public capsule, bridge, HTTPS certificate and browser access checks
pass, update only the production profile in `scripts/config.js`:

```js
enabled: true,
portfolioOrigins: Object.freeze([
  "https://stephenbbarr.github.io",
]),
bridgeBase: "https://bridge.stoathoughts.com/",
capsuleIndex: "gemini://gemini.stoathoughts.com/blog/",
```

Keep the local profile unchanged. Then run:

```sh
npm run build
npm run prepare:release
git status --short
```

`prepare:release` runs the tests, checks generated files and makes live HTTPS
requests to the production bridge for the index and every dated article. It
checks the exact allowed origins and response headers, and rejects CORS access
for an unrelated site. It then builds `dist/` containing only public pages and
assets. Disabled public settings, broken posts or failed public checks stop the
command. A local blog success cannot satisfy this release check.

For an offline preview, use `npm run build:dist`; this does not establish public
readiness. `dist/` is ignored by Git and rebuilt from an explicit file list, so
test files, documentation, Node dependencies and build sources cannot enter it.
The existing branch-based GitHub Pages setup serves the reviewed root files;
the distribution is also available for hosts that accept a static directory.

Review the pending portfolio changes, then commit the source, generated pages,
assets and `.nojekyll` together and push `main` to `origin`. Git authentication
on this Mac passed a push dry run on 8 September 2026. No new GitHub tool is
needed for that step. Wait for the repository's **Actions** page to show a
successful **pages build and deployment** run for the new commit.

If publication settings need correcting, open the repository's **Settings →
Pages** and choose **Deploy from a branch**, **main**, **/(root)**, then **Save**.
Leave **Custom domain** empty for the `github.io` address and keep **Enforce
HTTPS** enabled. See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Check the public About, CV, Contact and Accessibility pages, the PDF download,
then `/blog/` and a direct article such as `/blog/?post=testing-the-bridge`.
Reload the article to confirm it still works without first visiting the index.
The bridge's own `/` address returning 404 is expected: its public routes are
`/blog/index` and `/blog/posts/post-name`.

Check an unknown website address too: GitHub Pages should return the custom
`404.html` with a link home. Search metadata uses `siteOrigin` in
`scripts/content.cjs`; update it alongside the permitted origins if the website
domain changes. The sitemap includes Blog only when its production profile is
ready. Blog articles still depend on JavaScript; search and social clients that
do not execute it receive the generic blog metadata.

## Checks

Install test dependencies once, then run:

```sh
npm ci
npm test
npm run check:generated
```

LinkeDOM is used only in tests. Checks cover static content, asset links,
heading structure, safe templates, script loading, themes, speech, bridge
requests, Gemtext, configuration, retries and focus. Browser checks also cover
the real Docker blog, error recovery, direct article reloads, both appearances,
and enlarged text at narrow phone widths. See [the accessibility review](ACCESSIBILITY-REVIEW.md)
for results and remaining manual checks. Full screen-reader, PDF certification,
and public hosting verification remain separate work.

## Accessibility and the CV PDF

The site targets WCAG 2.2 AA with stronger text contrast, focus visibility and
standalone control sizes. It does not yet claim full conformance. The public
statement at `/accessibility/` describes features, known limits and how to report
a problem. Update its review date and this review record after meaningful checks.

The downloadable CV uses tagged headings, lists and a link, document language,
bookmarks, structural reading/tab order and embedded fonts. Its 11pt body text
spans two pages. The HTML CV remains available. To regenerate the PDF, run
`../scripts/build_public_cv_pdf.py` with Python and the `reportlab`, `pypdf` and
`pdfplumber` packages. It validates text and tag order, then updates both
`../output/pdf/stephen-barr-public-cv.pdf` and `assets/Stephen-Barr-CV.pdf`.
Render and visually check both pages after changes. Tagged output alone is not
proof of PDF/UA conformance or successful assistive-technology use.
