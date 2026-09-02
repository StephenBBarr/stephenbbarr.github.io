# Stephen Barr

The source for Stephen Barr's personal portfolio.

A deliberately small, one-page terminal interface built with semantic HTML,
CSS and vanilla JavaScript. It has no framework, build process, external font
or third-party JavaScript dependencies, with dark and light themes.

## Structure

- `index.html` contains the first-paint page shell and terminal form.
- `favicon.svg` is the browser icon; `favicon.ico` is its 16/32/48px fallback.
- `scripts/content.js` contains the reusable portfolio and CV content model.
- `scripts/components.js` turns that content into semantic response views.
- `scripts/config.js` separates the local and public blog configuration.
- `scripts/gemtext.js` renders Gemtext using the portfolio's theme.
- `scripts/blog.js` fetches and caches the index and reads individual posts.
- `scripts/commands.js` is the single command catalogue used for dispatch and
  the generated `help` response.
- `script.js` owns terminal input, focus, history and scrolling behavior.
- `styles/base.css` owns theme colours, typography, links and focus styles.
- `styles/components.css` contains reusable content and layout patterns.
- `styles/terminal.css` contains the prompt, help tree and portrait effect.
- `tests/blog.test.cjs` checks blog behaviour and configuration with Node's
  built-in test runner and a small DOM stand-in.

## Styling

Keep new responses simple: use `stack` for vertical spacing, `row` for wrapping
inline content, and `prose` or `meta` for text colour. Stacks have compact and
spacious variants; rows can spread their contents apart.

Reuse the existing document, section heading, entry, list, notice and text-button
patterns before adding a new class. Headings, links and command text share their
defaults. Keep feature-specific rules only where the layout genuinely differs,
such as the CV's identity and education columns.

## Behaviour

The scripts are intentionally loaded in dependency order as classic scripts.
The local blog requires the exact origin below; opening `index.html` directly
or using `localhost` instead of `127.0.0.1` does not enable it.

The terminal keeps the 50 most recent submitted commands in local browser
storage. The up and down arrow keys browse that history, including returning to
any draft that was in the input before browsing.

The Gemini capsule is the source of the blog. The HTTP bridge fetches Gemtext
over Gemini; the browser displays that text using the site's theme. Links are
currently literal text, not clickable navigation.

`blog` displays the whole index page. `blog read <number>` loads the index
automatically if needed, then reads the selected post. Both commands share one
index request and keep the index in page memory. `clear` only removes terminal
output. Reload the page to refresh the index; each post read fetches its content
again. Failed requests can be retried without clearing anything.

### Index authoring contract

Keep the capsule's `content/blog/index.gmi` in newest-first order, adding new
post links above old ones. Supported entries look like:

```text
=> posts/my-post.gmi 2026-09-03 My post title
```

Dates must be valid `YYYY-MM-DD` dates. Slugs use lowercase letters, digits and
single hyphens, up to 80 characters; files live in `/blog/posts/` and end in
`.gmi`. Absolute links must use the configured capsule's Gemini host and port.
Queries, fragments, external links, duplicates and links inside preformatted
blocks do not become numbered posts.

Numbers count down through the source index, so the top/newest entry has the
highest number. The browser does not sort by date. Numbers are not permanent
IDs: removing or reordering entries may change their numbers on the next page
reload.

## Preview locally

Start Docker, then start the capsule and bridge from the adjacent lab directory:

```sh
cd ../gemini-lab
docker compose up -d --build
```

In a terminal in this portfolio directory, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then visit **http://127.0.0.1:8000/**. The local configuration uses the bridge
at `http://127.0.0.1:5080/` and the capsule index at
`gemini://localhost/blog/`. Public pages never fall back to these local addresses.

## Tests

With a current Node.js installation, run either command from this directory:

```sh
npm test
```

```sh
node --test tests/*.test.cjs
```

There are no npm dependencies to install. These tests run the actual scripts
against controlled HTTP responses and a DOM stand-in. They cover direct reads,
index rendering and caching, numbering, concurrent and failed requests, HTTP
429, timeouts, safe Gemtext rendering, and local/public configuration checks.
They do not replace live browser, mobile, screen-reader, TLS or CORS checks.

## Public activation — later

The `production` profile in `scripts/config.js` is deliberately disabled and
its endpoint addresses are blank. Until public hosting is ready, the rest of
the portfolio works normally and the blog reports that it is not configured
for that address. No public domain has been selected by this configuration.

After verifying the public capsule and HTTPS bridge, set these fields:

- `enabled`: change to `true` when ready to activate the public blog.
- `portfolioOrigins`: exact HTTPS origins permitted to run the blog, without
  paths or trailing slashes. `https://stephenbbarr.github.io` is already listed.
  Add a custom portfolio origin explicitly if one is introduced later.
- `bridgeBase`: the public HTTPS bridge base URL, ending in `/`.
- `capsuleIndex`: the public `gemini://` URL ending in `/blog/`.

Keep the local profile unchanged. Configuration comes only from this source
file, not URL parameters or browser storage. Invalid public settings fail
closed, including HTTP bridge URLs, loopback addresses, embedded credentials,
queries and fragments. This validation is not authentication: the public
bridge must enforce its own limits and CORS policy.

The bridge's allowed CORS origins must match the public portfolio origin(s).
Also verify its Gemini hostname, trusted certificate fingerprint and network
connection settings. Test from outside the local machine before publishing
the enabled frontend. Nothing in these files deploys or publishes automatically.
