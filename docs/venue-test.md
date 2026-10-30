# Venue test

Run this on the demo machine, in the room, before the first manager arrives. It takes about five
minutes and it is the difference between a demo and an apology.

## 1. Machine

```bash
cd web && npm run build && npm run budget   # the bundle gate passes
cd ../server && PYTHONPATH=. python -m uvicorn cue.api.app:app --port 8000
```

Open `http://127.0.0.1:8000`. In `#/manager`, press **Venue check**:

| Check | Pass means |
|---|---|
| 3D stage | WebGL available (the SVG stage is still the fallback) |
| Room audio | AudioContext available |
| Offline shell | a service worker is registered (production build, not the Vite dev server) |
| Fonts | Inter and the mono face loaded |
| Local store | state survives a reload |
| Connection | shows online/offline; the demo runs either way |
| Reset under 5 s | the drill returns a time under 5000 ms |

Then reload the page with the network unplugged. The show, the cue sheet, the budget and Readiness
must still open.

## 2. The 90 seconds

1. `#/stage` → sound on, `Play`. Watch the whole arc once.
2. Rehearse the choice beat: `#/stage?at=66`, choose the video drop, confirm the sheet says
   `VIDEO WON`, the drop row shows `VIDEO DROP — SIGNAL BARS`, and the cost changes.
3. Press **Print this sheet**. Confirm the paper has the same rows, the same drop look, the same
   show cost and the same delta as the screen.
4. Press `R`. Time it. It must be under five seconds.

## 3. Fallback

If the GPU driver, the projector or the audio fails:

- `#/stage?fallback=1` runs the silent SVG stage. The chip says `FALLBACK`; there is no 3D toggle.
- The rest of the workspace is unaffected: cue sheet, budget, readiness and the manager brief.

The optional recorded video is a **P0 asset to produce**: record the 90-second cut once on a clean
machine and keep the file on the demo laptop. Until then, the silent SVG path is the fallback, and the
docs say so.

## 4. The room

- Projector at 1920×1080, browser at 100%, no zoom.
- Sound check at the level the room will use; the track is synthesised, not the artist's record.
- One person drives, one person talks. The driver never explains the UI.
- Close Slack, mail and notifications. The demo pill says `SYNTHETIC SHOW`; keep it visible.
- Have `#/manager` open in a second tab for the questions after the piece.

## 5. After

- `#/manager` → **Refresh** the funnel. Note time to first touch, whether the room voted and whether
  the sheet printed. Clear it before the next group if you want a clean run.
- Export the proof CSV if the manager asks for numbers.
- If anything failed, write it down before changing the demo.
