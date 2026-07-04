# Mobile-menu dialog semantics — the Category F High (plan, 2026-07-04)

Source: Category F audit, feature 20/17 — the one confirmed High (3 lenses
converged: feature 17 a11y "disclosure, not a dialog", feature 17 UX "no Escape,
no scroll lock", feature 20 a11y "no focus containment, obscured page focusable").

## Objective

The fullscreen mobile nav overlay (`.nav-links.is-open`, `position:fixed;
inset:0`) currently behaves as a bare disclosure: no Escape to close, no focus
containment, the obscured page behind it stays focusable and screen-reader
readable, and the body scrolls behind it. Give the open menu proper
modal-overlay behavior — Escape closes and restores focus, Tab is contained to
the visible header, the rest of the page goes `inert`, the body scroll locks —
without adding any new UI, new dependency, or disturbing the desktop inline nav.

## Prerequisites

- No new packages. `inert` is a standard element property (evergreen browsers
  2026); jsdom accepts the property for assertions.
- Read (done): `src/components/Nav.jsx` (the whole component — the disclosure is
  the `<button class="nav-toggle" aria-expanded aria-controls="nav-menu">` + the
  `<ul id="nav-menu" class="nav-links is-open">` sibling, both inside
  `<nav aria-label="Page sections">`), `src/styles/components.css:124-163` (the
  `@media (max-width:1240px)` overlay rules — the toggle is `display:none` above
  1240px, so `open` is only ever an overlay at ≤1240px), and `src/App.jsx` (the
  header's siblings that must go inert: `<main id="main">` and `<Footer>` →
  `<footer>`).
- Convention to match: the codebase manages this kind of client-only DOM effect
  with plain `useEffect` + refs (e.g. HeroScene's IntersectionObserver); tests
  override `window.matchMedia` per-test (HeroScene.test.jsx pattern) because the
  jsdom stub defaults `matches:false`.

## Step-by-step

1. Refs for the trap boundary and focus restore
   1.1. Add `const headerRef = useRef(null)` and `const toggleRef = useRef(null)`
        in `Nav()`; attach `ref={headerRef}` to the `<header>` and
        `ref={toggleRef}` to the `<button class="nav-toggle">`.
   1.2. The trap scope is the whole `<header>` — everything visible while the
        overlay is open (brand link, the Close button, the section links, the
        Apply CTA) lives there; everything else is obscured.

2. New effect — modal behaviors while open (client-only, gated to overlay width)
   Keyed on `[open]`. Early-return doing nothing unless
   `window.matchMedia('(max-width: 1240px)').matches` (above the breakpoint the
   `<ul>` is an inline nav, not an overlay — no modal semantics wanted). When it
   IS an overlay and `open`:
   2.1. Scroll lock: save `document.body.style.overflow`, set it to `'hidden'`.
   2.2. Inert background: set `.inert = true` on `document.getElementById('main')`
        and `document.querySelector('footer')` (each guarded for null). `inert`
        removes them from both the tab order AND the a11y tree in one property.
   2.3. Move focus into the menu: focus the first `.nav-links.is-open a`
        (the first section link) so the user starts inside the overlay, not
        stranded on the now-obscured page.
   2.4. Keydown handler on `document` while open:
        - `Escape` → `setOpen(false)` (cleanup restores focus, step 2.6).
        - `Tab` / `Shift+Tab` → containment: compute the focusable elements
          within `headerRef.current`
          (`a[href], button:not([disabled])` visible), and if focus is about to
          leave the first (Shift+Tab) or last (Tab) element, `preventDefault()`
          and wrap to the other end. A small `getFocusable(header)` helper
          filtering `offsetParent !== null` (skips the `display:none` desktop
          state defensively) keeps it robust.
   2.5. Cleanup (effect return, runs on close or unmount): restore
        `body.style.overflow`, clear `.inert` on both siblings, remove the
        keydown listener.
   2.6. Focus restore: in the cleanup, if the menu was open (transitioning to
        closed) and the toggle is still mounted, `toggleRef.current?.focus()` so
        keyboard focus returns to the control that opened it — the APG
        expectation. Guard against stealing focus on a route-change unmount
        (only restore when `document.activeElement` is inside the header or
        `<body>`, i.e. the trap still "owns" focus).

3. New effect — close on resize to desktop (prevents a stuck inert background)
   A `matchMedia('(min-width: 1241px)')` `change` listener that calls
   `setOpen(false)` when it matches. Without this, opening at mobile then
   resizing wide leaves `open=true`: the overlay CSS drops (inline nav shows) but
   the JS inert/scroll-lock would persist. Closing on cross-up is the clean fix
   and also removes a latent visual oddity. Standard `addEventListener('change')`
   + cleanup.

4. No JSX role change. Keep the existing disclosure semantics
   (`button aria-expanded aria-controls` → labelled region); the modal
   ENHANCEMENT is behavioral (Escape + trap + inert + scroll lock), which is the
   accepted accessible-hamburger pattern. Do NOT add `role="dialog"` — it would
   mislabel the desktop inline `<ul>` and needs a dialog name the overlay lacks.
   (Recorded alternative — see Decision Points.)

5. Tests — `src/components/Nav.test.jsx` (new; also the first Nav test, partially
   seeding the separate "Nav has no test" finding — scope here to the dialog
   behavior only). Per-test `window.matchMedia` override so
   `(max-width:1240px)` matches (mobile overlay) and the reduced-motion/GSAP
   paths stay inert, mirroring HeroScene.test.jsx. Under `<MemoryRouter>`:
   5.1. Click the toggle → `is-open` present, `aria-expanded="true"`, focus is on
        the first section link.
   5.2. Escape → menu closed (`aria-expanded="false"`), focus back on the toggle.
   5.3. While open, `#main` and `footer` carry `inert`; after close, neither does
        (render a stub main/footer in the test tree, or assert on
        `document`-level nodes the component queries).
   5.4. Body `overflow` is `'hidden'` while open and restored after close.
   5.5. Tab from the last focusable wraps to the first (and Shift+Tab inverse) —
        assert `document.activeElement` after a simulated wrap-edge Tab.

6. Manual + build verification (step in Testing & Validation).

## File & code changes

| Action | File | Change |
|---|---|---|
| Modify | `src/components/Nav.jsx` | headerRef/toggleRef; modal-behaviors effect (Escape, trap, inert, scroll lock, focus restore); close-on-resize-to-desktop effect |
| Create | `src/components/Nav.test.jsx` | dialog-behavior tests (5.1–5.5) |

No CSS change required — the visual overlay already exists; this is behavior only.

## Testing & Validation

- `npm run test:fe` — the new Nav suite + existing suites green.
- `GSS_ALLOW_EMPTY_ISSUES=1 npm run build` — Nav renders during the static
  prerender; confirm no SSR breakage (all new code is inside `useEffect`, so
  client-only).
- Manual (real browser at ≤1240px, keyboard only): open the menu → focus lands
  in it; Tab cycles only within the header, never reaching page content behind;
  Escape closes and returns focus to the Menu button; a screen reader (VoiceOver
  rotor) shows the page content behind as unavailable while open; the page does
  not scroll behind the overlay; resize wide with the menu open → it collapses to
  the inline nav with no stuck state.
- Rollback: revert the commit — the menu returns to its prior (working but
  inaccessible) disclosure behavior; no data or infra surface.

## Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Focus trap fights the existing pathname/link-click close paths | Low | Med | Cleanup runs on `open→false` from any cause; focus-restore guarded to only fire when the trap still owns focus, so a route-change unmount doesn't steal focus |
| `inert` not applied because `#main`/`footer` query runs before they mount | Low | Low | Nav mounts after main/footer exist in App's tree; queries run in an effect (post-paint), and each is null-guarded |
| jsdom doesn't emulate `inert` focus behavior | Med | Low | Tests assert the `inert` *property/attribute* is set/cleared (that is the contract); real focus-blocking is verified in the manual browser pass |
| Desktop nav regresses | Low | Med | All modal behavior gated behind `matchMedia('(max-width:1240px)')`; effect early-returns above it; resize-to-desktop closes the menu |

## Dependencies & Order of Operations

Steps 1→2→3 are the code (2 depends on 1's refs; 3 is independent). 4 is a
no-op confirmation. 5 after the code. 6 last. Self-contained — no interaction
with the other Category F batches (it does, however, seed `Nav.test.jsx`, so
sequence this BEFORE the broader "Nav test coverage" item to avoid a merge
collision on that file).

## Estimated Effort

Complexity: Medium. Time: 2–3 hours incl. tests + the keyboard/AT manual pass.
Files: 1 modified, 1 created.

# MISSION BRIEF

Overview: turn the fullscreen hamburger overlay from a bare disclosure into a
proper modal overlay — Escape, focus containment, inert background, scroll lock,
focus restore — in `Nav.jsx` behavior only, no new UI or dependency, gated to
the mobile breakpoint so the desktop inline nav is untouched.

Execution order: refs → modal-behaviors effect → resize-close effect → tests →
verify (browser keyboard + AT pass is the real acceptance gate for an a11y fix).

Decision points:
  - Enhance the disclosure vs add `role="dialog" aria-modal="true"`
    (RECOMMENDED: enhance — matches the existing aria-expanded/aria-controls
    pattern, doesn't mislabel the desktop inline `<ul>`, and `inert` already
    gives the background-hidden guarantee `aria-modal` would; documented so a
    future reviewer sees it was considered).
  - Move focus to the first link on open vs leave it on the toggle
    (RECOMMENDED: first link — the dialog expectation; the toggle stays reachable
    inside the trap to close).

Total estimated effort: 2–3 hours.
