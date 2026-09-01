---
name: design-taste
description: >-
  Design-engineering craft standards for building and reviewing any user-facing UI
  in this repo — components, layouts, CSS/CSS Modules, Framer Motion animations,
  transitions, hover/focus/loading/empty states, typography, spacing, dark mode.
  Use this whenever you write or change anything a user sees or interacts with,
  and whenever you're asked to review, polish, "make it feel nicer", fix jank,
  tune an animation, or improve the look of a screen — even if the request never
  says the word "design". Motion, easing, interaction feedback, perceived
  performance, and completeness of states are all in scope.
---

# Design taste

This skill is a standard for craft, in the spirit of design engineers like Emil
Kowalski: the goal is UI that feels *inevitable* — nothing calls attention to
itself, motion is felt rather than watched, and every state the user can reach
looks deliberate. Taste here means **restraint plus follow-through**: do less,
but finish it.

Apply this when writing new UI and when reviewing existing UI. When reviewing,
end with the checklist at the bottom.

## Motion

Animation is a tool for continuity — it explains where something came from and
where it went. If an animation is *decorative*, cut it.

- **Easing matters more than duration.** Never `linear` for UI (only for
  spinners/progress). Enter with `ease-out` (fast start, gentle settle); exit
  with `ease-in` (gentle start, quick leave). For anything the user can
  interrupt — drags, toggles, things that can be re-triggered mid-flight — use a
  spring, not a fixed duration, so it retargets instead of restarting.
- **Duration budget:** 150–200ms for small state changes (hover, toggle,
  color), 200–300ms for elements entering/leaving, up to ~400ms only for large
  surfaces (sheets, page transitions). Longer than that reads as sluggish.
- **Animate compositor-friendly properties only:** `transform` and `opacity`.
  Animating `width`, `height`, `top`, `left`, `margin`, or `box-shadow` causes
  layout/paint on every frame and janks. For size changes use `transform: scale`
  or a layout animation (Framer Motion `layout`). Reach for `will-change` only on
  an element that is *about* to animate, and remove it after.
- **Distances are small.** Entrances travel 4–12px, not 40px. A menu that flies
  in from off-screen is louder than the information it carries.
- **Respect `prefers-reduced-motion: reduce`** — replace movement with a plain
  opacity fade (or nothing). This is not optional; some users get motion
  sickness. Framer Motion: gate transitions on `useReducedMotion()`.
- **Stagger sparingly.** A list of 3–6 items staggered by ~30ms feels alive; 20
  items staggered feels like waiting.

## Micro-interactions

Every interactive element must acknowledge input within ~100ms, and the
acknowledgement should be quiet.

- Hover: a 1–2% scale, a small `translateY(-1px)`, or a background/opacity shift.
  Not all of them at once.
- Active/press: move *toward* the user's finger — `scale(0.97)` or
  `translateY(1px)`. This makes buttons feel physical.
- Transitions on interactive elements go on the **calm-state** rule and are
  overridden on `:hover`/`:active`, so the element eases back out when the
  pointer leaves.
- Focus is shown with `:focus-visible`, never bare `:focus` (bare `:focus` puts
  a ring on mouse clicks too, which looks broken). The ring must be clearly
  visible — a 2px outline with offset, using a real color, not a faint one.
- Hit targets are at least 44×44px even if the visible control is smaller; pad
  the clickable area, don't grow the graphic.

## Restraint and hierarchy

Most "unpolished" UI is over-decorated. Before adding a border, shadow, or color,
try to solve it with space and weight.

- **One shadow language.** Pick a small elevation set and reuse it. A card does
  not need a border *and* a shadow *and* a background tint — usually one is
  enough. Shadows should look like soft ambient light (large blur, low opacity,
  slight downward offset), not a hard drop.
- **Fewer type sizes and weights.** Two weights (e.g. 400/600) and a short size
  scale cover almost everything. Bold everything = nothing stands out.
- **Color is for meaning, not decoration.** Accent color marks the primary
  action and status (error/success). Body UI is neutral. If everything is
  branded, the eye has nowhere to land.
- **Alignment is invisible when right and shouting when wrong.** Things that
  relate line up on a shared edge. Optical alignment beats mathematical: a
  circular avatar or a glyph often needs a nudge to *look* centered.
- **Spacing is a rhythm.** Use a consistent scale (4/8/12/16/24/32…). Gaps
  between unrelated groups are larger than gaps within a group — proximity is
  what communicates grouping, not dividers.

## Typography

- Line-height scales *inversely* with font size: headings ~1.1–1.25, body
  ~1.5–1.6, tiny print a bit more.
- Tighten letter-spacing slightly on large display text (`-0.01em` to
  `-0.02em`); loosen it on all-caps and very small labels (`+0.02em` to
  `+0.06em`).
- Measure (line length) for reading text: ~60–75 characters. Full-width
  paragraphs on desktop are tiring.
- Use tabular / lining figures (`font-variant-numeric: tabular-nums`) for
  anything that updates in place or sits in a column — prices, counts, times —
  so digits don't jitter.
