# The 3-minute walkthrough

**`demo/cue-walkthrough-en.mp4`** — 2:57, 1600×900, English narration and captions.

It is not a tour of screens. It is one production office building a new tour:

1. **Six fields.** My tour → blank workspace. Harbour Lights, Kade 12, a date.
2. **Make it the real tour.** The team; The Foundry in Manchester (12 × 8 m, 23 kW, 400 kg); a second date.
3. **Real files.** Import the Vectorworks fixture schedule (20 fixtures) and the grandMA3 cue list (12 cues).
4. **Build the look.** All twenty fixtures. 27.3 kW, 440 kg on the front truss.
5. **The room has a limit.** The checks name The Foundry: power over the 23 kW supply, front truss over the 400 kg rating.
6. **The agent.** It reads this tour, calls the tools and answers with the citations: The Foundry, and a lower-power option.
7. **The designer decides.** A seven-beam cut: 19.1 kW, 326 kg. Both rooms pass.
8. **The money.** The real lines make €12,744. Approved €12,000 → €744 over. Approved €13,000 → €256 under.
9. **Sign the sheet.** The crew's copy, ready to export.
10. **Ready.**

The band and the rooms are invented. The app, the imports, the checks, the OpenJiuwen agent, the budget arithmetic and the signature are real.

## How it is made

The CoachMe demo pipeline, scaled to one language:

| Step | File | What it does |
|---|---|---|
| Capture | `capture.py` | Playwright (system Chrome, 1600×900) drives the on-site build at `127.0.0.1:8100`, loads a blank workspace and performs the real actions; saves 22 screenshots and `shots.json` |
| Narrate | `narrate.py` | `uvx edge-tts`, voice `en-US-AndrewNeural`, one MP3 + SRT per scene |
| Assemble | `build.py` | PIL title/end cards, ffmpeg slow-zoom stills, audio mux, concat, burned captions with a legibility bar; writes `demo/cue-walkthrough-en.mp4` and `.srt` |
| Script | `script-en.md` | The narration and the frames per scene |
| Scenes | `scenes.py` | One source for the copy, shot list and voice |

```bash
# On-site build running on 127.0.0.1:8100 with the example/local data
cd demo/walkthrough
uv run --with playwright python capture.py     # ~2 min (the agent call is real)
python narrate.py                               # ~30 s, network
python build.py                                 # ~2-3 min
```

Requires the CoachMe virtualenv for `PIL` and the `imageio_ffmpeg` binary (both already on this
machine), and `uvx` for Playwright and edge-tts.

## Why stills, not a screen recording

The app is deterministic and the screens are the evidence: each frame is a real state the script reached.
A screen recording would add cursor motion but not more truth. The agent answer is a real call (the
timestamps are in the frame); the imports are real files; the checks are computed from the pack.

## What the video proves

- A blank workspace is a real starting point, not a demo overlay.
- Importing a rig and a cue list changes the checks and the sheet.
- The checks are venue-aware: the same look passes in Amsterdam and fails in Manchester.
- The agent reads the *posted* tour, not the server's demo pack.
- A design decision changes the power, the weight and the budget together.
- The budget is the real delta, and the cue sheet can be signed and exported.

## Files

| File | Purpose |
|---|---|
| `../cue-walkthrough-en.mp4` | The master (H.264 + AAC, faststart) |
| `../cue-walkthrough-en.srt` | Captions |
| `frames/` | The 22 captured states |
| `audio/` | Per-scene narration and SRTs |
| `timeline.json` | Scene start/duration |
| `shots.json` | Frame manifest |
