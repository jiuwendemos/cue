import type { Cue, Fixture, FixtureKind, Truss } from "../types";

/** Small RFC-4180-ish CSV reader. Enough for the exports the crew already has. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function toObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((key, index) => [key, (cells[index] ?? "").trim()])));
}

/** "Time 3:45", "3:45", "1:02:03" and "225" all become seconds. */
export function clockValue(value: string): number {
  const text = String(value || "").replace(/time/gi, "").trim();
  if (!text) return 0;
  const parts = text.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

const CUE_KINDS = new Set(["LX", "VID", "STG", "AUD", "SFX", "CAM"]);
const FIXTURE_KINDS = new Set(["beam", "wash", "spot", "led_bar", "strobe", "follow", "lamp", "blinder"]);

function kindOf(...values: string[]): Cue["kind"] {
  for (const value of values) {
    const upper = value.toUpperCase();
    for (const kind of CUE_KINDS) if (upper.includes(kind)) return kind as Cue["kind"];
    if (/video|screen|clip/i.test(value)) return "VID";
    if (/audio|playback/i.test(value)) return "AUD";
    if (/haze|sfx|smoke/i.test(value)) return "SFX";
  }
  return "LX";
}

/** grandMA3 cue list: Cue, Name, Trigger, Fade, Delay, Command, Page, Executor, Note. */
export function cuesFromCsv(text: string, existingIds: string[] = []): Cue[] {
  const used = new Set(existingIds);
  return toObjects(parseCsv(text)).flatMap((row) => {
    const raw = row.cue || row.cue_number || row.number || "";
    const number = Number(raw);
    if (!Number.isFinite(number) || number <= 0) return [];
    let id = `LX ${number}`;
    while (used.has(id)) id = `${id}+`;
    used.add(id);
    const title = row.name || row.title || `Cue ${number}`;
    const command = row.command || "";
    const note = row.note || "";
    return [
      {
        id,
        number,
        at: clockValue(row.trigger || row.time || raw),
        kind: kindOf(row.page, title, command),
        title,
        detail: command || note,
        fade: Number(row.fade) || 0,
        duration: 2,
        owner: "Imported",
        status: "draft",
        safety: /safety|strobe|haze|blind/i.test(`${title} ${note} ${command}`),
        citation: "Imported from a grandMA3 CSV",
      } satisfies Cue,
    ];
  });
}

/** Vectorworks fixture schedule: id, label, kind, truss, x, y, z, watts, weight_kg, beam_angle, universe, address, rental. */
export function fixturesFromCsv(text: string): { fixtures: Fixture[]; trusses: Truss[] } {
  const trusses = new Map<string, Truss>();
  const fixtures = toObjects(parseCsv(text)).flatMap((row, index) => {
    const label = row.label || row.name || `Fixture ${index + 1}`;
    const id = row.id || `f-${index + 1}`;
    const trussId = row.truss || "front";
    const y = Number(row.y) || 1.6;
    const z = Number(row.z) || 6;
    if (!trusses.has(trussId)) {
      trusses.set(trussId, {
        id: trussId,
        name: (row.truss_name || trussId).replace(/-/g, " "),
        y,
        z,
        length: 12,
        capacityKg: 600,
      });
    }
    const kind = FIXTURE_KINDS.has((row.kind || "").toLowerCase()) ? ((row.kind || "beam").toLowerCase() as FixtureKind) : "beam";
    return [
      {
        id,
        label,
        kind,
        truss: trussId,
        x: Number(row.x) || 0,
        y,
        z,
        watts: Number(row.watts) || 0,
        weightKg: Number(row.weight_kg || row.weight) || 0,
        beamAngle: Number(row.beam_angle || row.beam) || 12,
        purpose: row.purpose || "",
        universe: Number(row.universe) || 1,
        address: Number(row.address) || index + 1,
        rental: Number(row.rental) || 0,
      } satisfies Fixture,
    ];
  });
  return { fixtures, trusses: [...trusses.values()] };
}
