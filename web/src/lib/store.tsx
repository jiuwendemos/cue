import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PACK } from "../data/pack";
import type {
  AuditEvent,
  CheckResult,
  Cue,
  CueStatus,
  Look,
  Notification,
  ReadinessSettings,
  ReadinessRisk,
  RiskState,
  ShowVersion,
} from "../types";
import { checksFor, effectiveLook, rankSuggestions, riskOpen, riskStats, type RankedSuggestion } from "./engine";

const STORAGE_KEY = "cue.demo.v1";
const ANCHOR = PACK.project.anchor;

type CuePatch = Partial<Pick<Cue, "status" | "title" | "detail" | "at" | "fade" | "lookId" | "owner" | "videoId">>;

interface Approval {
  actor: string;
  at: string;
  note: string;
  signature: string;
}

interface Persisted {
  rejectedLooks: string[];
  acceptedLookId: string | null;
  acceptedSuggestionId: string | null;
  rejectionReasons: Record<string, string>;
  vote: "light" | "video" | null;
  cuePatches: Record<string, CuePatch>;
  signedCues: Record<string, { actor: string; at: string; signature: string }>;
  riskStates: Record<string, RiskState>;
  riskOwners: Record<string, string>;
  riskChecks: Record<string, string[]>;
  dismissalReasons: Record<string, string>;
  versionApprovals: Record<string, Approval>;
  notificationsRead: string[];
  settings: ReadinessSettings;
  stopReasons: string[];
  audits: AuditEvent[];
  localVersions: ShowVersion[];
  budgetApproved: number | null;
  briefSeen: boolean;
  extraRisks: ReadinessRisk[];
}

const EMPTY: Persisted = {
  rejectedLooks: [],
  acceptedLookId: null,
  acceptedSuggestionId: null,
  rejectionReasons: {},
  vote: null,
  cuePatches: {},
  signedCues: {},
  riskStates: {},
  riskOwners: {},
  riskChecks: {},
  dismissalReasons: {},
  versionApprovals: {},
  notificationsRead: [],
  settings: PACK.readiness,
  stopReasons: [],
  audits: [],
  localVersions: [],
  budgetApproved: null,
  briefSeen: false,
  extraRisks: [],
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...EMPTY,
      ...parsed,
      settings: { ...PACK.readiness, ...(parsed.settings ?? {}) },
    };
  } catch {
    return EMPTY;
  }
}

export interface AgentStatus {
  configured: boolean;
  available: boolean;
  backend: string;
  model: string;
  detail: string;
}

