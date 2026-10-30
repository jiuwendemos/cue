# Accessibility self-audit

**Status: self-audit, not an external WCAG 2.2 AA sign-off.** This page records what the demo does,
what it does not, and how to test it. The pilot must add an external audit.

## What is in the demo

| Check | Status | Evidence |
|---|---|---|
| Skip link | pass | every shell page starts with “Skip to content” |
| Visible focus | pass | 2 px accent focus ring, offset 2 px |
| Keyboard path | pass | tabs, drawers, dialog Escape, timeline arrows, stage piece `Space` / `R` / `Esc` / `1` / `2` |
| 44 px touch targets | pass | mobile review and bottom nav; 32 px minimum on the desk |
| No text below 11 px in chrome | pass | tokens set `--text-2xs: 11px`; SVG labels are annotations |
| Colour not the only signal | pass | severity bar + label; status chip + text |
| Reduced motion | pass | `prefers-reduced-motion` and a manual setting |
| Three themes | pass | dark, light, high contrast |
| Focus return | pass | dialogs and drawers return to the trigger |
| Semantic landmarks | pass | banner, navigation, main, contentinfo |
| Form labels | pass | visible labels on inputs; `aria-label` where the label is visual |
| Error identification | pass | plain-language banners and inline errors |
| 200% zoom | partial | layout survives; the 3D canvas is not tested at 200% |
| Screen reader pass | not yet | needs NVDA / VoiceOver / TalkBack |
| External WCAG 2.2 AA audit | not yet | pilot task |
| Captions for recorded demo | not applicable | no video recording is shipped |
| 3D alternative | partial | the SVG previz is the alternative; the 3D is optional |

## How to test

```bash
cd web
npm run dev
# open http://127.0.0.1:5174
```

1. Unplug the mouse. Tab through every route. Every action must be reachable; Escape closes overlays.
2. Toggle **Studio settings → Reduced motion**. The camera, drawer and cue transitions stop.
3. Switch to **High contrast**. Check every page at 200% zoom.
4. On a phone, check the bottom nav, the 44 px targets and the one-handed approve/sign flow.
5. Run the stage piece with sound off: the trust beat and the vote are still readable.
6. Open `/watch` with no API. The local scan and the backtest must still work.

## Known gaps

- No external WCAG 2.2 AA sign-off.
- No screen-reader pass on the 3D canvas; the SVG previz is the alternative.
- The 10-metre legibility test has not been run in a real room.
- The 3D chunk is optional and not part of the first load.
- The public demo has no user research; accessibility is a self-check, not a validated claim.

The roadmap tracks these in Track B (B7 and B8).
