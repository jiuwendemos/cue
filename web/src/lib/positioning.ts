/**
 * One buyer, one sentence, one demo. The critique's first rule: do not pitch
 * four buyers at once. Change this file, not ten pages, if that decision moves.
 */
export const BUYER = {
  id: "production-company",
  label: "Independent touring production company",
  desk: "the production office",
  sentence: "CUE is where a tour is designed, priced, checked and signed before load-in.",
  why: "They own the calendar, the budget and the crew, and they answer for a missed load-in.",
  notFor: "It is not a console, a DMX controller or a render farm. CUE designs; the crew runs the show.",
  proofLine:
    "The show was designed before the lights went down, the unsafe look was rejected, and the tour stayed under budget.",
} as const;

export const DEMO_CUT = [
  {
    id: "stage",
    n: "01",
    title: "The 90-second show",
    to: "/stage",
    say: "One lamp, one unsafe proposal, one human decision, one room vote. Reset with R.",
    metric: "90 s",
    label: "the drop",
  },
  {
    id: "studio",
    n: "02",
    title: "The studio",
    to: "/show",
    say: "The designer scrubs, drags a look, sees the checks and the cost move with the playhead.",
    metric: "live",
    label: "previz and checks",
  },
  {
    id: "cues",
    n: "03",
    title: "The cue sheet",
    to: "/cues",
    say: "What the crew gets: numbers, times, looks, safety flags and the signature line.",
    metric: "26 cues",
    label: "the crew's copy",
  },
  {
    id: "budget",
    n: "04",
    title: "The budget",
    to: "/budget",
    say: "The producer sees the delta, not a surprise invoice: approved, current, contingency.",
    metric: "€29,000",
    label: "approved",
  },
  {
    id: "readiness",
    n: "05",
    title: "Readiness",
    to: "/readiness",
    say: "The office opens one board: power, weight, rights, assets, venue data, owner, due date.",
    metric: "1 board",
    label: "the daily return",
  },
  {
    id: "proof",
    n: "06",
    title: "The proof",
    to: "/pilot",
    say: "The pilot gate and the baseline. No claim without a method and a counter-claim.",
    metric: "90 days",
    label: "measured",
  },
] as const;
