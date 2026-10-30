import type { Pack } from "../types";
import { fmtDate, fmtMoney } from "./engine";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A real show poster, generated from the pack. The designer can hand it to a
 * venue or put it on a slide without opening a design tool. It is deliberately
 * a poster, not a dashboard screenshot.
 */
export function showPosterSvg(pack: Pack): string {
  const show = pack.dates[0];
  const venue = pack.venues.find((v) => v.id === show?.venueId);
  const songs = pack.setlist.map((song, index) => {
    const label = `${String(index + 1).padStart(2, "0")}  ${song.title.toUpperCase()}`;
    const time = `${Math.floor(song.start / 60)}:${String(song.start % 60).padStart(2, "0")} — ${Math.floor(song.end / 60)}:${String(song.end % 60).padStart(2, "0")}`;
    return `<text x="110" y="${1100 + index * 54}" fill="#d3caba" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="3">${esc(label)}</text><text x="1090" y="${1100 + index * 54}" text-anchor="end" fill="#777167" font-family="'JetBrains Mono', monospace" font-size="17">${time}</text>`;
  }).join("");
  const palette = pack.looks
    .filter((look) => look.palette.length)
    .slice(3, 9)
    .map((look, index) => `<rect x="${810 + index * 54}" y="720" width="42" height="14" rx="2" fill="${look.palette[0]}" />`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <rect width="1200" height="1600" fill="#08080a"/>
  <rect x="34" y="34" width="1132" height="1532" fill="none" stroke="#2a2a26" stroke-width="1"/>
  <text x="110" y="130" fill="#d7ff4f" font-family="'JetBrains Mono', monospace" font-size="19" letter-spacing="8">CUE · NIGHT SIGNAL · ${esc(pack.project.version)}</text>
  <text x="110" y="214" fill="#9d978a" font-family="Inter, Arial, sans-serif" font-size="20" letter-spacing="6">${esc(pack.project.artist.toUpperCase())} · ${esc(pack.project.tour.toUpperCase())}</text>
  <text x="102" y="510" fill="#f5f0e4" font-family="Georgia, 'Times New Roman', serif" font-size="260" letter-spacing="-14">NIGHT</text>
  <text x="100" y="760" fill="#d7ff4f" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="300" letter-spacing="-16">SIGNAL</text>
  <line x1="110" y1="820" x2="1090" y2="820" stroke="#3b3b34" stroke-width="1"/>
  <text x="110" y="884" fill="#d3caba" font-family="Georgia, 'Times New Roman', serif" font-size="34">The show is designed before the lights go down.</text>
  ${palette}
  <text x="810" y="790" fill="#777167" font-family="'JetBrains Mono', monospace" font-size="15" letter-spacing="2">PALETTE / V5</text>
  <text x="110" y="1010" fill="#777167" font-family="'JetBrains Mono', monospace" font-size="16" letter-spacing="5">THE SET</text>
  ${songs}
  <line x1="110" y1="1270" x2="1090" y2="1270" stroke="#3b3b34" stroke-width="1"/>
  <text x="110" y="1340" fill="#f5f0e4" font-family="Georgia, 'Times New Roman', serif" font-size="44">${esc(show?.city ?? "One night")}</text>
  <text x="110" y="1390" fill="#9d978a" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="3">${esc(venue?.name ?? "Venue to be confirmed")} · ${esc(show?.date ? fmtDate(show.date) : "Date to be confirmed")}</text>
  <text x="110" y="1440" fill="#9d978a" font-family="Inter, Arial, sans-serif" font-size="18">Doors 19:30 · Curfew ${esc(show?.curfew ?? "—")} · Load-in ${venue?.loadInHours ?? "—"} h · ${fmtMoney(27527)} landing look</text>
  <text x="110" y="1518" fill="#d7ff4f" font-family="'JetBrains Mono', monospace" font-size="15" letter-spacing="4">CUE — THE LIVE SHOW DESIGN STUDIO</text>
  <text x="1090" y="1518" text-anchor="end" fill="#777167" font-family="'JetBrains Mono', monospace" font-size="13" letter-spacing="2">SYNTHETIC SHOW · ${esc(pack.project.version)}</text>
</svg>`;
}
