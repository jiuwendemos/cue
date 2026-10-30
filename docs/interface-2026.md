# Interface 2026

## The idea

A creative studio, not a productivity dashboard. The show is a poster before it is a table. The previz
is the canvas, the look rail is the palette, and the numbers are a margin note — present, legible and
never the first thing you see.

## Principles

1. **The work is visual first.** The poster, the previz, the moodboard and the palette carry the
   identity. Tables are tools, not the product.
2. **One accent, semantic colour.** Lime is the cue light. Red is safety, amber is budget/schedule,
   violet is rights. Colour is never the only signal.
3. **Type with a point of view.** Fraunces for the editorial voice; Inter for the desk; JetBrains Mono
   for records. No text below 11 px in product chrome.
4. **Quiet chrome, loud work.** The shell recedes: a slim rail, a glass topbar, a command palette.
5. **Evidence on demand.** Every number opens its source. The “why” is a drawer, not a tooltip.
6. **Human at the end.** The designer's signature is visible. The agent is labelled. Safety is never a
   switch.
7. **Three rooms.** Dark control room, light production office, high-contrast back-of-house. Designed
   together, not inverted.

## The surfaces

- **Poster home:** a magazine cover for the show, the setlist, the previz, the ticket, the desk and the
  moodboard.
- **Studio:** stage canvas, look rail, timeline, checks and the active look feature. Tabs for Stage,
  Concept, Looks, Video and Blocking.
- **Concept board:** mood, narrative, generated reference cards, rules, palette, setlist energy.
- **Cue sheet:** a technical score with a paper view, safety signatures, conflicts and missing assets.
- **Budget:** the look as a price, the look as a risk, and the approval.
- **Readiness:** the production office's daily desk. Risk board, brief, lifecycle, evidence, coverage.
- **Agent:** a question, an answer, citations, an inspectable trace and ranked proposals.
- **Settings:** theme, role, language, density, reduced motion, synthetic-demo notices, reset.
- **Glossary:** how to read the show, for a producer, a designer and a crew.

## Type and tokens

- Display: Fraunces Variable, 500, optical size set large.
- Body: Inter Variable, 13.5 px base, 1.5 line height.
- Mono: JetBrains Mono Variable, 11 px minimum, zero feature.
- Space: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Radius: 3 / 6 / 9 / 13.
- Motion: 180 ms, cubic-bezier(.2,.7,.2,1); reduced-motion respected.

## Accessibility

- Skip link, visible focus, keyboard paths, Escape on overlays.
- 44 px targets on touch, 32 px minimum on the desk.
- Status is a label plus a bar, never colour alone.
- High-contrast theme; reduced-motion mode; no text below 11 px.
- The stage piece is keyboard-operable: Space, R, Esc, 1/2, Y/N.

The self-audit is in the design system page. A WCAG 2.2 AA sign-off is a pilot task.

## Performance

- One reliable entry bundle: 548 kB raw / 161 kB gzip.
- No CDN, no external font, no analytics.
- Fonts are local WOFF2; the stage is SVG, not WebGL.
- The service worker caches the shell and hashed assets.
- Route-level code splitting was removed after a Suspense failure in this environment; the trade-off is
  documented in the roadmap. The bundle budget is tracked in CI.

## Anti-patterns

- A dark dashboard with a grid of identical cards.
- A permanent left panel that cannot be closed.
- 9 px labels and 28 px rows.
- An AI answer without a source.
- A “release” button without a name and a signature.
- A 3D canvas that hides the cue sheet.
- A phone version that is the desktop squeezed.
