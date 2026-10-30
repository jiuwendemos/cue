import type { BudgetLine, Cue, Look, Pack, TourDate, Venue } from "../types";

/**
 * A real blank workspace.
 *
 * Not an empty object: the app's checks, previz and budget all need a stage, a
 * rig and one look to be useful. This is the smallest valid show — one venue,
 * one look, one cue — and every part of it is yours to edit.
 */

const DAY = 86_400_000;

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}

function isoTimestamp(offsetDays: number, hour = 20): string {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function blankVenue(name = "Home venue", city = "Your city", capacity = 500): Venue {
  return {
    id: "v-home",
    name,
    city,
    country: "",
    address: "",
    capacity,
    stage: { width: 12, depth: 8, trim: 7 },
    rigCapacityKg: 600,
    power: { amps: 63, phases: 3, volts: 230, kw: 43.5 },
    loadInHours: 6,
    changeoverHours: 2,
    curfew: "23:00",
    frontRow: { distance: 2.5, eyeHeight: 1.15 },
    notes: "",
    lastVerified: isoDate(0),
    verifiedBy: "You",
    status: "verified",
  };
}

export function blankLook(fixtureIds: string[]): Look {
  return {
    id: "look-1",
    name: "Look 1",
    code: "LX 01",
    description: "The first look on the new show.",
    palette: ["#d7ff4f", "#51e0d2", "#f5f0e4"],
    energy: 0.6,
    impact: 60,
    costDelta: 0,
    createdBy: "designer",
    status: "approved",
    tags: ["new"],
    fixtureIds,
    audienceAim: 0,
    mood: "",
    reasons: [],
    note: "",
  };
}

export function blankCue(): Cue {
  return {
    id: "LX 1",
    number: 1,
    at: 0,
    kind: "LX",
    title: "Blackout",
    detail: "Stage to black. The first cue of your show.",
    lookId: "look-1",
    fade: 2,
    duration: 4,
    owner: "You",
    status: "draft",
    safety: false,
    citation: "New show",
  };
}

export function blankDate(venueId = "v-home", city = "Your city"): TourDate {
  return {
    id: "d-home",
    date: isoDate(30),
    city,
    venueId,
    loadIn: isoTimestamp(30, 8),
    show: isoTimestamp(30, 20),
    curfew: "23:00",
    crewCall: isoTimestamp(30, 12),
    status: "planned",
    leg: "home",
    note: "",
  };
}

export function blankBudgetLine(name = "Production fee", category: BudgetLine["category"] = "crew"): BudgetLine {
  return { id: `line-${Date.now()}`, category, name, qty: 1, unit: "show", unitCost: 0, note: "" };
}

export interface NewTourInput {
  artist: string;
  title: string;
  tour: string;
  designer: string;
  producer: string;
  tourManager: string;
  company: string;
  venueName: string;
  city: string;
  capacity: number;
  date: string;
}

export function createWorkspacePack(input: NewTourInput): Pack {
  const now = new Date().toISOString();
  const venue = blankVenue(input.venueName || "Home venue", input.city || "Your city", input.capacity || 500);
  const trusses = [
    { id: "front", name: "Front truss", y: 1.6, z: 6, length: 12, capacityKg: 600 },
    { id: "mid", name: "Mid truss", y: 4.2, z: 5.4, length: 12, capacityKg: 600 },
  ];
  const fixtures = [
    { id: "f1", label: "Beam 1", kind: "beam" as const, truss: "front", x: -4.5, y: 1.6, z: 6, watts: 1600, weightKg: 42, beamAngle: 6, purpose: "Front wash", universe: 1, address: 1, rental: 210 },
    { id: "f2", label: "Beam 2", kind: "beam" as const, truss: "front", x: -1.5, y: 1.6, z: 6, watts: 1600, weightKg: 42, beamAngle: 6, purpose: "Front wash", universe: 1, address: 2, rental: 210 },
    { id: "f3", label: "Beam 3", kind: "beam" as const, truss: "front", x: 1.5, y: 1.6, z: 6, watts: 1600, weightKg: 42, beamAngle: 6, purpose: "Front wash", universe: 1, address: 3, rental: 210 },
    { id: "f4", label: "Beam 4", kind: "beam" as const, truss: "front", x: 4.5, y: 1.6, z: 6, watts: 1600, weightKg: 42, beamAngle: 6, purpose: "Front wash", universe: 1, address: 4, rental: 210 },
    { id: "f5", label: "Wash 1", kind: "wash" as const, truss: "mid", x: -2.5, y: 4.2, z: 5.4, watts: 380, weightKg: 18, beamAngle: 24, purpose: "Back wash", universe: 1, address: 5, rental: 95 },
    { id: "f6", label: "Wash 2", kind: "wash" as const, truss: "mid", x: 2.5, y: 4.2, z: 5.4, watts: 380, weightKg: 18, beamAngle: 24, purpose: "Back wash", universe: 1, address: 6, rental: 95 },
  ];
  const look = blankLook(fixtures.map((f) => f.id));
  const date: TourDate = {
    ...blankDate(venue.id, venue.city),
    date: input.date || blankDate().date,
    loadIn: `${input.date || isoDate(30)}T08:00:00`,
    show: `${input.date || isoDate(30)}T20:00:00`,
    crewCall: `${input.date || isoDate(30)}T12:00:00`,
  };

  return {
    meta: { generated: now, seed: 0, version: "v1", demoWindow: 0 },
    project: {
      id: "show-workspace",
      title: input.title || "Untitled show",
      artist: input.artist || "Your artist",
      tour: input.tour || "Untitled tour",
      leg: "home",
      venueId: venue.id,
      version: "v1",
      updatedAt: now,
      designer: input.designer || "You",
      producer: input.producer || "You",
      tourManager: input.tourManager || "You",
      productionCompany: input.company || "Your company",
      anchor: isoDate(0),
      headline: "A new show, built in CUE.",
    },
    concept: { mood: "", references: [], narrative: "", statement: "", rules: [] },
    setlist: [],
    stage: {
      width: 12,
      depth: 8,
      trim: 7,
      screen: { x: 0, y: 6, w: 8, h: 4, z: 4, tilt: 0 },
      runway: { x: 0, y: 1, w: 2, d: 3 },
      entrances: [
        { id: "stage-left", label: "Stage left", x: -5.5, y: 1 },
        { id: "stage-right", label: "Stage right", x: 5.5, y: 1 },
      ],
      seats: { rows: 10, perRow: 20, firstRowY: 1.5, gap: 0.9, rake: 0.12 },
      notes: "",
    },
    rig: {
      trusses,
      fixtures,
      power: { amps: 63, phases: 3, volts: 230, kw: 43.5 },
      haze: "",
      notes: "",
    },
    setPieces: [],
    looks: [look],
    videos: [],
    blocking: [],
    cues: [blankCue()],
    budget: {
      currency: "EUR",
      approved: 0,
      contingencyPct: 0.08,
      lines: [blankBudgetLine()],
      note: "Your budget. Add lines, set the approved total.",
    },
    rights: [],
    venues: [venue],
    dates: [date],
    risks: [],
    versions: [],
    suggestions: [],
    agentTrace: [],
    audits: [],
    notifications: [],
    metrics: {
      timeToFirstLook: 0,
      timeToCueSheet: 0,
      timeToApprove: 0,
      previzIterations: 0,
      baselineIterations: 11,
      cueChanges: 0,
      rigCostAvoided: 0,
      rehearsalHoursSaved: 0,
      precision: 0,
      actionableRate: 0,
      risksPerWeek: 0,
      approvalOnTime: 0,
      weekly: [],
    },
    provenance: {
      track: "",
      trackLicence: "",
      assets: "Your own assets.",
      model: "CUE",
      modelVersion: "workspace",
      inference: "Local browser only",
      dataStay: "This browser (localStorage). On-site, signatures and approvals go to the tenant database.",
      createdAt: now,
      note: "Your own show data. Nothing here is synthetic and nothing leaves this browser.",
    },
    integrations: [],
    users: [
      { id: "u-you", name: "You", initials: "YO", role: "designer", venueIds: [venue.id], note: "Created this tour." },
    ],
    billing: {
      plan: "workspace",
      shows: 1,
      seats: 1,
      perShow: 0,
      perSeatMonth: 0,
      mrr: 0,
      nextInvoice: "",
      setupFee: 0,
      note: "",
    },
    readiness: {
      mode: "shadow",
      stopSwitch: false,
      quietHours: "22:00-06:00",
      digest: "daily",
      maxRisksPerProducerWeek: 20,
      channels: ["in_app"],
      coverageFloor: 0.9,
      stopReasons: [],
    },
  };
}

/** Next cue number and id for a new cue in the workspace. */
export function nextCue(cues: Cue[]): { number: number; id: string } {
  const number = cues.reduce((max, cue) => Math.max(max, cue.number), 0) + 1;
  return { number, id: `LX ${cues.filter((c) => c.kind === "LX").length + 1}` };
}
