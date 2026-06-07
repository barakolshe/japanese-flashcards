# Design

## Theme

Light, calm, paper-like. A pure-white surface with deep-evergreen ink and brand color, evoking sumi ink on washi paper. The mood is a study desk at first light: quiet, legible, unhurried. Color strategy is **restrained** — tinted neutrals plus a deep green primary that carries the brand, with a single warm ochre accent used sparingly for emphasis and status.

## Color

OKLCH throughout. Defined as CSS custom properties in `web/src/app/globals.css`.

| Role | OKLCH | Use |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | Page background — pure white |
| `--surface` | `oklch(0.978 0.006 150)` | Cards, panels, upload dropzone fill |
| `--ink` | `oklch(0.24 0.022 152)` | Body and heading text (~13:1 on bg) |
| `--muted` | `oklch(0.46 0.018 152)` | Secondary text, captions (~4.8:1 on bg) |
| `--primary` | `oklch(0.37 0.10 142)` | Primary actions, brand marks, focus ring |
| `--primary-hover` | `oklch(0.32 0.10 142)` | Hover/active state for primary |
| `--accent` | `oklch(0.70 0.13 72)` | Warm ochre — sparing highlights, "ready" status |
| `--border` | `oklch(0.90 0.008 150)` | Hairline dividers, input borders |
| `--danger` | `oklch(0.52 0.16 28)` | Parse errors, destructive states |

Text on filled `--primary` and `--accent` is white (`--bg`), per the Helmholtz-Kohlrausch rule for saturated mid-luminance fills. Dark `--ink` text only on pale/neutral surfaces.

## Typography

- **Body / UI:** Geist Sans (already wired via `next/font` in `layout.tsx`).
- **Japanese:** a CJK-capable stack — `"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif`. Japanese is the hero: large scale, strong weight, generous line-height for kanji.
- **Mono:** Geist Mono, for CSV field names / code-like hints only.
- Scale via `clamp()`; hierarchy through size + weight contrast (≥1.25 ratio). Hero/display max ≤ 6rem. Display letter-spacing ≥ -0.03em. `text-wrap: balance` on headings.

## Components

- **Upload dropzone:** a single generous surface panel with a dashed `--border`, drag-and-drop plus a labelled file button. Hover/drag-over lifts the border to `--primary`. This is the empty-state hero of the app's first screen.
- **Buttons:** filled `--primary` with white text for the main action; quiet ghost/text buttons (ink, no fill) for secondary actions. Radius 10–12px. No border+wide-shadow pairing.
- **Status / summary:** after a successful load, a calm summary line (count of cards, folders) with the ochre accent as a small "ready" marker. Skipped-row errors listed plainly in `--danger` text.
- **Cards (future issues):** white surface, hairline border, radius 12–16px, the Japanese word centered and large.

## Layout

- Single centered column, max content width ~64rem, generous vertical rhythm. One job per screen — no side nav, no toolbar.
- Mobile-first; the upload surface and any future deck scale down to a comfortable single column with `min()`/`clamp()` widths.
- Semantic z-index scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip); no arbitrary 9999.

## Motion

- Purposeful and quiet. Ease-out curves (ease-out-quart/expo), no bounce.
- Dropzone drag-over and button hovers: fast (120–180ms) color/border transitions.
- Status/summary appearance: a soft fade+rise (~240ms).
- Future card flip: a 3D `rotateY` transition.
- Every animation has a `@media (prefers-reduced-motion: reduce)` crossfade/instant fallback.
