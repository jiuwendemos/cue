/**
 * CUE domain model.
 *
 * Times are seconds from doors-open of the show timeline. Distances are metres,
 * heights are metres from the stage deck, power is in watts unless a field says
 * otherwise. A public demo must stay readable: every number shown in the UI is
 * traceable to one of these records.
 */

export type ID = string;

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type CheckStatus = "pass" | "warn" | "fail";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Citation {
  id: string;
  label: string;
  source: string;
  kind: "asset" | "venue" | "rig" | "rights" | "cue" | "budget" | "agent" | "human" | "schedule";
}

// ------------------------------------------------------------------ venues

export interface Venue {
  id: ID;
  name: string;
  city: string;
  country: string;
  address: string;
  capacity: number;
  stage: { width: number; depth: number; trim: number };
  rigCapacityKg: number;
  power: { amps: number; phases: number; volts: number; kw: number };
  loadInHours: number;
  changeoverHours: number;
  curfew: string;
  frontRow: { distance: number; eyeHeight: number };
  notes: string;
  lastVerified: string;
  verifiedBy: string;
  status: "verified" | "stale" | "missing";
}

// ------------------------------------------------------------------ stage

export interface SetPiece {
  id: ID;
  name: string;
  kind: "riser" | "screen" | "runway" | "booth" | "scaffold" | "prop" | "lamp";
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  note: string;
}

export interface Stage {
  width: number;
  depth: number;
  trim: number;
  screen: { x: number; y: number; w: number; h: number; z: number; tilt: number };
  runway: { x: number; y: number; w: number; d: number };
  entrances: { id: ID; label: string; x: number; y: number }[];
  seats: { rows: number; perRow: number; firstRowY: number; gap: number; rake: number };
  notes: string;
}

export interface Truss {
  id: ID;
  name: string;
  y: number;
  z: number;
  length: number;
  capacityKg: number;
}

export type FixtureKind = "beam" | "wash" | "spot" | "led_bar" | "strobe" | "follow" | "lamp" | "blinder";

export interface Fixture {
  id: ID;
  label: string;
  kind: FixtureKind;
  truss: ID;
  x: number;
  y: number;
  z: number;
  watts: number;
  weightKg: number;
  beamAngle: number;
  purpose: string;
  universe: number;
  address: number;
  rental: number;
}

export interface Rig {
  trusses: Truss[];
  fixtures: Fixture[];
  power: { amps: number; phases: number; volts: number; kw: number };
  haze: string;
  notes: string;
}

// ------------------------------------------------------------------ design

export type LookStatus = "draft" | "proposed" | "approved" | "rejected" | "reference";

