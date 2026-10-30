# The manager demo

One buyer, one sentence, one cut. This is the script for the first manager demo, and the proof that
sits behind it.

## The buyer

**Independent touring production company.** The daily user is the production office: the producer who
owns the budget, the tour manager who owns the calendar and the crew, and the designer they hire.

> CUE is where a tour is designed, priced, checked and signed before load-in.

Not a console. Not a DMX controller. Not a render farm. CUE designs; the crew runs the show.

The choice lives in one place, [`web/src/lib/positioning.ts`](../web/src/lib/positioning.ts). Change
that file, not ten pages, if the buyer decision moves.

## The 90 seconds

![The reveal: the vote changes the drop row, the show cost and the printed sheet](assets/stage-reveal.png)

Open `#/stage`. Sound on. The whole arc is deterministic and offline.

| Time | Beat | What the manager sees |
|---|---|---|
| 0:00 | Cold open | One lamp, one practical, a room before the drop. |
| 0:10 | First touch | The previz, the audio and the cost meter follow the playhead. |
| 0:25 | The agent works | Three looks, one video moment, every claim cited. |
| 0:45 | The trust beat | AERIAL 12 is spectacular and unsafe: 44 kg over the truss, 1.6 kW over supply, six beams below the front-row eyeline. |
| 0:58 | The human decides | Reject, or keep it and own the risk. The rejection is recorded and the ranking is recomputed. |
| 1:05 | The room votes | Light drop or video drop. |
| 1:22 | The reveal | The cue sheet prints **with the vote applied**: the drop row changes look, the show cost changes, the approved budget and the delta are on the sheet. `Print this sheet` prints exactly that. |
| 1:32 | Done | Reset with `R`, under five seconds. |

The vote is not a mood. It changes the drop cue and the show cost in the same scene, and the printed
sheet matches the screen. Try `#/stage?at=66` to rehearse the choice beat without waiting.

## The 10 minutes

`#/manager` is the cut, with each step as a live page and arrow keys to move.

1. **The 90-second show** — `#/stage`
2. **The studio** — `#/show`
3. **The cue sheet** — `#/cues`
4. **The budget** — `#/budget`
5. **Readiness** — `#/readiness`
6. **The proof** — `#/pilot`

The same page carries the proof table, the demo funnel and the venue check, so there is nothing to
switch to when the question comes.

## The proof, and what it does not claim

| Measure | Baseline | This show | Not claimed |
|---|---|---|---|
| Iterations to approval | 11 | 3 | not the quality of the idea |
| Cue changes in rehearsal | 17 | 4 | not that fewer cues is better |
| Rig cost avoided | — | €8,640 | not booked until the invoice |
| Rehearsal hours saved | — | 6.5 h / show week | not a person score |
| Approvals on time | — | 92% | not a creative judgement |
| Show cost, landing look | €29,577 hero | €27,627 | before the next venue variant |

These are modelled from the synthetic show. The 90-day pilot replaces each row with a measured value
against the office's current process. The page says so, and the CSV export carries the method and the
counter-claim.

**The line the manager should remember:** *“The show was designed before the lights went down, the
unsafe look was rejected, and the tour stayed under budget.”*

## The venue, before the manager walks in

Run `#/manager` → **Venue check** on the demo machine, in the room:

- 3D stage (WebGL), room audio, the offline shell, fonts, local storage, the connection, and a reset
  under five seconds.
- Then `#/stage?fallback=1` for the silent SVG path if the projector, audio or GPU fails.
- Full runbook: [venue-test.md](venue-test.md).

## Which moments land

The brief records local events only: `stage.start`, `stage.touch`, `stage.reject`, `stage.vote`,
`stage.finish`, `stage.sheet`, `stage.reset`, `manager.open`, `manager.venue_check`. The funnel shows
time to first touch, the stage arc, whether the room voted and whether the sheet printed.

No user id, no network, no third party. Clear it from the page.

## Definition of done

- Five strangers: four can explain CUE in one sentence.
- First touch within 15 seconds; the drop lands by 30 seconds; the full arc in 90 seconds.
- Reset under five seconds; the demo runs offline.
- The vote changes the cue sheet and the budget visibly; the printed sheet matches the screen.
- A manager can name the buyer and the ROI without prompting.

## Do not

- Do not drift into live console or DMX control.
- Do not pitch four buyers. This brief is the production company.
- Do not call it a design tool. It is a production workspace.
- Do not let the docs say “concept only”. This is a live demo, built.
