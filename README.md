# PLIG Canvas Study: tutorial + task page

The participant-facing page for the PLIG AI-tutoring study (Justus Robertson, Yiqin Zhao, John-Paul Takats, RIT). A short Canvas tutorial on the left, a staged drawing task with a code editor on the right. This is the **Group 1 (control)** experience: tutorial, editor, canvas, error output, and per-stage pass marks. No AI on this page yet.

Static site, no build step. Live: https://jptweb.github.io/plig-canvas-study/

## Run it locally

Module scripts need a server, so:

```
cd plig-canvas-study
python3 -m http.server 8080
# open http://localhost:8080/
```

## URL flags

| Flag | Effect |
|---|---|
| `?task=scene` | Variant A: ground, house, roof, sun (default) |
| `?task=ring` | Variant B: background, disc, ring, bullseye |
| `&debug=1` | Show each stage's pass/fail reason under the stage (proctor / pilot use only) |

## Files

| File | What |
|---|---|
| `index.html` | Layout, the tutorial text (sections carry ids `sec-editor` ... `sec-rings`, plus `ref`), reference table |
| `styles.css` | Styling. `.tutorial section.is-highlighted` is the hook for Group 3 highlighting |
| `app.js` | Monaco editor (cdnjs 0.52.2, textarea fallback), sandbox iframe, run loop, stage checking, session log |
| `tasks.js` | Both variants: starter code, stage text, checkpoint functions |

## How "correct" is checked

On every Run the editor's code becomes a Web Worker (built from a Blob) that owns a 400 x 300 `OffscreenCanvas`. A tiny shim makes `document.getElementById("stage")` and `document.querySelector("canvas")` return that canvas, so the starter code is the same code a student would write on a real page. Before the student's script runs, every `ctx` drawing method is wrapped so each call is recorded with its arguments and the `fillStyle` / `strokeStyle` / `lineWidth` in force at that moment. When the script finishes (or throws) the worker posts back `{ calls, errors, logs, pixels, bitmap }`; the page paints the bitmap onto the visible canvas and hands the rest to the checkers.

A worker can be terminated instantly, so an infinite loop costs four seconds, shows an error, and nothing else. (An iframe sandbox was tried first; a hung iframe process also hung the next run.)

`tasks.js` groups the calls into `fillRects`, `strokeRects`, and path `segments` (everything since the last `beginPath`, ended by `fill` or `stroke`), and each stage's `check()` looks at those plus pixel probes. Results carry a `why` string (logged, shown only with `debug=1`) and `notes` for things that pass but are worth knowing (`sun-angle-360`, `ring-technique:winding|cover`).

Syntax errors surface on the worker's `error` event, runtime errors on the worker's own `onerror`; both are shown with the line number relative to the editor.

Editor content and the session log are mirrored to `sessionStorage`, so a reload in the same tab restores both. A new tab starts clean, which is what the next participant on a shared lab machine needs.

## Session log

Everything is logged in memory with a millisecond timestamp: load, tab switches, runs (with the code), run results (errors, stage summary), stage pass/fail transitions, Try it, reset, restore. "Download session log" saves it as JSON. Good enough for the timing pilot; a real study run will post it somewhere.

## Reserved for later groups

- `<aside id="assist" hidden>` at the bottom of the work column (chat panel for Group 2, feedback panel for Group 3).
- `data-section` on every tutorial section and every stage, and the `.is-highlighted` class, so Group 3 can point at "the part of the tutorial to re-read."

## Source of truth

The study design, task spec (stages, checkpoints, quiz draft), and tutorial text master live in JP's vault: `RIT-Hub-Vault/04-Projects/research/plig-ai-tutoring/` (`task-spec.md`, `tutorial-text.md`). Edit there first, then port here.