export interface Look {
  id: ID;
  name: string;
  code: string;
  description: string;
  palette: string[];
  energy: number;
  impact: number;
  costDelta: number;
  createdBy: "designer" | "agent";
  status: LookStatus;
  tags: string[];
  fixtureIds: ID[];
  audienceAim: number;
  videoId?: ID;
  videoTransition?: string;
  mood: string;
  reasons: Citation[];
  note: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface VideoLook {
  id: ID;
  name: string;
  clip: string;
  mapping: "full" | "split" | "columns" | "circle" | "horizon";
  transition: string;
  duration: number;
  resolution: string;
  status: "delivered" | "pending" | "missing";
  rightsId: ID;
  note: string;
  palette: string[];
  cueComplexity: number;
}

export interface BlockingKey {
  id: ID;
  at: number;
  performer: string;
  role: "artist" | "dancer" | "camera" | "crew";
  x: number;
  y: number;
  z: number;
  note: string;
}

// ------------------------------------------------------------------ music

export interface Song {
  id: ID;
  title: string;
  start: number;
  end: number;
  bpm: number;
  key: string;
  energyStart: number;
  energyEnd: number;
  transition: string;
  note: string;
}

export interface Concept {
  mood: string;
  references: string[];
  narrative: string;
  statement: string;
  rules: string[];
}

// ------------------------------------------------------------------ cues

export type CueKind = "LX" | "VID" | "STG" | "AUD" | "SFX" | "CAM";
export type CueStatus = "draft" | "review" | "approved" | "released";

export interface Cue {
  id: ID;
  number: number;
  at: number;
  kind: CueKind;
  title: string;
  detail: string;
  lookId?: ID;
  videoId?: ID;
  fade: number;
  duration: number;
  owner: string;
  status: CueStatus;
  safety: boolean;
  signedBy?: string;
  signedAt?: string;
  citation: string;
}

// ------------------------------------------------------------------ budget

export type BudgetCategory = "rig" | "crew" | "power" | "video" | "transport" | "content" | "contingency";

export interface BudgetLine {
  id: ID;
  category: BudgetCategory;
  name: string;
  qty: number;
  unit: string;
  unitCost: number;
  note: string;
  optional?: boolean;
  lookIds?: ID[];
  videoId?: ID;
}

export interface Budget {
  currency: "EUR" | "USD" | "GBP";
  approved: number;
  contingencyPct: number;
  lines: BudgetLine[];
  note: string;
}

// ------------------------------------------------------------------ rights

export interface RightsItem {
  id: ID;
  asset: string;
  kind: "music" | "video" | "likeness" | "venue" | "software";
  owner: string;
  licence: string;
  territory: string;
  from: string;
  to: string;
  status: "cleared" | "pending" | "expired" | "restricted";
  note: string;
  source: string;
}

// ------------------------------------------------------------------ tour

export interface TourDate {
  id: ID;
  date: string;
  city: string;
  venueId: ID;
  loadIn: string;
  show: string;
  curfew: string;
  crewCall: string;
  status: "planned" | "confirmed" | "at_risk" | "ready";
  leg: "home" | "europe" | "uk";
  note: string;
}

export type RiskKind =
  | "power"
  | "weight"
  | "glare"
  | "sightline"
  | "rights"
  | "asset"
  | "budget"
  | "schedule"
  | "data"
  | "crew"
  | "venue";

export type RiskState = "new" | "acknowledged" | "assigned" | "investigating" | "resolved" | "dismissed";

export interface ReadinessRisk {
  id: ID;
  kind: RiskKind;
  title: string;
  detail: string;
  severity: Severity;
  state: RiskState;
  owner: string;
  role: string;
  dateId?: ID;
  venueId?: ID;
  lookId?: ID;
  due: string;
  slaHours: number;
  confidence: number;
  whyNow: string;
  checks: { id: ID; label: string; done: boolean }[];
  fix: { label: string; effort: string; cost: number; owner: string };
  evidence: Citation[];
  history: { at: string; actor: string; action: string; detail: string }[];
  estimate: string;
  groupKey: string;
  provenance: string;
  dismissedReason?: string;
  resolvedAt?: string;
  verifiedAt?: string;
}

// ------------------------------------------------------------------ versions

export interface VersionChange {
  kind: "look" | "cue" | "budget" | "stage" | "video" | "rights" | "blocking" | "venue";
  detail: string;
}

export interface ShowVersion {
  id: ID;
  label: string;
  at: string;
  author: string;
  status: "draft" | "review" | "approved";
  note: string;
  changes: VersionChange[];
  approvedBy?: string;
  approvedAt?: string;
  signature?: string;
}

// ------------------------------------------------------------------ agent

export interface AgentSuggestion {
  id: ID;
  name: string;
  summary: string;
  kind: "look" | "video" | "cue" | "fix";
  lookId?: ID;
  videoId?: ID;
  impact: number;
  confidence: number;
  costDelta: number;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  reasons: Citation[];
  flags: string[];
  rank: number;
  rejectedReason?: string;
}

export interface AgentTraceStep {
  step: number;
  tool: string;
  title: string;
  detail: string;
  ms: number;
  citations: ID[];
  status: "done" | "running" | "waiting" | "error";
}

// ------------------------------------------------------------------ audit

export interface AuditEvent {
  id: ID;
  at: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
  modelVersion: string;
  sources: string[];
}

export interface Notification {
  id: ID;
  at: string;
  kind: "risk" | "approval" | "asset" | "rights" | "digest" | "system";
  severity: Severity;
  title: string;
  detail: string;
  riskId?: ID;
  read: boolean;
  channel: "in_app" | "email" | "slack" | "sms";
}

// ------------------------------------------------------------------ ops

export interface Integration {
  id: ID;
  name: string;
  protocol: string;
  kind: "previz" | "console" | "video" | "dam" | "calendar" | "finance" | "chat";
  status: "connected" | "available" | "simulated" | "error";
  detail: string;
  direction: "import" | "export" | "both";
}

export interface User {
  id: ID;
  name: string;
  initials: string;
  role: "designer" | "producer" | "crew" | "tour_manager" | "admin";
  venueIds: ID[];
  note: string;
}

export interface Billing {
  plan: string;
  shows: number;
  seats: number;
  perShow: number;
  perSeatMonth: number;
  mrr: number;
  nextInvoice: string;
  setupFee: number;
  note: string;
}

export interface Provenance {
  track: string;
  trackLicence: string;
  assets: string;
  model: string;
  modelVersion: string;
  inference: string;
  dataStay: string;
  createdAt: string;
  note: string;
}

export interface Metrics {
  timeToFirstLook: number;
  timeToCueSheet: number;
  timeToApprove: number;
  previzIterations: number;
  baselineIterations: number;
  cueChanges: number;
  rigCostAvoided: number;
  rehearsalHoursSaved: number;
  precision: number;
  actionableRate: number;
  risksPerWeek: number;
  approvalOnTime: number;
  weekly: { week: string; iterations: number; cueChanges: number; risks: number; cost: number }[];
}

export interface ReadinessSettings {
  mode: "shadow" | "live";
  stopSwitch: boolean;
  quietHours: string;
  digest: "daily" | "weekly";
  maxRisksPerProducerWeek: number;
  channels: string[];
  coverageFloor: number;
  stopReasons: string[];
}

export interface ProjectMeta {
  id: ID;
  title: string;
  artist: string;
  tour: string;
  leg: string;
  venueId: ID;
  version: string;
  updatedAt: string;
  designer: string;
  producer: string;
  tourManager: string;
  productionCompany: string;
  anchor: string;
  headline: string;
}

export interface Pack {
  meta: { generated: string; seed: number; version: string; demoWindow: number };
  project: ProjectMeta;
  concept: Concept;
  setlist: Song[];
  stage: Stage;
  rig: Rig;
  setPieces: SetPiece[];
  looks: Look[];
  videos: VideoLook[];
  blocking: BlockingKey[];
  cues: Cue[];
  budget: Budget;
  rights: RightsItem[];
  venues: Venue[];
  dates: TourDate[];
  risks: ReadinessRisk[];
  versions: ShowVersion[];
  suggestions: AgentSuggestion[];
  agentTrace: AgentTraceStep[];
  audits: AuditEvent[];
  notifications: Notification[];
  metrics: Metrics;
  provenance: Provenance;
  integrations: Integration[];
  users: User[];
  billing: Billing;
  readiness: ReadinessSettings;
}

export interface CheckResult {
  id: ID;
  kind: RiskKind | "cue";
  status: CheckStatus;
  title: string;
  detail: string;
  metric: number;
  limit: number;
  unit: string;
  lookId?: ID;
  evidence: Citation[];
}

export interface LookCost {
  lookId: ID;
  powerKw: number;
  weightKg: number;
  rental: number;
  crew: number;
  total: number;
}

export interface CueSheetRow extends Cue {
  lookName: string;
  videoName: string;
  scene: string;
}
