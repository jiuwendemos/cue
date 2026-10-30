import type {
  AgentSuggestion,
  BudgetLine,
  CheckResult,
  Cue,
  Look,
  Pack,
  ReadinessRisk,
  RiskState,
  ShowVersion,
  TourDate,
  Venue,
} from "../types";

/** Connected load that exists for every look: screen, audio, haze. */
export const ALWAYS_ON_W = 9000 + 3600 + 900;
export const POWER_LIMIT_KW = 43.5;
export const GLARE_LIMIT = 0.55;
export const CUE_GAP_S = 0.5;
export const FRESHNESS_MONTHS = 12;

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(v) || 0));
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function byId<T extends { id: string }>(items: T[], id: string | undefined | null): T | undefined {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

export function lookById(pack: Pack, id: string | undefined | null): Look | undefined {
  return byId(pack.looks, id);
}

export function venueById(pack: Pack, id: string | undefined | null): Venue | undefined {
  return byId(pack.venues, id);
}

export function dateById(pack: Pack, id: string | undefined | null): TourDate | undefined {
  return byId(pack.dates, id);
}

// ------------------------------------------------------------------ formatting

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtShortDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtKw(watts: number): string {
  return `${(watts / 1000).toFixed(1)} kW`;
}

export function timeAgo(iso: string | undefined, now = new Date("2026-10-30T12:00:00+01:00")): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.round((now.getTime() - t) / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function daysUntil(iso: string, anchor = "2026-10-30T12:00:00+01:00"): number {
  const a = new Date(anchor).getTime();
  const b = new Date(iso).getTime();
  return Math.ceil((b - a) / 86_400_000);
}

// ------------------------------------------------------------------ music

export function energyAt(pack: Pack, t: number): number {
  const song = pack.setlist.find((s) => t >= s.start && t < s.end) ?? pack.setlist[pack.setlist.length - 1];
  if (!song) return 0.3;
  const raw = clamp((t - song.start) / Math.max(1, song.end - song.start));
  const eased = raw * raw * (3 - 2 * raw);
  return song.energyStart + (song.energyEnd - song.energyStart) * eased;
}

export function songAt(pack: Pack, t: number) {
  return pack.setlist.find((s) => t >= s.start && t < s.end) ?? pack.setlist[pack.setlist.length - 1];
}

export function videoAt(pack: Pack, t: number): string | undefined {
  const candidates = pack.cues.filter((c) => c.kind === "VID" && c.at <= t);
  const last = candidates[candidates.length - 1];
  if (!last || !last.videoId) return undefined;
  return last.videoId;
}

export function cueAt(pack: Pack, t: number): Cue | undefined {
  const candidates = pack.cues.filter((c) => c.at <= t);
  return candidates[candidates.length - 1];
}

export function activeLookIdAt(pack: Pack, t: number, rejectedLooks: string[] = [], acceptedLookId: string | null = null): string | undefined {
  if (acceptedLookId) return acceptedLookId;
  const cues = pack.cues.filter((c) => c.kind === "LX" && c.at <= t && c.lookId);
  const last = cues[cues.length - 1];
  if (!last?.lookId) return undefined;
  if (rejectedLooks.includes(last.lookId)) {
    return pack.looks.find((l) => l.id === "look-six-beam")?.id ?? last.lookId;
  }
  return last.lookId;
}

// ------------------------------------------------------------------ looks

export interface LookStats {
  look: Look;
  watts: number;
  powerKw: number;
  supplyPct: number;
  frontKg: number;
  frontCapacityKg: number;
  weightPct: number;
  glare: number;
  cost: number;
  budgetTotal: number;
  budgetPct: number;
  fixtureCount: number;
}

interface Load {
  watts: number;
  perTruss: Record<string, number>;
}

export function fixtureLoad(pack: Pack, look: Look): Load {
  const fixtures = pack.rig.fixtures.filter((f) => look.fixtureIds.includes(f.id));
  const perTruss: Record<string, number> = {};
  let watts = 0;
  for (const f of fixtures) {
    watts += f.watts;
    if (f.truss !== "foh" && f.truss !== "deck") {
      perTruss[f.truss] = (perTruss[f.truss] ?? 0) + f.weightKg;
    }
  }
  // cable, clamps and data per loaded truss
  for (const [truss, kg] of Object.entries(perTruss)) {
    if (kg > 0) perTruss[truss] = kg + 60;
  }
  return { watts, perTruss };
}

export function powerKwForLook(pack: Pack, look: Look): number {
  return (fixtureLoad(pack, look).watts + ALWAYS_ON_W) / 1000;
}

export function frontWeightKg(pack: Pack, look: Look): number {
  return fixtureLoad(pack, look).perTruss.front ?? 0;
}

export function glareForLook(look: Look): number {
  return clamp(look.audienceAim / 8 + look.energy * 0.18);
}

export function lookStats(pack: Pack, look: Look): LookStats {
  const load = fixtureLoad(pack, look);
  const front = byId(pack.rig.trusses, "front");
  const powerKw = (load.watts + ALWAYS_ON_W) / 1000;
  const budgetTotal = budgetForLook(pack, look.id);
  return {
    look,
    watts: load.watts + ALWAYS_ON_W,
    powerKw,
    supplyPct: powerKw / pack.rig.power.kw,
    frontKg: load.perTruss.front ?? 0,
    frontCapacityKg: front?.capacityKg ?? 520,
    weightPct: (load.perTruss.front ?? 0) / (front?.capacityKg ?? 520),
    glare: glareForLook(look),
    cost: look.costDelta,
    budgetTotal,
    budgetPct: pack.budget.approved ? budgetTotal / pack.budget.approved : 0,
    fixtureCount: look.fixtureIds.length,
  };
}

export function trussLoads(pack: Pack, look: Look): { truss: string; name: string; kg: number; capacityKg: number; pct: number }[] {
  const load = fixtureLoad(pack, look);
  return pack.rig.trusses
    .filter((t) => t.capacityKg > 0)
    .map((t) => {
      const kg = load.perTruss[t.id] ?? 0;
      return { truss: t.id, name: t.name, kg, capacityKg: t.capacityKg, pct: kg / t.capacityKg };
    });
}

// ------------------------------------------------------------------ budget

export function budgetBase(pack: Pack): number {
  const base = pack.budget.lines.filter((l) => !l.optional).reduce((n, l) => n + l.qty * l.unitCost, 0);
  return base + Math.round(base * pack.budget.contingencyPct);
}

export function budgetAddOns(pack: Pack, lookId: string | undefined): BudgetLine[] {
  const look = lookById(pack, lookId);
  return pack.budget.lines.filter((l) => {
    if (!l.optional) return false;
    if (l.lookIds?.includes(lookId ?? "")) return true;
    if (look?.videoId && l.videoId === look.videoId) return true;
    return false;
  });
}

export function budgetForLook(pack: Pack, lookId: string | undefined): number {
  return budgetBase(pack) + sum(budgetAddOns(pack, lookId).map((l) => l.qty * l.unitCost));
}

export function budgetRows(pack: Pack, lookId: string | undefined): { line: BudgetLine; amount: number; active: boolean }[] {
  const addOns = new Set(budgetAddOns(pack, lookId).map((l) => l.id));
  return pack.budget.lines.map((line) => ({
    line,
    amount: line.qty * line.unitCost,
    active: !line.optional || addOns.has(line.id),
  }));
}

export function budgetTotal(pack: Pack, lookId: string | undefined): number {
  const rows = budgetRows(pack, lookId);
  const active = rows.filter((r) => r.active);
  const base = active.filter((r) => !r.line.optional).reduce((n, r) => n + r.amount, 0);
  const extras = active.filter((r) => r.line.optional).reduce((n, r) => n + r.amount, 0);
  return base + Math.round(base * pack.budget.contingencyPct) + extras;
}

// ------------------------------------------------------------------ checks

export function cueConflicts(pack: Pack): { a: Cue; b: Cue }[] {
  const out: { a: Cue; b: Cue }[] = [];
  for (let i = 0; i < pack.cues.length; i++) {
    for (let j = i + 1; j < pack.cues.length; j++) {
      const a = pack.cues[i];
      const b = pack.cues[j];
      if (a.kind !== b.kind) continue;
      if (Math.abs(a.at - b.at) < CUE_GAP_S) out.push({ a, b });
    }
  }
  return out;
}

export function missingAssetCues(pack: Pack): Cue[] {
  return pack.cues.filter((c) => c.videoId && pack.videos.find((v) => v.id === c.videoId)?.status === "missing");
}

export function rightsCheck(pack: Pack, dateId: string | undefined): CheckResult {
  const date = dateById(pack, dateId) ?? dateById(pack, "d-home");
  const videoRights = pack.rights.find((r) => r.kind === "video" && r.status !== "expired");
  if (!date || !videoRights) {
    return check("rights", "rights", "pass", "No rights window applies", "No dated content in this version.", 0, 0, "days");
  }
  const days = Math.ceil((new Date(videoRights.to).getTime() - new Date(date.date).getTime()) / 86_400_000);
  const status = days < 0 ? "fail" : days < 7 ? "warn" : "pass";
  return check(
    "rights",
    "rights",
    status,
    days < 0 ? "Content rights expire before this show" : "Content rights cover this show",
    `${videoRights.asset} is cleared to ${fmtDate(videoRights.to)}. ${date.city} is ${fmtDate(date.date)}.`,
    days,
    0,
    "days",
    [{ id: videoRights.id, label: videoRights.licence, source: videoRights.source, kind: "rights" }],
  );
}

export function scheduleCheck(pack: Pack, dateId: string | undefined): CheckResult {
  const date = dateById(pack, dateId) ?? dateById(pack, "d-home");
  const venue = venueById(pack, date?.venueId);
  if (!date || !venue) return check("schedule", "schedule", "pass", "Schedule", "No date selected.", 0, 0, "cues");
  const perHour = pack.cues.length / venue.loadInHours;
  const status = perHour > 5.5 ? "fail" : perHour > 4.5 ? "warn" : "pass";
  return check(
    "schedule",
    "schedule",
    status,
    "Load-in time fits the cue sheet",
    `${pack.cues.length} cues in a ${venue.loadInHours} h load-in (${perHour.toFixed(1)} cues/h). Benchmark 4.5.`,
    perHour,
    4.5,
    "cues/h",
    [{ id: date.id, label: `${date.city} load-in ${venue.loadInHours} h`, source: "Tour calendar", kind: "schedule" }],
  );
}

export function venueFitCheck(pack: Pack, venueId: string | undefined): CheckResult {
  const venue = venueById(pack, venueId) ?? venueById(pack, pack.project.venueId);
  if (!venue) return check("venue", "venue", "pass", "Venue fit", "No venue selected.", 0, 0, "m");
  const dw = venue.stage.width - pack.stage.width;
  const dd = venue.stage.depth - pack.stage.depth;
  const dt = venue.stage.trim - pack.stage.trim;
  const status = dw < -0.5 || dd < -0.5 ? "fail" : dw < 0 || dd < 0 || dt < 0 ? "warn" : "pass";
  return check(
    "venue",
    "venue",
    status,
    status === "pass" ? "Stage geometry fits the design" : "Stage is smaller than the design",
    `Venue ${venue.stage.width} × ${venue.stage.depth} m / ${venue.stage.trim} m trim vs design ${pack.stage.width} × ${pack.stage.depth} m / ${pack.stage.trim} m.`,
    Math.min(dw, dd, dt),
    0,
    "m",
    [{ id: venue.id, label: `${venue.name} · ${venue.stage.width} × ${venue.stage.depth} m`, source: venue.lastVerified, kind: "venue" }],
  );
}

export function dataFreshnessCheck(pack: Pack, venueId: string | undefined, anchor = "2026-10-30T12:00:00+01:00"): CheckResult {
  const venue = venueById(pack, venueId) ?? venueById(pack, pack.project.venueId);
  if (!venue) return check("data", "data", "pass", "Venue data", "No venue selected.", 0, 0, "months");
  const months = (new Date(anchor).getTime() - new Date(venue.lastVerified).getTime()) / (86_400_000 * 30.4);
  const status = venue.status === "missing" || months > FRESHNESS_MONTHS * 2 ? "fail" : months > FRESHNESS_MONTHS ? "warn" : "pass";
  return check(
    "data",
    "data",
    status,
    "Venue data is inside the freshness contract",
    `${venue.name} last verified ${fmtDate(venue.lastVerified)} by ${venue.verifiedBy} (${months.toFixed(0)} months).`,
    months,
    FRESHNESS_MONTHS,
    "months",
    [{ id: venue.id, label: `Verified ${venue.lastVerified}`, source: venue.verifiedBy, kind: "venue" }],
  );
}

export function sightlineCheck(pack: Pack, venueId: string | undefined): CheckResult {
  const venue = venueById(pack, venueId) ?? venueById(pack, pack.project.venueId);
  if (!venue) return check("sightline", "sightline", "pass", "Sightlines", "No venue selected.", 0, 0, "m");
  const screenBottom = pack.stage.screen.z;
  const clearance = screenBottom - venue.frontRow.eyeHeight;
  const status = clearance < 0 ? "fail" : clearance < 0.2 ? "warn" : "pass";
  return check(
    "sightline",
    "sightline",
    status,
    "Front row can see the artist and the screen edge",
    `Screen bottom ${screenBottom.toFixed(2)} m, front-row eye ${venue.frontRow.eyeHeight.toFixed(2)} m at ${venue.frontRow.distance} m. Clearance ${clearance.toFixed(2)} m.`,
    clearance,
    0.2,
    "m",
    [{ id: venue.id, label: `Front row ${venue.frontRow.distance} m · eye ${venue.frontRow.eyeHeight} m`, source: "Venue profile", kind: "venue" }],
  );
}

function check(
  id: string,
  kind: CheckResult["kind"],
  status: CheckResult["status"],
  title: string,
  detail: string,
  metric: number,
  limit: number,
  unit: string,
  evidence: CheckResult["evidence"] = [],
  lookId?: string,
): CheckResult {
  return { id, kind, status, title, detail, metric, limit, unit, evidence, lookId };
}

export function checksFor(pack: Pack, lookId: string | undefined, venueId: string | undefined = pack.project.venueId, dateId: string | undefined = "d-home"): CheckResult[] {
  const look = lookById(pack, lookId);
  const stats = look ? lookStats(pack, look) : null;
  const venue = venueById(pack, venueId) ?? venueById(pack, pack.project.venueId);
  const out: CheckResult[] = [];

  if (look && stats) {
    // The room's supply is the limit, not the home rig's. A tour is a set of rooms.
    const supplyKw = venue?.power.kw ?? pack.rig.power.kw;
    const supplyPct = stats.powerKw / supplyKw;
    const powerStatus = supplyPct > 1 ? "fail" : supplyPct > 0.9 ? "warn" : "pass";
    out.push(check(
      "power", "power", powerStatus,
      powerStatus === "fail" ? "The look exceeds the house supply" : "Power is inside the house supply",
      `${stats.powerKw.toFixed(1)} kW drawn of ${supplyKw} kW${venue ? ` at ${venue.name}` : ""} (${fmtPct(supplyPct)}).`,
      supplyPct, 1, "×",
      [{ id: "cit-power", label: `${venue?.power.amps ?? pack.rig.power.amps} A ${venue?.power.phases ?? pack.rig.power.phases}-phase supply`, source: `Venue profile — ${venue?.name ?? "Home"}`, kind: "venue" }],
      look.id,
    ));
    const rigCapacity = Math.min(stats.frontCapacityKg, venue?.rigCapacityKg ?? Number.POSITIVE_INFINITY);
    const weightPct = stats.frontKg / rigCapacity;
    const weightStatus = weightPct > 1 ? "fail" : weightPct > 0.9 ? "warn" : "pass";
    out.push(check(
      "weight", "weight", weightStatus,
      weightStatus === "fail" ? "The front truss is over its rating" : "Truss loads are inside the rating",
      `${stats.frontKg} kg on the front truss of ${rigCapacity} kg (${fmtPct(weightPct)}). Cable included.`,
      weightPct, 1, "×",
      [{ id: "cit-rig", label: `Front truss rated ${stats.frontCapacityKg} kg${venue ? `; venue rating ${venue.rigCapacityKg} kg` : ""}`, source: "Rig schedule v3", kind: "rig" }],
      look.id,
    ));
    const glareStatus = stats.glare > GLARE_LIMIT ? "fail" : stats.glare > GLARE_LIMIT * 0.8 ? "warn" : "pass";
    out.push(check(
      "glare", "glare", glareStatus,
      glareStatus === "fail" ? "The look blinds the front row" : "No fixture aims below the eyeline",
      `Glare index ${stats.glare.toFixed(2)} against a limit of ${GLARE_LIMIT.toFixed(2)}. ${look.audienceAim} fixture(s) aimed at the audience.`,
      stats.glare, GLARE_LIMIT, "index",
      [{ id: "cit-eye", label: "Front row eye height and distance", source: "Sightline model v2", kind: "venue" }],
      look.id,
    ));
  }

  out.push(sightlineCheck(pack, venueId));
  out.push(venueFitCheck(pack, venueId));
  out.push(dataFreshnessCheck(pack, venueId));
  out.push(rightsCheck(pack, dateId));
  out.push(scheduleCheck(pack, dateId));

  const conflicts = cueConflicts(pack);
  out.push(check(
    "cue-timing", "cue", conflicts.length ? "warn" : "pass",
    conflicts.length ? "Two cue numbers collide" : "Cue timing is clean",
    conflicts.length
      ? `${conflicts[0].a.id} at ${fmtTimecode(conflicts[0].a.at)} and ${conflicts[0].b.id} at ${fmtTimecode(conflicts[0].b.at)} are ${Math.abs(conflicts[0].a.at - conflicts[0].b.at).toFixed(1)} s apart.`
      : `${pack.cues.length} cues, no two of the same family within ${CUE_GAP_S} s.`,
    conflicts.length, 0, "collisions",
    [{ id: "cit-cue", label: "Cue sheet v4", source: "Show v5", kind: "cue" }],
  ));

  const missing = missingAssetCues(pack);
  out.push(check(
    "asset", "asset", missing.length ? "fail" : "pass",
    missing.length ? "A cue references a missing clip" : "Every cue asset is delivered",
    missing.length
      ? `${missing.map((c) => c.id).join(", ")} reference ${pack.videos.find((v) => v.id === missing[0].videoId)?.name ?? "a missing clip"}.`
      : `${pack.videos.length} clips delivered.`,
    missing.length, 0, "cues",
    [{ id: "cit-asset", label: "Asset register", source: "DAM link", kind: "asset" }],
  ));

  if (look && stats) {
    const over = stats.budgetTotal - pack.budget.approved;
    out.push(check(
      "budget", "budget", over > 0 ? "warn" : "pass",
      over > 0 ? "The active look puts the show over budget" : "The show is inside the approved budget",
      `${fmtMoney(stats.budgetTotal)} against ${fmtMoney(pack.budget.approved)} approved (${over > 0 ? "+" : ""}${fmtMoney(over)}).`,
      stats.budgetTotal, pack.budget.approved, "EUR",
      [{ id: "cit-budget", label: "Budget model v2", source: "Rate card 2026", kind: "budget" }],
      look.id,
    ));
  }

  return out;
}

export function checkSummary(checks: CheckResult[]) {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    total: checks.length,
    worst: checks.find((c) => c.status === "fail") ?? checks.find((c) => c.status === "warn"),
  };
}

// ------------------------------------------------------------------ readiness

export function riskOpen(risk: ReadinessRisk): boolean {
  return risk.state !== "resolved" && risk.state !== "dismissed";
}

export function riskStats(risks: ReadinessRisk[]) {
  const open = risks.filter(riskOpen);
  return {
    open: open.length,
    critical: open.filter((r) => r.severity === "critical").length,
    high: open.filter((r) => r.severity === "high").length,
    medium: open.filter((r) => r.severity === "medium").length,
    low: open.filter((r) => r.severity === "low").length,
    resolved: risks.filter((r) => r.state === "resolved").length,
    dismissed: risks.filter((r) => r.state === "dismissed").length,
    unowned: open.filter((r) => !r.owner).length,
    actionable: open.filter((r) => r.fix.cost > 0 || r.checks.some((c) => !c.done)).length,
    exposure: sum(open.map((r) => r.fix.cost)),
  };
}

export const RISK_STATES: RiskState[] = ["new", "acknowledged", "assigned", "investigating", "resolved", "dismissed"];

export function riskStateOrder(state: RiskState): number {
  return RISK_STATES.indexOf(state);
}

export function riskSeverityRank(severity: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity] ?? 5;
}

