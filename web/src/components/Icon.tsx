import type { SVGProps } from "react";

const paths: Record<string, string> = {
  stage: "M3 6h18v12H3zM3 18h18M7 6v12M17 6v12M12 2v4M9 3l3 3 3-3",
  shows: "M4 5h16v14H4zM8 9h8M8 13h8M8 17h5",
  look: "M12 3a6 6 0 0 0-3.6 10.8V17h7.2v-3.2A6 6 0 0 0 12 3zM9 21h6M10 17h4",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3z",
  cue: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h4M2 8h2M2 12h2M2 16h2",
  budget: "M3 7h18v12H3zM3 11h18M7 15h4M16 5v4M8 5v4",
  readiness: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM8 12l3 3 5-5",
  agent: "M12 3l7 3.5v5c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5v-5zM9 10h.01M15 10h.01M9 14c1 .8 2 1.2 3 1.2s2-.4 3-1.2",
  venue: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 10h.01M16 10h.01",
  versions: "M8 3h8l4 4v14H8zM16 3v5h4M4 7v14h10",
  pilot: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6M20 16v-2",
  design: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  admin: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM12 9v4M12 16v.5",
  about: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5",
  mobile: "M7 2h10v20H7zM10 5h4M11 19h2",
  provenance: "M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h5M4 7v14h10",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  arrowRight: "M5 12h13M12 5l7 7-7 7",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  check: "M4 12l5 5L20 6",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  play: "M7 4l13 8-13 8z",
  pause: "M8 4h3v16H8zM14 4h3v16h-3z",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  upload: "M12 16V4M7 9l5-5 5 5M4 21h16",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z",
  alert: "M12 3l10 18H2zM12 9v5M12 17.5v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M18 15c2.5.5 4 2.5 4 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  external: "M14 4h6v6M20 4L10 14M18 14v6H4V6h6",
  filter: "M3 5h18M6 12h12M10 19h4",
  spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 16l.9 3.1L23 20l-3.1.9L19 24l-.9-3.1L15 20l3.1-.9z",
  menu: "M3 6h18M3 12h18M3 18h18",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  layers: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  camera: "M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  volume: "M4 9h3l4-4v14l-4-4H4zM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14",
  mute: "M4 9h3l4-4v14l-4-4H4zM16 9l5 6M21 9l-5 6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  chart: "M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-8",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  gauge: "M4 18a8 8 0 1 1 16 0M12 14l4-4",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  lock: "M6 10h12v11H6zM9 10V7a3 3 0 0 1 6 0v3M12 14v3",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  contrast: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18",
  accessibility: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 9h14M12 9v6M12 15l-3 6M12 15l3 6",
  command: "M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z",
  file: "M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7",
  chevron: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  refresh: "M20 11a8 8 0 1 0-2.3 6.2M20 4v7h-7",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  pin: "M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  slack: "M9 3a2 2 0 0 0 0 4h2V5a2 2 0 0 0-2-2zM3 9a2 2 0 0 0 4 0V7H5a2 2 0 0 0-2 2zM15 21a2 2 0 0 0 0-4h-2v2a2 2 0 0 0 2 2zM21 15a2 2 0 0 0-4 0v2h2a2 2 0 0 0 2-2zM9 9h6v6H9z",
  wand: "M4 20l10-10M14 4l1.5 3L19 8.5 16 10l-1.5 3L13 10l-3-1.5L13 7z",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5L20 19M8.5 16.5L20 5",
};

export function Icon({ name, size = 16, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  const d = paths[name] ?? paths.about;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
