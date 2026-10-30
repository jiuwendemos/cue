import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import {
  checksFor,
  downloadText,
  fmtDate,
  fmtDateTime,
  fmtPct,
  riskOpen,
  riskSeverityRank,
  toCsv,
} from "../lib/engine";
import type { ReadinessRisk } from "../types";
import { Chip, PageHead, Panel, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

interface ApiScan {
  id: string;
  at: string;
  mode: string;
  checked: number;
  raised: number;
  suppressed: number;
  duration_ms: number;
  status: string;
  note: string;
}

interface ApiNotification {
  id: string;
  at: string;
  kind: string;
  severity: string;
  title: string;
  detail: string;
  risk_id?: string | null;
  channels: string[];
  delivered: boolean;
  read: boolean;
}

interface ApiWatcher {
  id: string;
  label: string;
  status: string;
  checked: number;
  open: number;
  last_scan: string | null;
}

interface ApiProactive {
  settings: Record<string, unknown>;
  scheduler: { enabled: boolean; interval_minutes: number; last_scan: string | null; next_scan: string | null; mode: string; stop_switch: boolean };
  watchers: ApiWatcher[];
  risks: ReadinessRisk[];
  stats: { open: number; critical: number; high: number; medium: number; low: number; resolved: number; dismissed: number; exposure: number };
  scans: ApiScan[];
  notifications: ApiNotification[];
  deliveries: { id: number; notification_id: string; channel: string; status: string; detail: string; at: string }[];
  queue: { pending: number; simulated: number; offline: boolean; detail: string };
  digest: { title: string; summary: string; markdown: string; at: string };
  backtest?: { rows: { city: string; detected: number; known: number; matched: number; precision_est: number; recall_est: number }[]; overall: Record<string, number>; note: string };
  coverage: { venue_id: string; name: string; status: string; last_verified: string; verified_by: string }[];
}

const WATCH_KINDS: { id: string; label: string; icon: string }[] = [
  { id: "venue", label: "Venue and stage", icon: "venue" },
  { id: "rig", label: "Rig and power", icon: "bolt" },
  { id: "rights", label: "Rights", icon: "rights" },
  { id: "asset", label: "Content delivery", icon: "film" },
  { id: "budget", label: "Budget", icon: "budget" },
  { id: "schedule", label: "Load-in and rehearsal", icon: "calendar" },
  { id: "data", label: "Venue data", icon: "refresh" },
];

function localBacktest(pack: ReturnType<typeof useStore>["pack"], lookId: string, risks: ReadinessRisk[]) {
  return pack.dates.map((date) => {
    const checks = checksFor(pack, lookId, date.venueId, date.id);
    const detected = checks.filter((c) => c.status !== "pass");
    const known = risks.filter((r) => r.dateId === date.id && riskOpen(r));
    const detectedKinds = new Set<string>(detected.map((c) => c.kind));
    const knownKinds = new Set<string>(known.map((r) => r.kind));
    const matched = [...detectedKinds].filter((k) => knownKinds.has(k)).length;
    return {
      city: date.city,
      detected: detected.length,
      known: known.length,
      matched,
      precision: detected.length ? matched / detected.length : 1,
      recall: known.length ? matched / known.length : 1,
    };
  });
}

export default function Watch() {
  const store = useStore();
  const ui = useUI();
  const [data, setData] = useState<ApiProactive | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState<ApiScan[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const risks = data?.risks ?? store.risks;
  const openRisks = risks.filter(riskOpen);
  const scans = data?.scans ?? scanLog;
  const settings = data?.settings ?? { mode: store.settings.mode, stopSwitch: store.settings.stopSwitch, intervalMinutes: 1440, channels: store.settings.channels, quietHours: store.settings.quietHours, digest: store.settings.digest };
  const interval = Number(settings.intervalMinutes ?? 1440);
  const mode = String(settings.mode ?? store.settings.mode);
  const stopped = Boolean(settings.stopSwitch ?? store.settings.stopSwitch);
  const notifications = data?.notifications ?? store.notifications.map((n) => ({
    id: n.id,
    at: n.at,
    kind: n.kind,
    severity: n.severity,
    title: n.title,
    detail: n.detail,
    risk_id: n.riskId,
    channels: [n.channel],
    delivered: true,
    read: n.read,
  }));

  const load = useCallback(async () => {
    if (!store.live) return;
    setLoading(true);
    try {
      const response = await fetch(new URL("api/proactive", document.baseURI).toString());
      if (response.ok) setData((await response.json()) as ApiProactive);
    } catch {
      /* the local view remains usable */
    } finally {
      setLoading(false);
    }
  }, [store.live]);

  useEffect(() => {
    void load();
    if (!store.live) return;
    const id = window.setInterval(() => {
      void load();
    }, 20000);
    return () => window.clearInterval(id);
  }, [load, store.live]);

  const watchers = data?.watchers ?? WATCH_KINDS.map((kind) => ({
    id: kind.id,
    label: kind.label,
    status: stopped ? "stopped" : "watching",
    checked: risks.length,
    open: openRisks.filter((r) => r.kind === kind.id).length,
    last_scan: scans[0]?.at ?? null,
  }));

  const scan = async () => {
    setScanning(true);
    setNote("");
    if (store.live) {
      try {
        const response = await fetch(new URL("api/proactive/scan", document.baseURI).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const body = (await response.json()) as { run?: ApiScan; digest?: { markdown?: string } };
        if (body.run) {
          setNote(body.run.note);
          await load();
          await store.refreshLive();
        }
      } catch {
        setNote("The on-site scan failed. The last scan is still visible.");
      }
    } else {
      store.runReadinessCheck();
      const local: ApiScan = {
        id: `LOCAL-${Date.now()}`,
        at: new Date().toISOString(),
        mode,
        checked: store.checks.length + risks.length,
        raised: 0,
        suppressed: risks.length,
        duration_ms: 12,
        status: "ok",
        note: "Deterministic local scan. The on-site build runs the durable scheduler.",
      };
      setScanLog((prev) => [local, ...prev].slice(0, 10));
      setNote(local.note);
    }
    setScanning(false);
  };

  const backtest = useMemo(() => (data ? null : localBacktest(store.pack, store.activeLookId, store.risks)), [data, store.activeLookId, store.pack, store.risks]);
  const top = [...openRisks].sort((a, b) => riskSeverityRank(a.severity) - riskSeverityRank(b.severity)).slice(0, 5);

  const digestMarkdown = data?.digest.markdown ?? [
    `# CUE readiness digest · ${store.pack.project.title}`,
    "",
    `${openRisks.length} open risks · ${openRisks.filter((r) => r.severity === "critical").length} critical · ${mode} mode`,
    "",
    "## Top risks",
    ...top.map((r) => `- **${r.id} · ${r.title}** — ${r.owner} · ${fmtDate(r.due)}`),
    "",
    "Recommendations only. No live control, no automatic cue release. Safety sign-off remains human.",
  ].join("\n");

  const setMode = async (next: "shadow" | "live") => {
    if (store.live) {
      await fetch(new URL("api/proactive/settings", document.baseURI).toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
      await load();
    } else {
      store.setReadinessMode(next);
    }
  };

  const toggleStop = async (on: boolean) => {
    if (store.live) {
      await fetch(new URL(`api/proactive/${on ? "stop" : "start"}`, document.baseURI).toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: on ? "Stopped from Show watch" : "" }) });
      await load();
    } else {
      store.setStopSwitch(on, on ? "Stopped from Show watch" : "Resumed from Show watch");
    }
  };

  const markRead = (id: string) => {
    if (store.live) {
      void fetch(new URL(`api/notifications/${encodeURIComponent(id)}/read`, document.baseURI).toString(), { method: "POST" }).then(load);
    } else {
      store.readNotification(id);
    }
  };

  const exportScanCsv = () => {
    const rows = [["id", "at", "mode", "checked", "raised", "suppressed", "status", "note"], ...scans.map((s) => [s.id, s.at, s.mode, s.checked, s.raised, s.suppressed, s.status, s.note])];
    downloadText("cue-watch-scans.csv", toCsv(rows), "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHead
        kicker={`${store.pack.project.tour} · ${store.live ? "on-site scheduler" : "deterministic local mode"}`}
        title="Show watch"
        sub="The production office's live readiness desk. It watches the tour, the venue, the cue, the rights, the assets and the budget before load-in. Recommendations only."
        actions={
          <>
            <button className="btn" onClick={() => { if (store.live) void load(); else setData(null); }} title="Refresh the view"><Icon name="refresh" size={13} /> {loading ? "Reading…" : "Refresh"}</button>
            <button className="btn primary" onClick={() => void scan()} disabled={scanning}><Icon name="activity" size={13} /> {scanning ? "Scanning…" : "Scan now"}</button>
            <Link to="/readiness" className="btn"><Icon name="readiness" size={13} /> Open the board</Link>
          </>
        }
      />

      <div className="watch-status">
        <div className="watch-status-cell">
          <span className="xsmall cap soft">Scheduler</span>
          <b className={stopped ? "bad" : "ok"}>{stopped ? "stopped" : data?.scheduler.enabled ? "running" : store.live ? "manual" : "local"}</b>
          <small>{data?.scheduler.enabled ? `every ${interval} min` : store.live ? "scan now only" : "deterministic stand-in"}</small>
        </div>
        <div className="watch-status-cell">
          <span className="xsmall cap soft">Last scan</span>
          <b className="mono">{scans[0] ? fmtDateTime(scans[0].at) : "—"}</b>
          <small>{scans[0]?.note ?? "no scan yet"}</small>
        </div>
        <div className="watch-status-cell">
          <span className="xsmall cap soft">Next scan</span>
          <b className="mono">{data?.scheduler.next_scan ? fmtDateTime(data.scheduler.next_scan) : store.live ? "—" : "manual"}</b>
          <small>{mode} mode · {openRisks.length} open</small>
        </div>
        <div className="watch-status-cell">
          <span className="xsmall cap soft">Queue</span>
          <b className={data?.queue.pending ? "warn" : "ok"}>{data ? data.queue.pending : 0} pending</b>
          <small>{data ? `${data.queue.simulated} simulated · ${data.queue.detail}` : "Local queue. A show-week outage retries on the next scan."}</small>
        </div>
      </div>

      {note && <div className="banner"><Icon name="check" size={14} /><span>{note}</span></div>}

      <div className="watch-grid">
        <div className="col gap16">
          <Panel
            title="Watchers"
            sub={`${watchers.length} objects · ${openRisks.length} open · ${stopped ? "all stopped" : "watching"}`}
            actions={<Chip tone={stopped ? "bad" : "ok"} dot>{stopped ? "stopped" : "live"}</Chip>}
          >
            <div className="watcher-grid">
              {watchers.map((w) => {
                const icon = WATCH_KINDS.find((k) => k.id === w.id)?.icon ?? "activity";
                return (
                  <div key={w.id} className={`watcher-card${w.open ? " has-risk" : ""}`}>
                    <div className="row between">
                      <Icon name={icon} size={16} />
                      <Chip tone={w.open ? "warn" : "ok"}>{w.open} open</Chip>
                    </div>
                    <b>{w.label}</b>
                    <span>{w.status} · checked {w.checked}</span>
                    <small>{w.last_scan ? `last ${fmtDateTime(w.last_scan)}` : "not scanned"}</small>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="What changed" sub="New, grouped and suppressed by the scanner" actions={<button className="btn sm ghost" onClick={exportScanCsv}><Icon name="download" size={11} /> CSV</button>}>
            <div className="scan-list">
              {scans.length === 0 && <div className="empty"><div className="empty-icon"><Icon name="activity" size={20} /></div><h3>No scan yet</h3><p>Run a scan or start the on-site scheduler.</p></div>}
              {scans.slice(0, 8).map((s) => (
                <div key={s.id} className="scan-row">
                  <span className={`dot ${s.status === "ok" ? "live" : "warn"}`} />
                  <span>
                    <b className="mono">{s.mode} · {s.checked} checked</b>
                    <span>{s.note}</span>
                  </span>
                  <span className="scan-meta">
                    <b>{s.raised} new</b>
                    <span>{s.suppressed} known · {s.duration_ms} ms</span>
                  </span>
                  <span className="xsmall mono soft">{fmtDateTime(s.at)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Backtest" sub="Would this have fired before the load-in?">
            {data ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Detected</th><th>Known</th><th>Matched</th><th>Precision</th><th>Recall</th></tr></thead>
                  <tbody>
                    {(data.backtest?.rows ?? []).map((r) => (
                      <tr key={r.city}><td>{r.city}</td><td>{r.detected}</td><td>{r.known}</td><td>{r.matched}</td><td>{fmtPct(r.precision_est)}</td><td>{fmtPct(r.recall_est)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="xsmall soft mt8">{data.backtest?.note ?? "The live API exposes the backtest at /api/proactive/backtest."}</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Detected</th><th>Known</th><th>Matched</th><th>Precision</th><th>Recall</th></tr></thead>
                  <tbody>
                    {backtest?.map((r) => (
                      <tr key={r.city}><td>{r.city}</td><td>{r.detected}</td><td>{r.known}</td><td>{r.matched}</td><td>{fmtPct(r.precision)}</td><td>{fmtPct(r.recall)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="xsmall soft mt8">Synthetic backtest over the demo pack. A real backtest uses past tours and confirmed issues. The on-site API returns a richer version.</p>
              </div>
            )}
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="The dial" sub="Shadow first. Live only after the producer validates the first N.">
            <div className="setting-row">
              <span className="label">Mode<span className="note">Shadow keeps risks internal. Live can reach the production office.</span></span>
              <div className="row gap4">
                <button className={`btn sm${mode === "shadow" ? " primary" : " ghost"}`} onClick={() => void setMode("shadow")}>Shadow</button>
                <button className={`btn sm${mode === "live" ? " primary" : " ghost"}`} onClick={() => void setMode("live")}>Live</button>
              </div>
            </div>
            <div className="setting-row">
              <span className="label">Kill switch<span className="note">Stops readiness only. The show and cue sheet stay available.</span></span>
              <Toggle on={stopped} onChange={(v) => void toggleStop(v)} label="Stop readiness" />
            </div>
            <div className="setting-row">
              <span className="label">Interval</span>
              <span className="mono xsmall">{interval} min</span>
            </div>
            <div className="setting-row">
              <span className="label">Channels</span>
              <div className="row gap3 wrap">
                {(Array.isArray(settings.channels) ? (settings.channels as string[]) : store.settings.channels).map((c) => <Chip key={c}>{c}</Chip>)}
              </div>
            </div>
            <div className="row gap6 mt12 wrap">
              <Link to="/readiness?brief=1" className="btn sm"><Icon name="file" size={11} /> Show-week brief</Link>
              <button className="btn sm" onClick={() => downloadText("cue-watch-digest.md", digestMarkdown, "text/markdown;charset=utf-8")}><Icon name="download" size={11} /> Digest MD</button>
            </div>
          </Panel>

          <Panel title="Delivery" sub={store.live ? "Real channels when configured, simulated otherwise" : "Static demo: channels are modelled"}>
            <div className="col gap6">
              {(Array.isArray(settings.channels) ? (settings.channels as string[]) : store.settings.channels).map((channel) => {
                const delivery = data?.deliveries.find((d) => d.channel === channel);
                return (
                  <div key={channel} className="row between small">
                    <span><b>{channel}</b> <span className="soft">· {delivery?.status ?? "simulated"}</span></span>
                    <Chip tone={delivery?.status === "delivered" ? "ok" : "warn"}>{delivery?.status ?? "ready"}</Chip>
                  </div>
                );
              })}
              {data?.deliveries.slice(0, 3).map((d) => <div key={d.id} className="xsmall mono soft">{d.channel} · {d.status} · {d.detail.slice(0, 70)}</div>)}
            </div>
            <p className="xsmall soft mt12">Email, Slack, Teams, SMS and a signed webhook use the environment. A missing credential is recorded as <b>simulated</b>, never a silent success.</p>
          </Panel>

          <Panel title="Inbox" sub={`${notifications.filter((n) => !n.read).length} unread`}>
            <div className="inbox">
              {notifications.slice(0, 6).map((n) => (
                <button key={n.id} className={`inbox-row${n.read ? "" : " unread"}`} onClick={() => markRead(n.id)}>
                  <span className="dot" />
                  <span><b>{n.title}</b><span className="inbox-detail">{n.detail}</span><span className="inbox-meta mono">{n.channels.join(" · ")} · {fmtDateTime(n.at)}</span></span>
                  <Icon name="chevron" size={12} />
                </button>
              ))}
            </div>
            <button className="btn sm mt12" onClick={() => { if (store.live) void fetch(new URL("api/notifications/read-all", document.baseURI).toString(), { method: "POST" }).then(load); else store.readAllNotifications(); }}>Mark all read</button>
          </Panel>

          <Panel title="Coverage" sub={`${store.pack.venues.length} venues · floor ${fmtPct(store.settings.coverageFloor)}`}>
            <div className="col gap6">
              {(data?.coverage ?? store.pack.venues.map((v) => ({ venue_id: v.id, name: v.name, status: v.status, last_verified: v.lastVerified, verified_by: v.verifiedBy }))).map((v) => (
                <div key={v.venue_id} className="row between small">
                  <span className="soft">{v.name} · {fmtDate(v.last_verified)}</span>
                  <Chip tone={v.status === "verified" ? "ok" : "warn"}>{v.status}</Chip>
                </div>
              ))}
            </div>
            <p className="xsmall soft mt12">A blind spot is declared, never scored as safe. Freshness contract: 12 months.</p>
          </Panel>

          <Panel title="Agent sidecar" sub="It reads the current show and open risks before it speaks.">
            <p className="small muted">The agent proposes a check when the evidence changes. It never changes a cue, signs safety or releases the show.</p>
            <Link to="/agent" className="btn sm mt12"><Icon name="agent" size={11} /> Open the agent</Link>
          </Panel>
        </aside>
      </div>

      <p className="xsmall soft mt16">
        {ui.showDemoNotices ? "Synthetic show. " : ""}The public build uses a deterministic local scan. The on-site build runs the durable scheduler, the tenant store, the delivery channels and the signed links. No live control, no automatic cue release.
      </p>
    </div>
  );
}