- Don't center multi-line body text. Center single lines and short headings only.
- Prevent widows on short headings with a non-breaking space before the last
  word where it matters.

## Perceived performance

How fast it *feels* is a design problem, not just an engineering one.

- **Respond to the click instantly.** Disable/spin the button on submit in the
  same frame; do the network call after. Never let a click sit with no feedback.
- **Optimistic UI** for actions that almost always succeed (favouriting,
  toggles, adding to a list): update the UI now, reconcile with the server
  response, roll back visibly on failure.
- **Skeletons only when the layout is known** and load takes >~300ms. A skeleton
  that doesn't match the final layout causes a worse shift than a spinner. For
  short waits, show nothing rather than a flash of spinner.
- **Reserve space** for anything async — images (`aspect-ratio`), late-loading
  text, ad-hoc badges — so content doesn't jump. Cumulative layout shift is the
  cheapest polish win.
- **Preload on intent:** start fetching a route/resource on `pointerdown` or link
  hover, not on click.

## Every state, on purpose

A component isn't done when the happy path renders. Enumerate the states and
design each.

- **Interactive elements:** default, hover, focus-visible, active, disabled,
  loading. Disabled must look unmistakably inert (lowered opacity + `cursor:
  not-allowed`) and should carry a hint of *why* when non-obvious.
- **Anything that loads data:** loading, empty (first-run vs. filtered-to-zero
  are different messages), error (with a retry), partial/stale.
- **Empty states are an opportunity**, not a dead end — one clear sentence plus
  the action that fills the space.
- **Forms:** inline validation on blur (not on every keystroke), errors adjacent
  to the field, submit disabled only when you can explain what's missing.
- **Long content:** define truncation (line-clamp + full view) rather than
  letting it break layout.

## Craft details

The last 5% that separates "fine" from "considered":

- **Nested radii:** inner radius = outer radius − padding, so concentric corners
  stay parallel.
- **Borders:** 1px, in a real color token — hairlines built from `opacity` on a
  colored element shift with the background.
- **Icons** align to the text's optical center and match its size and weight;
  give icon+label a small consistent gap and equal optical spacing.
- **Dark mode is a redesign, not an inversion:** avoid pure `#000`/`#fff`, lift
  surfaces with lighter fills rather than shadows, reduce saturated colors, and
  raise border contrast slightly.
- **Scrollbars, selection color, autofill styling, `::marker`** — these leak the
  default browser look; style them to match.
- **Transitions belong on the element, keyed to specific properties**
  (`transition: transform .18s ease, background-color .18s ease`), never
  `transition: all` (it animates properties you didn't mean to and costs paint).

## In this repo (Adelia)

- **Styling:** component styles are CSS Modules (`Foo.module.css`) next to the
  component. Global tokens live in `src/styles/global.css`. Tailwind 4 is present
  but component work leans on CSS Modules — follow the file you're in.
- **Use the existing tokens**, don't hardcode hex: `--color-text`,
  `--color-text-muted`, `--color-border`, `--color-sand` (accent),
  `--color-error`, `--color-shadow` / `--color-shadow-strong`, `--radius-sm|md|lg`,
  `--font-display` (Cormorant Garamond, serif — for headings/quotes),
  `--font-body` (Inter), `--font-epic` (Bebas Neue — sparingly, for big numeric
  or hero moments).
- There is **no spacing/duration/easing token** yet. Keep magnitudes consistent
  with the guidance above; if you introduce a scale, add it to `global.css` as
  `--space-*` / `--ease-*` / `--dur-*` rather than scattering literals.
- **Motion:** Framer Motion is available (~13 components use it) — use it for
  orchestrated, interruptible, or layout animation. Plain CSS transitions are
  right for simple hover/toggle/color changes; don't pull in Framer for those.
- **Reduced motion:** several `.module.css` files already have
  `@media (prefers-reduced-motion: reduce)` blocks — match that pattern in any
  new animated component.
- The product UI is in **Spanish** — copy for new states (empty/error/loading)
  is written in Spanish, matching the surrounding tone.

## Review checklist

When asked to review or polish UI, walk this and report what fails:

1. **Motion** — easing not linear? durations in budget? only transform/opacity
   animated? `prefers-reduced-motion` handled? distances small?
2. **Interaction** — hover + active + `:focus-visible` all present and distinct?
   feedback within ~100ms? hit target ≥ 44px?
3. **States** — loading, empty, error, disabled all designed? empty state has an
   action? errors have retry?
4. **Restraint** — any element with redundant border+shadow+tint? more than two
   font weights? accent color used for decoration?
5. **Hierarchy & spacing** — consistent spacing scale? grouping by proximity not
   dividers? shared alignment edges? optical alignment on glyphs/avatars?
6. **Typography** — line-height inversely proportional to size? tabular-nums on
   in-place numbers? reading measure ≤ ~75ch? no centered body copy?
7. **Perceived performance** — instant click feedback? layout space reserved for
   async content? optimistic where safe?
8. **Details** — nested radii correct? borders use a color token? icons optically
   aligned? no `transition: all`? tokens used instead of literals?
