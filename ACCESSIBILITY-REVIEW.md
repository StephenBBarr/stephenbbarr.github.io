# Accessibility review

Reviewed 8 September 2026 against the local portfolio at
`http://127.0.0.1:8000/`, including the live Docker bridge and Gemini capsule.
The target is WCAG 2.2 AA with selected improvements from AAA. This is an
implementation and verification record, not a conformance declaration.

The later [publishing review](PUBLISHING-REVIEW.md) records the expanded
112-test suite and 24 additional browser scans of the packaged pages, including
the custom missing-page response and compact CV notice. The manual limitations
below still apply.

## Changes

- Both appearances use at least 7:1 contrast for body text, supporting text and
  links against the page and code-block backgrounds. Selected text also meets
  7:1. These ratios are calculated from the shipped CSS in automated tests.
- Keyboard focus uses a contrasting 3px outline. The skip link focuses the main
  content, and ordinary controls retain the natural keyboard order.
- Standalone navigation, action, blog and footer controls have at least 44 by
  44 CSS pixels of target area at the default text size. Links within sentences
  remain inline.
- Layouts wrap with enlarged text and spacing. Long code samples scroll inside
  a named, keyboard-focusable region. Forced-colour styles use system colours.
  The interface contains no animations.
- Speech status contains text only. Stop is a separate button; stopping speech
  restores focus to its starting control. The CV button explicitly says that
  it reads a summary.
- Successful blog retries move keyboard focus to visible content. Gemtext
  headings avoid empty headings and skipped levels. Bridge requests, error
  recovery and capsule links remain intact.
- Every footer links to the public accessibility statement. External LinkedIn
  links include an accessible warning when opening another tab.
- The CV PDF now has two pages of larger, left-aligned text, tagged headings,
  lists and a link, bookmarks, document language, embedded fonts and structural
  reading and tab order. Its approved source content is preserved.

## Verification completed

| Check | Result |
| --- | --- |
| `npm test` | 104 tests passed, including contrast, structure, keyboard focus, speech, blog requests and Gemtext. |
| `npm run check:generated` | All five generated pages match their sources. |
| axe-core 4.13.0 in the in-app browser | No violations or incomplete results in 18 final scans: nine pages/states in both appearances. Rules covered WCAG A/AA through 2.2 and axe best practices. |
| Narrow layout and text overrides | No page overflow or automated violations at 320 CSS pixels with 200% root text size, 1.5 line height, 0.12em letter spacing, 0.16em word spacing and 2em paragraph spacing. Both appearances were checked across the same pages/states. |
| Control measurements | Sampled visible standalone navigation, footer, speech, CV and blog controls measured at least 44 by 44 CSS pixels. |
| Keyboard operation | Skip to content, speech start/Stop/focus restoration, appearance switching and blog retry were operated using Tab and Return. Retry focused the visible blog article after a simulated initial network failure and successful real bridge response. |
| CV PDF | Both pages rendered and visually reviewed. Builder checks passed for source text preservation, visual and tag reading order, structure/parent trees, link annotation ownership, metadata and embedded fonts. Canonical and published PDFs are identical. |

The nine browser cases were About, CV, Contact, Accessibility, the live blog
index, a live article, a missing article, an invalid post name and a temporary
Gemtext fixture with a heading-level gap, lists, a quotation, a long address and
a long code sample. The temporary audit tools and fixtures are not shipped.
The narrow-layout checks exercise reflow and text overrides; they are not a
substitute for testing browser zoom and text settings on real devices.

## Remaining human checks

- Read all pages and dynamic blog/speech states with VoiceOver/Safari and
  NVDA/Firefox or Chrome. Check reading order, names, heading navigation,
  announcements and focus recovery with assistive technology enabled.
- Test browser zoom up to 400%, text-only resizing, Windows forced colours and
  mobile assistive technology on actual devices. The forced-colour stylesheet
  has been implemented but not exercised in a Windows session.
- Review the PDF in a screen reader and a dedicated PDF accessibility checker.
  Tagged output does not establish PDF/UA conformance; no certification is
  claimed.
- Include disabled users in a usability review. The current feedback channel
  depends on LinkedIn; an additional direct contact method would require an
  approved public address.

The static pages include their content without JavaScript; the blog requires
JavaScript and the bridge. Public blog hosting is still unconfigured. Repeat
the relevant checks when public services are configured or the content,
templates, styles, controls or PDF change, and update the public statement.

## References

- [WCAG 2.2 and conformance requirements](https://www.w3.org/TR/WCAG22/).
- [WAI: evaluating accessibility](https://www.w3.org/WAI/test-evaluate/): automated
  tools support evaluation but cannot establish accessibility on their own.
- [WCAG text-spacing guidance](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html).
