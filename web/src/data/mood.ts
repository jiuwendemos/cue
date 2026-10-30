export interface MoodReference {
  ref: string;
  note: string;
  from: string;
  via: string;
  to: string;
}

/** Generated reference cards for the synthetic show. No third-party imagery. */
export const MOOD: MoodReference[] = [
  { ref: "Turrell's light rooms", note: "A room made of one colour. The audience disappears into the field.", from: "#ff7a3d", via: "#ffb454", to: "#1a0f08" },
  { ref: "Kraftwerk's geometry", note: "Human figures reduced to lines. Nothing decorative survives.", from: "#d7ff4f", via: "#5f7a1d", to: "#0a0d08" },
  { ref: "a lighthouse in fog", note: "One sweep, then black. The beam is the only narrative.", from: "#9fd8ff", via: "#3f6d8a", to: "#081016" },
  { ref: "a club before it fills", note: "Haze, a held chord, the anticipation before the first kick.", from: "#b18cff", via: "#4a2d7a", to: "#0c0814" },
];