// ------------------------------------------------------------------ agent

export interface RankedSuggestion extends AgentSuggestion {
  score: number;
}

export function rankSuggestions(pack: Pack, rejectedLooks: string[] = []): RankedSuggestion[] {
  return pack.suggestions
    .map((s) => {
      const rejected = Boolean(s.lookId && rejectedLooks.includes(s.lookId));
      const flagPenalty = s.flags.length * 1.5;
      const score = s.impact + s.confidence * 8 - flagPenalty - (rejected ? 100 : 0);
      return { ...s, rank: 0, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function effectiveLook(pack: Pack, lookId: string | undefined, rejectedLooks: string[], acceptedLookId: string | null): Look | undefined {
  const base = lookById(pack, lookId);
  if (!base) return undefined;
  if (rejectedLooks.includes(base.id)) {
    return lookById(pack, acceptedLookId) ?? lookById(pack, "look-six-beam") ?? base;
  }
  return base;
}

// ------------------------------------------------------------------ versions

export function versionDiff(a: ShowVersion, b: ShowVersion): { from: ShowVersion; to: ShowVersion; changes: ShowVersion["changes"] } {
  return { from: a, to: b, changes: [...a.changes, ...b.changes] };
}

// ------------------------------------------------------------------ blocking

export interface PerformerState {
  performer: string;
  role: "artist" | "dancer" | "camera" | "crew";
  x: number;
  y: number;
  z: number;
  note: string;
}

export function performersAt(pack: Pack, t: number): PerformerState[] {
  const groups = new Map<string, typeof pack.blocking>();
  for (const key of pack.blocking) {
    if (key.role === "camera" || key.role === "crew") continue;
    const list = groups.get(key.performer) ?? [];
    list.push(key);
    groups.set(key.performer, list);
  }
  const out: PerformerState[] = [];
  for (const [performer, keys] of groups) {
    const sorted = [...keys].sort((a, b) => a.at - b.at);
    const before = [...sorted].reverse().find((k) => k.at <= t) ?? sorted[0];
    const after = sorted.find((k) => k.at > t);
    if (!after) {
      out.push({ performer, role: before.role, x: before.x, y: before.y, z: before.z, note: before.note });
      continue;
    }
    const span = Math.max(1, after.at - before.at);
    const f = clamp((t - before.at) / span);
    out.push({
      performer,
      role: before.role,
      x: before.x + (after.x - before.x) * f,
      y: before.y + (after.y - before.y) * f,
      z: before.z + (after.z - before.z) * f,
      note: before.note,
    });
  }
  return out;
}

// ------------------------------------------------------------------ exports

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function cueSheetRows(pack: Pack, rejectedLooks: string[], acceptedLookId: string | null) {
  return pack.cues.map((cue) => {
    const look = effectiveLook(pack, cue.lookId, rejectedLooks, acceptedLookId);
    const video = byId(pack.videos, cue.videoId);
    return {
      ...cue,
      lookName: look?.name ?? "—",
      videoName: video?.name ?? "—",
      scene: songAt(pack, cue.at)?.title ?? "—",
    };
  });
}

export function cueSheetHtml(pack: Pack, rejectedLooks: string[], acceptedLookId: string | null, signedBy = "Mara Voss"): string {
  const rows = cueSheetRows(pack, rejectedLooks, acceptedLookId);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>CUE — ${esc(pack.project.artist)} — ${esc(pack.project.title)} — Cue sheet</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font: 10px/1.45 "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 20px; letter-spacing: .08em; margin: 0; }
  h2 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 4px; color: #555; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .meta { text-align: right; font-size: 9px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; border-bottom: 1px solid #111; padding: 5px 4px; }
  td { border-bottom: .5px solid #ccc; padding: 5px 4px; vertical-align: top; }
  .id { font-family: "Courier New", monospace; font-weight: 700; white-space: nowrap; }
  .time { font-family: "Courier New", monospace; white-space: nowrap; }
  .safety { color: #a11; font-weight: 700; }
  .foot { display: flex; justify-content: space-between; margin-top: 12px; font-size: 8px; color: #555; }
  .sign { border-top: 1px solid #111; width: 220px; padding-top: 4px; margin-top: 22px; }
  .warn { background: #fff3cd; }
</style></head><body>
<header>
  <div><h1>CUE — ${esc(pack.project.artist)} / ${esc(pack.project.title)}</h1>
  <div style="font-size:10px;color:#444;margin-top:4px">${esc(pack.project.tour)} · ${esc(pack.project.productionCompany)} · Show ${esc(pack.project.version)}</div></div>
  <div class="meta">Cue sheet generated by CUE<br>${new Date().toISOString().slice(0, 10)} · Page 1 of 1<br>Designer: ${esc(pack.project.designer)} · Producer: ${esc(pack.project.producer)}</div>
</header>
<h2>Lighting / video / stage cues</h2>
<table><thead><tr><th>#</th><th>Cue</th><th>Time</th><th>Scene</th><th>Title and action</th><th>Look</th><th>Video</th><th>Fade</th><th>Owner</th><th>Status</th></tr></thead><tbody>
${rows.map((c) => `<tr class="${c.safety ? "warn" : ""}"><td class="id">${c.number}</td><td class="id">${esc(c.id)}</td><td class="time">${fmtTimecode(c.at)}</td><td>${esc(c.scene)}</td><td><b>${esc(c.title)}</b> — ${esc(c.detail)}${c.safety ? ' <span class="safety">SAFETY</span>' : ""}</td><td>${esc(c.lookName)}</td><td>${esc(c.videoName)}</td><td>${c.fade}s</td><td>${esc(c.owner)}</td><td>${c.status}</td></tr>`).join("")}
</tbody></table>
<div class="foot"><span>Safety sign-off: ${esc(signedBy)} · No cue is released to the venue without a human signature.</span><span>Generated ${new Date().toISOString()}</span></div>
<div class="sign"><h2>Safety sign-off</h2>${esc(signedBy)}</div>
</body></html>`;
}