interface StoreValue {
  pack: typeof PACK;
  loading: boolean;
  live: boolean;
  agentStatus: AgentStatus;
  signOffName: string;
  rejectedLooks: string[];
  acceptedLookId: string | null;
  rejectionReasons: Record<string, string>;
  vote: "light" | "video" | null;
  ranked: RankedSuggestion[];
  activeLook: Look;
  activeLookId: string;
  checks: CheckResult[];
  cues: Cue[];
  signedCues: Record<string, { actor: string; at: string; signature: string }>;
  risks: ReadinessRisk[];
  openRisks: ReadinessRisk[];
  riskCounts: ReturnType<typeof riskStats>;
  notifications: Notification[];
  unread: number;
  settings: ReadinessSettings;
  stopReasons: string[];
  audits: AuditEvent[];
  versions: ShowVersion[];
  currentVersion: ShowVersion;
  metrics: typeof PACK.metrics;
  budgetApproved: number;
  briefSeen: boolean;
  nextDateId: string;
  activeSuggestion: RankedSuggestion | undefined;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string, reason: string) => void;
  selectLook: (id: string) => void;
  rejectLook: (id: string, reason: string) => void;
  clearDrop: () => void;
  voteDrop: (choice: "light" | "video") => void;
  patchCue: (id: string, patch: CuePatch) => void;
  signCue: (id: string) => void;
  signSafetyCues: () => void;
  acknowledgeRisk: (id: string) => void;
  assignRisk: (id: string, owner: string) => void;
  investigateRisk: (id: string) => void;
  resolveRisk: (id: string) => void;
  verifyRisk: (id: string) => void;
  reopenRisk: (id: string) => void;
  dismissRisk: (id: string, reason: string) => void;
  completeRiskCheck: (riskId: string, checkId: string) => void;
  runReadinessCheck: () => void;
  refreshLive: () => Promise<void>;
  approveVersion: (id: string, actor: string, note: string) => void;
  createVersion: (label: string, note: string) => string;
  setBudgetApproved: (value: number) => void;
  setReadinessMode: (mode: "shadow" | "live") => void;
  patchSettings: (patch: Partial<ReadinessSettings>) => void;
  setStopSwitch: (on: boolean, reason?: string) => void;
  readNotification: (id: string) => void;
  readAllNotifications: () => void;
  markBriefSeen: () => void;
  reset: () => void;
  toast: string | null;
  say: (message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function signatureFor(actor: string, at: string): string {
  const initials = actor
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const d = new Date(at);
  return `${initials}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => load());
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    configured: false,
    available: true,
    backend: "deterministic-local",
    model: "cue-looksmith-1.4.0",
    detail: "Static offline demo. No cloud call.",
  });

  const apiUrl = useCallback((path: string) => new URL(`api/${path}`, document.baseURI).toString(), []);

  const call = useCallback(
    (path: string, body?: unknown, method = "POST") => {
      if (!liveRef.current) return;
      void fetch(apiUrl(path), {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }).catch(() => {
        /* the local show remains usable when the on-site API drops */
      });
    },
    [apiUrl],
  );

  useEffect(() => {
    const staticHost = location.hostname.endsWith("github.io") || location.protocol === "file:";
    const viteDev = (location.hostname === "127.0.0.1" || location.hostname === "localhost") && (location.port === "5174" || location.port === "5173");
    if (staticHost || viteDev) return;
    let cancelled = false;
    (async () => {
      try {
        const health = await fetch(apiUrl("health"));
        if (!health.ok) return;
        const data = (await health.json()) as { ok: boolean };
        if (cancelled || !data.ok) return;
        liveRef.current = true;
        setLive(true);
        try {
          const status = await fetch(apiUrl("agent/status"));
          if (status.ok) {
            const s = (await status.json()) as Partial<AgentStatus>;
            if (!cancelled) {
              setAgentStatus((prev) => ({ ...prev, ...s }));
            }
          }
        } catch {
          /* status is optional */
        }

        // Hydrate the human decisions from the on-site store. The public Pages
        // build never reaches this block.
        try {
          const cuesRes = await fetch(apiUrl("cues"));
          if (cuesRes.ok) {
            const data = (await cuesRes.json()) as { signed?: Record<string, { actor: string; at: string; signature: string }> };
            if (!cancelled && data.signed) {
              setState((prev) => ({ ...prev, signedCues: { ...prev.signedCues, ...data.signed } }));
            }
          }
        } catch {
          /* keep local signatures */
        }
        try {
          const readinessRes = await fetch(apiUrl("readiness"));
          if (readinessRes.ok) {
            const data = (await readinessRes.json()) as {
              risks?: { id: string; state: RiskState; owner: string; dismissedReason?: string; verifiedAt?: string; checks?: { id: string; done: boolean }[] }[];
            };
            if (!cancelled && data.risks) {
              setState((prev) => {
                const riskStates = { ...prev.riskStates };
                const riskOwners = { ...prev.riskOwners };
                const dismissalReasons = { ...prev.dismissalReasons };
                const riskChecks = { ...prev.riskChecks };
                for (const risk of data.risks ?? []) {
                  riskStates[risk.id] = risk.state;
                  riskOwners[risk.id] = risk.owner;
                  if (risk.dismissedReason) dismissalReasons[risk.id] = risk.dismissedReason;
                  riskChecks[risk.id] = (risk.checks ?? []).filter((c) => c.done).map((c) => c.id);
                }
                const extraRisks = (data.risks ?? []).filter((risk) => risk.id.startsWith("D-")) as unknown as ReadinessRisk[];
                return { ...prev, riskStates, riskOwners, dismissalReasons, riskChecks, extraRisks };
              });
            }
          }
        } catch {
          /* keep local risks */
        }
        try {
          const versionsRes = await fetch(apiUrl("versions"));
          if (versionsRes.ok) {
            const data = (await versionsRes.json()) as {
              versions?: { id: string; status: string; approvedBy?: string; approvedAt?: string; signature?: string; note?: string }[];
            };
            if (!cancelled && data.versions) {
              setState((prev) => {
                const approvals = { ...prev.versionApprovals };
                for (const v of data.versions ?? []) {
                  if (v.status === "approved" && v.approvedBy) {
                    approvals[v.id] = { actor: v.approvedBy, at: v.approvedAt ?? new Date().toISOString(), note: v.note ?? "", signature: v.signature ?? "" };
                  }
                }
                return { ...prev, versionApprovals: approvals };
              });
            }
          }
        } catch {
          /* keep local approvals */
        }
      } catch {
        /* offline-first */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const say = useCallback((message: string) => {
    setToast(message);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const pushAudit = useCallback((event: Omit<AuditEvent, "id" | "at" | "modelVersion">) => {
    const at = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      audits: [
        {
          ...event,
          id: `local-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          at,
          modelVersion: "cue-1.0.0",
        },
        ...prev.audits,
      ].slice(0, 160),
    }));
  }, []);

  const ranked = useMemo(() => {
    const list = rankSuggestions(PACK, state.rejectedLooks);
    return list.map((s) => {
      const isRejected = Boolean(s.lookId && state.rejectedLooks.includes(s.lookId));
      const isAccepted = state.acceptedSuggestionId === s.id;
      return {
        ...s,
        status: isRejected ? "rejected" : isAccepted ? "accepted" : s.status,
      } as RankedSuggestion;
    });
  }, [state.acceptedSuggestionId, state.rejectedLooks]);

  const activeLookId = useMemo(() => {
    if (state.vote === "video") return "look-video-drop";
    if (state.vote === "light") return "look-six-beam";
    if (state.acceptedLookId) return state.acceptedLookId;
    if (state.rejectedLooks.includes("look-aerial-12")) return "look-six-beam";
    return "look-aerial-12";
  }, [state.acceptedLookId, state.rejectedLooks, state.vote]);

  const activeLook = useMemo(() => PACK.looks.find((l) => l.id === activeLookId) ?? PACK.looks[4], [activeLookId]);

  const nextDateId = useMemo(() => {
    const next = PACK.dates.find((d) => new Date(d.date).getTime() >= new Date(ANCHOR).getTime());
    return next?.id ?? PACK.dates[0].id;
  }, []);

  const checks = useMemo(
    () => checksFor(PACK, activeLook.id, PACK.project.venueId, nextDateId),
    [activeLook.id, nextDateId],
  );

  const cues = useMemo(
    () =>
      PACK.cues.map((c) => {
        const patch = state.cuePatches[c.id] ?? {};
        const signed = state.signedCues[c.id];
        const status: CueStatus = signed ? "released" : patch.status ?? c.status;
        return { ...c, ...patch, status };
      }),
    [state.cuePatches, state.signedCues],
  );

  const risks = useMemo(
    () =>
      [...PACK.risks, ...state.extraRisks].map((risk) => {
        const done = state.riskChecks[risk.id] ?? [];
        return {
          ...risk,
          state: state.riskStates[risk.id] ?? risk.state,
          owner: state.riskOwners[risk.id] ?? risk.owner,
          checks: risk.checks.map((c) => ({ ...c, done: c.done || done.includes(c.id) })),
          dismissedReason: state.dismissalReasons[risk.id] ?? risk.dismissedReason,
        };
      }),
    [state.dismissalReasons, state.extraRisks, state.riskChecks, state.riskOwners, state.riskStates],
  );

  const openRisks = useMemo(() => risks.filter(riskOpen), [risks]);
  const riskCounts = useMemo(() => riskStats(risks), [risks]);

  const notifications = useMemo(
    () => PACK.notifications.map((n) => ({ ...n, read: n.read || state.notificationsRead.includes(n.id) })),
    [state.notificationsRead],
  );
  const unread = notifications.filter((n) => !n.read).length;

  const versions = useMemo(() => [...PACK.versions, ...state.localVersions], [state.localVersions]);
  const currentVersion = versions[versions.length - 1];

  const budgetApproved = state.budgetApproved ?? PACK.budget.approved;
  const activeSuggestion = ranked.find((s) => s.status !== "rejected" && s.lookId === activeLook.id) ?? ranked.find((s) => s.status !== "rejected");

  const signOffName = state.settings.mode === "shadow" ? "Mara Voss" : "Mara Voss";

  const acceptSuggestion = useCallback(
    (id: string) => {
      const suggestion = PACK.suggestions.find((s) => s.id === id);
      if (!suggestion) return;
      const lookId = suggestion.lookId ?? (id === "A-04" ? "look-video-drop" : null);
      setState((prev) => ({
        ...prev,
        acceptedSuggestionId: id,
        acceptedLookId: lookId,
        vote: null,
      }));
      pushAudit({
        actor: "Mara Voss",
        action: "agent.accepted",
        object: id,
        detail: `Accepted ${suggestion.name}. ${suggestion.summary}`,
        sources: ["agent", ...suggestion.reasons.map((r) => r.source)],
      });
      call(`agent/suggestions/${id}/accept`, { actor: "Mara Voss" });
      say(`${suggestion.name} accepted — the cue sheet will use it`);
    },
    [call, pushAudit, say],
  );

  const rejectSuggestion = useCallback(
    (id: string, reason: string) => {
      const suggestion = PACK.suggestions.find((s) => s.id === id);
      if (!suggestion?.lookId) return;
      setState((prev) => ({
        ...prev,
        rejectedLooks: prev.rejectedLooks.includes(suggestion.lookId as string)
          ? prev.rejectedLooks
          : [...prev.rejectedLooks, suggestion.lookId as string],
        rejectionReasons: { ...prev.rejectionReasons, [suggestion.lookId as string]: reason },
        acceptedLookId: prev.acceptedLookId === suggestion.lookId ? null : prev.acceptedLookId,
        acceptedSuggestionId: prev.acceptedSuggestionId === id ? null : prev.acceptedSuggestionId,
      }));
      pushAudit({
        actor: "Mara Voss",
        action: "look.rejected",
        object: suggestion.lookId,
        detail: `Rejected ${suggestion.name}: ${reason}. The ranking was recomputed.`,
        sources: ["agent", "rig", "venue", "sightline-model"],
      });
      call(`agent/suggestions/${id}/reject`, { reason, actor: "Mara Voss" });
      say(`${suggestion.name} rejected — re-ranked to the safe look`);
    },
    [call, pushAudit, say],
  );

  const selectLook = useCallback(
    (id: string) => {
      const look = PACK.looks.find((l) => l.id === id);
      if (!look) return;
      const suggestion = PACK.suggestions.find((s) => s.lookId === id);
      setState((prev) => ({
        ...prev,
        acceptedLookId: id,
        acceptedSuggestionId: suggestion?.id ?? null,
        vote: null,
      }));
      pushAudit({ actor: "Mara Voss", action: "look.selected", object: id, detail: `${look.name} set as the active look.`, sources: ["designer"] });
      say(`${look.name} is the active look`);
    },
    [pushAudit, say],
  );

  const rejectLook = useCallback(
    (id: string, reason: string) => {
      const look = PACK.looks.find((l) => l.id === id);
      if (!look) return;
      const suggestion = PACK.suggestions.find((s) => s.lookId === id);
      setState((prev) => ({
        ...prev,
        rejectedLooks: prev.rejectedLooks.includes(id) ? prev.rejectedLooks : [...prev.rejectedLooks, id],
        rejectionReasons: { ...prev.rejectionReasons, [id]: reason },
        acceptedLookId: prev.acceptedLookId === id ? null : prev.acceptedLookId,
        acceptedSuggestionId: prev.acceptedSuggestionId === suggestion?.id ? null : prev.acceptedSuggestionId,
      }));
      pushAudit({ actor: "Mara Voss", action: "look.rejected", object: id, detail: `Rejected ${look.name}: ${reason}`, sources: ["designer", "rig", "venue"] });
      say(`${look.name} rejected — the ranking was recomputed`);
    },
    [pushAudit, say],
  );

  const clearDrop = useCallback(() => {
    setState((prev) => ({ ...prev, rejectedLooks: [], rejectionReasons: {}, acceptedLookId: null, acceptedSuggestionId: null, vote: null }));
    say("Drop reset to the agent's first proposal");
  }, [say]);

  const voteDrop = useCallback(
    (choice: "light" | "video") => {
      setState((prev) => ({
        ...prev,
        vote: choice,
        acceptedLookId: choice === "light" ? "look-six-beam" : "look-video-drop",
        acceptedSuggestionId: choice === "light" ? "A-02" : "A-04",
      }));
      pushAudit({
        actor: "The room",
        action: "drop.voted",
        object: choice === "light" ? "look-six-beam" : "look-video-drop",
        detail: choice === "light" ? "The room chose the light drop." : "The room chose the video drop.",
        sources: ["audience"],
      });
      say(choice === "light" ? "Light drop committed" : "Video drop committed — SIGNAL BARS still missing");
    },
    [pushAudit, say],
  );

  const patchCue = useCallback(
    (id: string, patch: CuePatch) => {
      const cue = PACK.cues.find((c) => c.id === id);
      setState((prev) => ({ ...prev, cuePatches: { ...prev.cuePatches, [id]: { ...(prev.cuePatches[id] ?? {}), ...patch } } }));
      pushAudit({
        actor: "Mara Voss",
        action: "cue.edited",
        object: id,
        detail: `Cue ${id} edited: ${Object.entries(patch).map(([k, v]) => `${k} ${String(v)}`).join(", ")}${cue ? ` (${cue.title})` : ""}`,
        sources: ["cue-sheet"],
      });
      say(`Cue ${id} saved`);
    },
    [pushAudit, say],
  );

  const signCue = useCallback(
    (id: string) => {
      const at = new Date().toISOString();
      const actor = signOffName;
      setState((prev) => ({
        ...prev,
        signedCues: { ...prev.signedCues, [id]: { actor, at, signature: signatureFor(actor, at) } },
      }));
      pushAudit({ actor, action: "cue.signed", object: id, detail: `Safety sign-off recorded for ${id}.`, sources: ["human"] });
      call(`cues/${encodeURIComponent(id)}/sign`, { actor });
      say(`${id} signed off by ${actor}`);
    },
    [call, pushAudit, say, signOffName],
  );

  const signSafetyCues = useCallback(() => {
    const at = new Date().toISOString();
    const actor = signOffName;
    const safety = PACK.cues.filter((c) => c.safety);
    setState((prev) => {
      const signed = { ...prev.signedCues };
      for (const c of safety) {
        if (!signed[c.id]) signed[c.id] = { actor, at, signature: signatureFor(actor, at) };
      }
      return { ...prev, signedCues: signed };
    });
    pushAudit({ actor, action: "cue.sign_all", object: "cue-sheet", detail: `${safety.length} safety cues signed. No cue is released automatically.`, sources: ["human"] });
    say(`${safety.length} safety cues signed`);
  }, [pushAudit, say, signOffName]);

  const setRiskState = useCallback(
    (id: string, next: RiskState) => {
      setState((prev) => ({ ...prev, riskStates: { ...prev.riskStates, [id]: next } }));
    },
    [],
  );

  const acknowledgeRisk = useCallback(
    (id: string) => {
      setRiskState(id, "acknowledged");
      pushAudit({ actor: "Mara Voss", action: "risk.acknowledged", object: id, detail: "Acknowledged. The risk remains open until it is resolved and verified.", sources: ["human"] });
      say(`${id} acknowledged`);
    },
    [pushAudit, say, setRiskState],
  );

  const assignRisk = useCallback(
    (id: string, owner: string) => {
      setState((prev) => ({
        ...prev,
        riskStates: { ...prev.riskStates, [id]: "assigned" },
        riskOwners: { ...prev.riskOwners, [id]: owner },
      }));
      pushAudit({ actor: "Mara Voss", action: "risk.assigned", object: id, detail: `Assigned to ${owner}.`, sources: ["human"] });
      say(`${id} assigned to ${owner}`);
    },
    [pushAudit, say],
  );

  const investigateRisk = useCallback(
    (id: string) => {
      setRiskState(id, "investigating");
      pushAudit({ actor: "Mara Voss", action: "risk.investigating", object: id, detail: "Investigation opened.", sources: ["human"] });
      say(`${id} in investigation`);
    },
    [pushAudit, say, setRiskState],
  );

  const resolveRisk = useCallback(
    (id: string) => {
      setRiskState(id, "resolved");
      pushAudit({ actor: "Mara Voss", action: "risk.resolved", object: id, detail: "Marked resolved. It still needs a re-check before it leaves the show-week brief.", sources: ["human"] });
      say(`${id} resolved — verification still required`);
    },
    [pushAudit, say, setRiskState],
  );

  const verifyRisk = useCallback(
    (id: string) => {
      setRiskState(id, "resolved");
      pushAudit({ actor: "CUE readiness", action: "risk.verified", object: id, detail: "Re-check passed against the current venue, cue and asset data.", sources: ["readiness"] });
      say(`${id} verified and closed`);
    },
    [pushAudit, say, setRiskState],
  );

  const reopenRisk = useCallback(
    (id: string) => {
      setRiskState(id, "investigating");
      pushAudit({ actor: "Mara Voss", action: "risk.reopened", object: id, detail: "Risk reopened after a re-check.", sources: ["human"] });
      say(`${id} reopened`);
    },
    [pushAudit, say, setRiskState],
  );

  const dismissRisk = useCallback(
    (id: string, reason: string) => {
      setState((prev) => ({
        ...prev,
        riskStates: { ...prev.riskStates, [id]: "dismissed" },
        dismissalReasons: { ...prev.dismissalReasons, [id]: reason },
      }));
      pushAudit({ actor: "Mara Voss", action: "risk.dismissed", object: id, detail: `Dismissed: ${reason}`, sources: ["human"] });
      say(`${id} dismissed with a reason`);
    },
    [pushAudit, say],
  );

  const completeRiskCheck = useCallback(
    (riskId: string, checkId: string) => {
      setState((prev) => {
        const existing = prev.riskChecks[riskId] ?? [];
        return {
          ...prev,
          riskChecks: { ...prev.riskChecks, [riskId]: existing.includes(checkId) ? existing : [...existing, checkId] },
        };
      });
      pushAudit({ actor: "Mara Voss", action: "risk.check", object: riskId, detail: `Completed check ${checkId}.`, sources: ["human"] });
      say("Check completed");
    },
    [pushAudit, say],
  );

  const runReadinessCheck = useCallback(() => {
    const relevant = checks.filter((c) => ["power", "weight", "glare"].includes(c.id));
    const failing = relevant.filter((c) => c.status === "fail");
    if (failing.length === 0) {
      setState((prev) => {
        const riskStates = { ...prev.riskStates };
        for (const id of ["R-001", "R-002", "R-003"]) riskStates[id] = "resolved";
        return { ...prev, riskStates };
      });
      pushAudit({
        actor: "CUE readiness",
        action: "readiness.check",
        object: "tour",
        detail: "Re-check passed on power, weight and glare. Three risks marked resolved; verification is still required before the show-week brief clears them.",
        sources: ["rig", "venue", "sightline-model"],
      });
      for (const id of ["R-001", "R-002", "R-003"]) call(`readiness/${id}/resolve`, { actor: "CUE readiness", note: "Re-check passed." });
      say("Re-check passed — power, weight and glare resolved, verification pending");
    } else {
      pushAudit({
        actor: "CUE readiness",
        action: "readiness.check",
        object: "tour",
        detail: `Re-check still fails: ${failing.map((c) => c.id).join(", ")}.`,
        sources: ["rig", "venue", "sightline-model"],
      });
      say(`Re-check still fails on ${failing.map((c) => c.id).join(", ")}`);
    }
  }, [call, checks, pushAudit, say]);

  const refreshLive = useCallback(async () => {
    if (!liveRef.current) return;
    try {
      const response = await fetch(apiUrl("readiness"));
      if (!response.ok) return;
      const data = (await response.json()) as {
        risks?: { id: string; state: RiskState; owner: string; dismissedReason?: string; checks?: { id: string; done: boolean }[] }[];
      };
      if (!data.risks) return;
      setState((prev) => {
        const riskStates = { ...prev.riskStates };
        const riskOwners = { ...prev.riskOwners };
        const dismissalReasons = { ...prev.dismissalReasons };
        const riskChecks = { ...prev.riskChecks };
        for (const risk of data.risks ?? []) {
          riskStates[risk.id] = risk.state;
          riskOwners[risk.id] = risk.owner;
          if (risk.dismissedReason) dismissalReasons[risk.id] = risk.dismissedReason;
          riskChecks[risk.id] = (risk.checks ?? []).filter((c) => c.done).map((c) => c.id);
        }
        const extraRisks = (data.risks ?? []).filter((risk) => risk.id.startsWith("D-")) as unknown as ReadinessRisk[];
        return { ...prev, riskStates, riskOwners, dismissalReasons, riskChecks, extraRisks };
      });
    } catch {
      /* offline-first */
    }
  }, [apiUrl]);

  const approveVersion = useCallback(
    (id: string, actor: string, note: string) => {
      const at = new Date().toISOString();
      const approval: Approval = { actor, at, note, signature: signatureFor(actor, at) };
      setState((prev) => ({
        ...prev,
        versionApprovals: { ...prev.versionApprovals, [id]: approval },
        localVersions: prev.localVersions.map((v) => (v.id === id ? { ...v, status: "approved", approvedBy: actor, approvedAt: at, signature: approval.signature } : v)),
      }));
      pushAudit({ actor, action: "version.approved", object: id, detail: `Approved. ${note}`.trim(), sources: ["show"] });
      call(`versions/${id}/approve`, { actor, note });
      say(`Version ${id} approved — ${approval.signature}`);
    },
    [call, pushAudit, say],
  );

  const createVersion = useCallback(
    (label: string, note: string) => {
      const id = `v${versions.length + 1}`;
      const at = new Date().toISOString();
      const version: ShowVersion = {
        id,
        label,
        at,
        author: "Mara Voss",
        status: "draft",
        note,
        changes: [
          { kind: "look", detail: `Active look: ${activeLook.name}` },
          { kind: "cue", detail: `${cues.length} cues, ${Object.keys(state.signedCues).length} signed` },
          { kind: "budget", detail: `Approved budget ${budgetApproved}` },
        ],
      };
      setState((prev) => ({ ...prev, localVersions: [...prev.localVersions, version] }));
      pushAudit({ actor: "Mara Voss", action: "version.created", object: id, detail: note, sources: ["show"] });
      say(`${id} saved as a draft`);
      return id;
    },
    [activeLook.name, budgetApproved, cues.length, pushAudit, say, state.signedCues, versions.length],
  );

  const setBudgetApproved = useCallback(
    (value: number) => {
      setState((prev) => ({ ...prev, budgetApproved: Math.max(0, Math.round(value)) }));
      say(`Approved budget set to ${value.toLocaleString("en-IE")} EUR`);
    },
    [say],
  );

  const setReadinessMode = useCallback(
    (mode: "shadow" | "live") => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, mode } }));
      pushAudit({ actor: "Site Admin", action: "readiness.mode", object: "tour", detail: `Readiness mode set to ${mode}.`, sources: ["settings"] });
      say(mode === "shadow" ? "Shadow mode — risks stay internal" : "Live mode — risks can reach the production office");
    },
    [pushAudit, say],
  );

  const patchSettings = useCallback(
    (patch: Partial<ReadinessSettings>) => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
      say("Readiness settings saved");
    },
    [say],
  );

  const setStopSwitch = useCallback(
    (on: boolean, reason = "Stopped by the production office") => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, stopSwitch: on },
        stopReasons: on ? [...prev.stopReasons, `${new Date().toISOString()}: ${reason}`] : prev.stopReasons,
      }));
      pushAudit({ actor: "Site Admin", action: on ? "readiness.stop" : "readiness.start", object: "tour", detail: reason, sources: ["settings"] });
      say(on ? "Readiness stopped. The show and the cue sheet are unaffected." : "Readiness resumed");
    },
    [pushAudit, say],
  );

  const readNotification = useCallback((id: string) => {
    setState((prev) => ({ ...prev, notificationsRead: prev.notificationsRead.includes(id) ? prev.notificationsRead : [...prev.notificationsRead, id] }));
    call(`notifications/${id}/read`);
  }, [call]);

  const readAllNotifications = useCallback(() => {
    setState((prev) => ({ ...prev, notificationsRead: PACK.notifications.map((n) => n.id) }));
    call("notifications/read-all");
    say("All notifications read");
  }, [call, say]);

  const markBriefSeen = useCallback(() => setState((prev) => ({ ...prev, briefSeen: true })), []);

  const reset = useCallback(() => {
    setState({ ...EMPTY, settings: { ...PACK.readiness }, extraRisks: [] });
    say("Demo reset — the show is back to v5");
  }, [say]);

  const value = useMemo<StoreValue>(
    () => ({
      pack: PACK,
      loading: false,
      live,
      agentStatus,
      signOffName,
      rejectedLooks: state.rejectedLooks,
      acceptedLookId: state.acceptedLookId,
      rejectionReasons: state.rejectionReasons,
      vote: state.vote,
      ranked,
      activeLook,
      activeLookId,
      checks,
      cues,
      signedCues: state.signedCues,
      risks,
      openRisks,
      riskCounts,
      notifications,
      unread,
      settings: state.settings,
      stopReasons: state.stopReasons,
      audits: [...state.audits, ...PACK.audits].sort((a, b) => b.at.localeCompare(a.at)),
      versions,
      currentVersion,
      metrics: PACK.metrics,
      budgetApproved,
      briefSeen: state.briefSeen,
      nextDateId,
      activeSuggestion,
      acceptSuggestion,
      rejectSuggestion,
      selectLook,
      rejectLook,
      clearDrop,
      voteDrop,
      patchCue,
      signCue,
      signSafetyCues,
      acknowledgeRisk,
      assignRisk,
      investigateRisk,
      resolveRisk,
      verifyRisk,
      reopenRisk,
      dismissRisk,
      completeRiskCheck,
      runReadinessCheck,
      refreshLive,
      approveVersion,
      createVersion,
      setBudgetApproved,
      setReadinessMode,
      patchSettings,
      setStopSwitch,
      readNotification,
      readAllNotifications,
      markBriefSeen,
      reset,
      toast,
      say,
    }),
    [
      live, agentStatus, signOffName, state.rejectedLooks, state.acceptedLookId, state.rejectionReasons, state.vote,
      ranked, activeLook, activeLookId, checks, cues, state.signedCues, risks, openRisks, riskCounts, notifications, unread,
      state.settings, state.stopReasons, state.audits, versions, currentVersion, budgetApproved, state.briefSeen, nextDateId,
      activeSuggestion, acceptSuggestion, rejectSuggestion, selectLook, rejectLook, clearDrop, voteDrop, patchCue, signCue, signSafetyCues,
      acknowledgeRisk, assignRisk, investigateRisk, resolveRisk, verifyRisk, reopenRisk, dismissRisk, completeRiskCheck, runReadinessCheck, refreshLive,
      approveVersion, createVersion, setBudgetApproved, setReadinessMode, patchSettings, setStopSwitch, readNotification,
      readAllNotifications, markBriefSeen, reset, toast, say,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useCueLook(cue: Cue): Look | undefined {
  const { pack, rejectedLooks, acceptedLookId } = useStore();
  return effectiveLook(pack, cue.lookId, rejectedLooks, acceptedLookId);
}
