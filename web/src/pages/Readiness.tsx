import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import {
  daysUntil,
  downloadText,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtPct,
  fmtShortDate,
  riskOpen,
  riskSeverityRank,
  toCsv,
} from "../lib/engine";
import type { ReadinessRisk } from "../types";
import { Chip, Drawer, Meter, Modal, PageHead, Panel, RiskRow, SeverityChip, StateChip, Stat, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

const DISMISS_REASONS = [
  ["false_alarm", "False alarm — the evidence was wrong"],
  ["design_change", "Design change — the show was updated"],
  ["operational", "Operational — the crew handled it on site"],
  ["duplicate", "Duplicate — already covered by another risk"],
  ["no_action", "No action — accepted as designed"],
  ["data_error", "Data error — the source was wrong"],
];

const ROLE_USER: Record<string, string> = {
  designer: "Mara Voss",
  producer: "Jonas Reed",
  crew: "R. Okafor",
  tour_manager: "Priya Nair",
  admin: "",
};

function slaLabel(risk: ReadinessRisk, anchor: string): string {
  const hours = Math.round((new Date(risk.due).getTime() - new Date(anchor).getTime()) / 3_600_000);
  if (hours < 0) return `${Math.abs(hours)} h overdue`;
  if (hours < 48) return `${hours} h left`;
  return `${Math.round(hours / 24)} d left`;
}

export default function Readiness() {
  const store = useStore();
  const ui = useUI();
  const { pack, risks, openRisks, riskCounts, settings, audits } = store;
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("risk"));
  const [filter, setFilter] = useState<"open" | "critical" | "mine" | "all" | "closed">("open");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [briefOpen, setBriefOpen] = useState(params.get("brief") === "1");
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [dismissCategory, setDismissCategory] = useState("false_alarm");
  const [dismissNote, setDismissNote] = useState("");
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignOwner, setAssignOwner] = useState("Mara Voss");

  const roleName = ROLE_USER[ui.role] ?? "";
  const nextDate = pack.dates.find((d) => d.id === store.nextDateId) ?? pack.dates[0];
  const days = daysUntil(nextDate.show, pack.project.anchor);
  const selected = risks.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    const riskId = params.get("risk");
    if (riskId) setSelectedId(riskId);
    if (params.get("brief") === "1") setBriefOpen(true);
  }, [params]);

  const openDetail = (risk: ReadinessRisk) => {
    setSelectedId(risk.id);
    const p = new URLSearchParams(params);
    p.set("risk", risk.id);
    setParams(p, { replace: true });
  };
  const closeDetail = () => {
    setSelectedId(null);
    const p = new URLSearchParams(params);
    p.delete("risk");
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return risks
      .filter((r) => {
        const isOpen = riskOpen(r);
        if (filter === "open" && !isOpen) return false;
        if (filter === "closed" && isOpen) return false;
        if (filter === "critical" && (r.severity !== "critical" || !isOpen)) return false;
        if (filter === "mine" && (r.owner !== roleName || !isOpen)) return false;
        if (kind !== "all" && r.kind !== kind) return false;
        if (dateFilter !== "all" && r.dateId !== dateFilter) return false;
        if (!q) return true;
        return `${r.id} ${r.title} ${r.detail} ${r.owner} ${r.kind} ${r.whyNow}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (riskOpen(a) !== riskOpen(b)) return riskOpen(a) ? -1 : 1;
        return riskSeverityRank(a.severity) - riskSeverityRank(b.severity) || a.due.localeCompare(b.due);
      });
  }, [dateFilter, filter, kind, query, risks, roleName]);

  const groups = useMemo(() => {
    const open = filtered.filter(riskOpen);
    return [
      { key: "stop", label: "Stop-work · load-in depends on this", items: open.filter((r) => r.severity === "critical" || r.severity === "high") },
      { key: "week", label: "Show week · resolve or accept", items: open.filter((r) => r.severity === "medium") },
      { key: "watch", label: "Watch · low, but recorded", items: open.filter((r) => r.severity === "low" || r.severity === "info") },
      { key: "closed", label: "Closed · resolved or dismissed", items: filtered.filter((r) => !riskOpen(r)) },
    ].filter((g) => g.items.length > 0);
  }, [filtered]);

  const brief = useMemo(() => {
    const top = [...openRisks].sort((a, b) => riskSeverityRank(a.severity) - riskSeverityRank(b.severity)).slice(0, 5);
    const approvalsDue = [
      store.currentVersion.status !== "approved" ? `Show ${store.currentVersion.id} is ${store.currentVersion.status}.` : null,
      pack.cues.some((c) => c.safety && !store.signedCues[c.id]) ? `${pack.cues.filter((c) => c.safety && !store.signedCues[c.id]).length} safety cue(s) unsigned.` : null,
    ].filter(Boolean) as string[];
    const fixedNotVerified = risks.filter((r) => r.state === "resolved" && !r.verifiedAt);
    const stale = pack.venues.filter((v) => v.status !== "verified");
    return {
      title: `Show-week brief · ${nextDate.city} · ${fmtDate(nextDate.date)}`,
      summary: `${openRisks.length} open risks, ${riskCounts.critical} critical. ${days} days to load-in. ${fixedNotVerified.length} resolved but not verified.`,
      top,
      approvalsDue,
      fixedNotVerified,
      stale,
      coverage: stale.length
        ? `${stale.length} venue profile(s) outside the freshness contract: ${stale.map((v) => v.name).join(", ")}.`
        : "All venue profiles are inside the freshness contract.",
      generatedBy: "CUE readiness · shadow mode",
    };
  }, [days, nextDate, openRisks, pack.cues, pack.venues, riskCounts.critical, risks, store.currentVersion.id, store.currentVersion.status, store.signedCues]);

  const exportBrief = () => {
    const lines = [
      `# ${brief.title}`,
      "",
      brief.summary,
      "",
      "## Top risks",
      ...brief.top.map((r) => `- **${r.id} · ${r.title}** (${r.severity}, ${r.state}) — ${r.fix.label}. ${r.owner}. ${slaLabel(r, pack.project.anchor)}.`),
      "",
      "## Approvals due",
      ...(brief.approvalsDue.length ? brief.approvalsDue.map((a) => `- ${a}`) : ["- None."]),
      "",
      "## Fixed but not verified",
      ...(brief.fixedNotVerified.length ? brief.fixedNotVerified.map((r) => `- ${r.id} · ${r.title}`) : ["- None."]),
      "",
      "## Coverage",
      brief.coverage,
      "",
      "Recommendations only. No live control, no automatic cue release. Safety sign-off remains human.",
      "",
      `Generated by ${brief.generatedBy} at ${fmtDateTime(new Date().toISOString())}.`,
    ];
    downloadText(`show-week-brief-${nextDate.id}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  };

  const exportRisks = () => {
    const header = ["id", "kind", "severity", "state", "title", "owner", "due", "confidence", "fix", "cost_eur", "provenance"];
    const body = risks.map((r) => [r.id, r.kind, r.severity, r.state, r.title, r.owner, r.due, r.confidence, r.fix.label, r.fix.cost, r.provenance]);
    downloadText(`readiness-${pack.project.version}.csv`, toCsv([header, ...body]), "text/csv;charset=utf-8");
  };

  const performDismiss = () => {
    if (!dismissId) return;
    const reason = `${DISMISS_REASONS.find(([id]) => id === dismissCategory)?.[1] ?? dismissCategory}${dismissNote ? ` — ${dismissNote}` : ""}`;
    store.dismissRisk(dismissId, reason);
    setDismissId(null);
    setDismissNote("");
  };

  const performAssign = () => {
    if (!assignId) return;
    store.assignRisk(assignId, assignOwner);
    setAssignId(null);
  };

  const riskCountForDate = (dateId: string) => openRisks.filter((r) => r.dateId === dateId).length;

  const dismissedReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of risks) {
      if (r.state !== "dismissed" || !r.dismissedReason) continue;
      const key = r.dismissedReason.split(" — ")[0];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [risks]);

  return (
    <div>
      <PageHead
        kicker={`${pack.project.tour} · ${pack.project.version} · ${settings.mode} mode`}
        title={ui.t("readiness.title")}
        sub={ui.t("readiness.sub")}
        actions={
          <>
            <button className="btn" onClick={() => setBriefOpen(true)}><Icon name="file" size={13} /> {ui.t("readiness.show_week")}</button>
            <button className="btn" onClick={exportRisks}><Icon name="download" size={13} /> CSV</button>
            <Link to="/watch" className="btn"><Icon name="activity" size={13} /> Live watch</Link>
            <button className="btn primary" onClick={() => { setFilter("open"); store.runReadinessCheck(); }}><Icon name="refresh" size={13} /> Run check</button>
          </>
        }
      />

      <div className="tour-strip">
        <button className={`date-card${dateFilter === "all" ? " next" : ""}`} onClick={() => setDateFilter("all")} style={{ textAlign: "left" }}>
          <span className="city">All dates</span>
          <span className="when">{pack.dates.length} shows · {pack.project.leg}</span>
          <span className="venue">{riskCounts.open} open · {riskCounts.critical} critical</span>
        </button>
        {pack.dates.map((d) => {
          const venue = pack.venues.find((v) => v.id === d.venueId);
          return (
            <button key={d.id} className={`date-card${dateFilter === d.id ? " next" : ""}`} onClick={() => setDateFilter(dateFilter === d.id ? "all" : d.id)} style={{ textAlign: "left" }}>
              <span className="city">{d.city}</span>
              <span className="when">{fmtShortDate(d.date)} · {venue?.name}</span>
              <span className="venue">{venue?.stage.width} × {venue?.stage.depth} m · {venue?.power.kw} kW</span>
              <span className="flags">
                <Chip tone={riskCountForDate(d.id) > 0 ? "warn" : "ok"}>{riskCountForDate(d.id)} open</Chip>
                <Chip tone={d.status === "ready" ? "ok" : d.status === "at_risk" ? "warn" : "neutral"}>{d.status.replace("_", " ")}</Chip>
              </span>
            </button>
          );
        })}
      </div>

      <div className="stat-rail mb24">
        <Stat label="Open risks" value={riskCounts.open} unit={`/ ${risks.length}`} foot={`${riskCounts.critical} critical · ${riskCounts.high} high`} tone={riskCounts.critical ? "bad" : ""} />
        <Stat label="To load-in" value={days} unit="days" foot={`${nextDate.city} · ${fmtDate(nextDate.date)}`} />
        <Stat label="Precision" value={fmtPct(store.pack.metrics.precision)} foot="confirmed risks / raised · gate 0.80" tone="accent" />
        <Stat label="Cost exposure" value={fmtMoney(riskCounts.exposure)} foot="estimated fix cost, not spend" />
      </div>

      <div className="readiness-grid">
        <div>
          <Panel
            title="Risk board"
            sub={`${filtered.length} visible · deduplicated by ${new Set(risks.map((r) => r.groupKey)).size} group keys`}
            actions={<Chip tone={settings.stopSwitch ? "bad" : settings.mode === "shadow" ? "info" : "accent"} dot>{settings.stopSwitch ? "stopped" : `${settings.mode} mode`}</Chip>}
          >
            <div className="risk-filters">
              {(["open", "critical", "mine", "all", "closed"] as const).map((f) => (
                <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {f === "mine" ? `Mine${roleName ? ` (${roleName.split(" ")[0]})` : ""}` : f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="row gap8 mb12 wrap">
              <input className="input" style={{ maxWidth: 230 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search risks, owners, evidence…" aria-label="Search risks" />
              <select className="select" style={{ maxWidth: 130 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by kind">
                {["all", "power", "weight", "glare", "rights", "asset", "budget", "schedule", "data", "crew", "venue", "sightline"].map((k) => (
                  <option key={k} value={k}>{k === "all" ? "All kinds" : k}</option>
                ))}
              </select>
              <span className="xsmall soft">{dateFilter === "all" ? "All tour dates" : `Filtered to ${pack.dates.find((d) => d.id === dateFilter)?.city}`}</span>
            </div>

            {groups.map((group) => (
              <div key={group.key}>
                <div className="section-label"><span>{group.label}</span><span className="soft xsmall">{group.items.length}</span></div>
                <div className="risk-board">
                  {group.items.map((risk) => (
                    <RiskRow key={risk.id} risk={risk} onOpen={openDetail} selected={selectedId === risk.id} />
                  ))}
                </div>
              </div>
            ))}

            {groups.length === 0 && (
              <div className="empty">
                <div className="empty-icon"><Icon name="check" size={20} /></div>
                <h3>No risk matches this view</h3>
                <p>No action is a valid outcome. It is recorded, not hidden.</p>
              </div>
            )}
          </Panel>

          <Panel title="Risk quality and fatigue" sub="What the production office is actually getting" className="mt16">
            <div className="readiness-meters">
              <div className="col gap10">
                <Meter value={store.pack.metrics.precision} tone={store.pack.metrics.precision >= 0.8 ? "ok" : "warn"} label="Precision (gate 0.80)" right={fmtPct(store.pack.metrics.precision)} />
                <Meter value={store.pack.metrics.actionableRate} tone="accent" label="Actionable rate (gate 25%)" right={fmtPct(store.pack.metrics.actionableRate)} />
                <Meter value={store.pack.metrics.approvalOnTime} tone="ok" label="Approvals on time" right={fmtPct(store.pack.metrics.approvalOnTime)} />
              </div>
              <div className="col gap10">
                <Meter value={store.pack.metrics.risksPerWeek} max={12} tone="info" label="Risks per producer per week" right={`${store.pack.metrics.risksPerWeek}`} />
                <div className="row between small"><span className="soft">Deduplication</span><b className="mono">{risks.length} → {new Set(risks.map((r) => r.groupKey)).size}</b></div>
                <div className="row between small"><span className="soft">Dismissal reasons</span><b className="mono">{dismissedReasons.reduce((n, [, c]) => n + c, 0)} recorded</b></div>
              </div>
            </div>
            {dismissedReasons.length > 0 && (
              <div className="row gap4 wrap mt12">
                {dismissedReasons.map(([reason, count]) => <Chip key={reason} tone="rights">{reason} · {count}</Chip>)}
              </div>
            )}
            <p className="xsmall soft mt12">A false alarm is a cost. CUE tracks it per venue, tour and reason, and gives the producer a weekly cap with a digest fallback.</p>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title={ui.t("readiness.show_week")} sub={`${nextDate.city} · ${fmtDate(nextDate.date)} · ${days} days`} actions={<button className="btn sm ghost" onClick={() => setBriefOpen(true)}>Open</button>}>
            <p className="small muted">{brief.summary}</p>
            <div className="brief-list mt12">
              {brief.top.slice(0, 4).map((r) => (
                <button key={r.id} className="brief-item" onClick={() => openDetail(r)}>
                  <i style={{ background: r.severity === "critical" ? "var(--bad)" : "var(--warn)" }} />
                  <span><b>{r.title}</b><span>{r.id} · {r.owner} · {slaLabel(r, pack.project.anchor)}</span></span>
                </button>
              ))}
            </div>
            <div className="row between mt12">
              <span className="xsmall soft">{brief.approvalsDue.length} approvals due · {brief.fixedNotVerified.length} fixed, not verified</span>
              <button className="btn sm" onClick={exportBrief}><Icon name="download" size={11} /> MD</button>
            </div>
          </Panel>

          <Panel title="Readiness settings" sub="Recommendations only. No live control, no automatic cue release.">
            <div className="setting-row">
              <span className="label">Mode<span className="note">Shadow keeps risks internal until the producer validates them.</span></span>
              <div className="row gap4">
                <button className={`btn sm${settings.mode === "shadow" ? " primary" : " ghost"}`} onClick={() => store.setReadinessMode("shadow")}>Shadow</button>
                <button className={`btn sm${settings.mode === "live" ? " primary" : " ghost"}`} onClick={() => store.setReadinessMode("live")}>Live</button>
              </div>
            </div>
            <div className="setting-row">
              <span className="label">Kill switch<span className="note">Stops readiness only. The show and cue sheet are unaffected.</span></span>
              <Toggle on={settings.stopSwitch} onChange={(v) => store.setStopSwitch(v, v ? "Stopped from the readiness settings." : "Resumed from the readiness settings.")} label="Stop readiness" />
            </div>
            <div className="setting-row">
              <span className="label">Digest</span>
              <select className="select" style={{ maxWidth: 110 }} value={settings.digest} onChange={(e) => store.patchSettings({ digest: e.target.value as "daily" | "weekly" })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="setting-row">
              <span className="label">Quiet hours</span>
              <input className="input mono" style={{ maxWidth: 110 }} value={settings.quietHours} onChange={(e) => store.patchSettings({ quietHours: e.target.value })} />
            </div>
            <div className="setting-row">
              <span className="label">Risk budget<span className="note">Per producer per week. Above this, a digest replaces alerts.</span></span>
              <input className="input mono" style={{ maxWidth: 70 }} type="number" value={settings.maxRisksPerProducerWeek} onChange={(e) => store.patchSettings({ maxRisksPerProducerWeek: Number(e.target.value) })} />
            </div>
            <div className="setting-row">
              <span className="label">Coverage floor</span>
              <input className="input mono" style={{ maxWidth: 70 }} type="number" step="0.05" value={settings.coverageFloor} onChange={(e) => store.patchSettings({ coverageFloor: Number(e.target.value) })} />
            </div>
            <div className="setting-row">
              <span className="label">Channels<span className="note">Email · Slack · in-app · SMS for critical show-week only.</span></span>
              <div className="row gap4 wrap">
                {["in_app", "email", "slack", "sms"].map((c) => (
                  <button
                    key={c}
                    className={`btn sm${settings.channels.includes(c) ? " primary" : " ghost"}`}
                    onClick={() => store.patchSettings({ channels: settings.channels.includes(c) ? settings.channels.filter((x) => x !== c) : [...settings.channels, c] })}
                  >{c.replace("_", "-")}</button>
                ))}
              </div>
            </div>
            {store.stopReasons.length > 0 && (
              <div className="mt12">
                <span className="xsmall soft">Stop history</span>
                {store.stopReasons.map((r) => <div key={r} className="xsmall mono soft" style={{ marginTop: 3 }}>{r}</div>)}
              </div>
            )}
            <p className="xsmall soft mt12">The stop-all runbook: stop readiness, keep the show, notify the production office, record the reason, do not resume until the producer signs.</p>
          </Panel>

          <Panel title="Approvals due" sub={`${store.currentVersion.id} · ${store.currentVersion.status}`}>
            <div className="brief-list">
              <div className="brief-item"><i style={{ background: "var(--warn)" }} /><span><b>Producer sign-off — show {store.currentVersion.id}</b><span>{store.currentVersion.label} · {store.currentVersion.note}</span></span></div>
              <div className="brief-item"><i style={{ background: "var(--bad)" }} /><span><b>Safety cues unsigned</b><span>{pack.cues.filter((c) => c.safety && !store.signedCues[c.id]).length} cues: LX 7, LX 8, VID 4, CAM 1</span></span></div>
              <div className="brief-item"><i style={{ background: "var(--info)" }} /><span><b>Venue crew rig sign-off</b><span>{nextDate.city} · due before load-in</span></span></div>
            </div>
            <Link to="/versions" className="btn sm mt12">Open versions <Icon name="arrow" size={11} /></Link>
          </Panel>

          <Panel title="Coverage" sub={`floor ${fmtPct(settings.coverageFloor)}`}>
            <div className="col gap8">
              {pack.venues.map((v) => {
                const stale = v.status !== "verified";
                return (
                  <div key={v.id} className="row between small">
                    <span className="soft">{v.name} · {v.city}</span>
                    <Chip tone={stale ? "warn" : "ok"}>{stale ? v.status : "verified"}</Chip>
                  </div>
                );
              })}
            </div>
            <p className="xsmall soft mt12">Best effort. A blind spot is declared, never scored as safe. Last scan {fmtDateTime(pack.meta.generated)}.</p>
          </Panel>
        </aside>
      </div>

      <Drawer
        open={Boolean(selected)}
        title={selected ? `${selected.id} · ${selected.title}` : "Risk"}
        onClose={closeDetail}
        actions={
          selected && (
            <>
              {selected.state === "new" && <button className="btn" onClick={() => store.acknowledgeRisk(selected.id)}>Acknowledge</button>}
              {(selected.state === "new" || selected.state === "acknowledged" || selected.state === "assigned") && <button className="btn" onClick={() => store.investigateRisk(selected.id)}>Investigate</button>}
              {(selected.state === "acknowledged" || selected.state === "assigned") && <button className="btn" onClick={() => { setAssignId(selected.id); setAssignOwner(selected.owner); }}>Assign</button>}
              {(selected.state === "investigating" || selected.state === "assigned") && <button className="btn ok" onClick={() => store.resolveRisk(selected.id)}>Mark resolved</button>}
              {selected.state === "resolved" && !selected.verifiedAt && <button className="btn ok" onClick={() => store.verifyRisk(selected.id)}>Re-check and verify</button>}
              {!riskOpen(selected) && <button className="btn" onClick={() => store.reopenRisk(selected.id)}>Reopen</button>}
              {riskOpen(selected) && <button className="btn danger" onClick={() => { setDismissId(selected.id); setDismissCategory("false_alarm"); setDismissNote(""); }}>Dismiss</button>}
            </>
          )
        }
      >
        {selected && (
          <div className="risk-detail">
            <div className="row gap6 wrap mb12">
              <SeverityChip severity={selected.severity} />
              <StateChip state={selected.state} reason={selected.dismissedReason} />
              <Chip tone="info">{selected.kind}</Chip>
              <Chip>confidence {fmtPct(selected.confidence)}</Chip>
              {selected.groupKey && <Chip>group {selected.groupKey}</Chip>}
            </div>
            <p className="detail">{selected.detail}</p>

            <div className="risk-detail-grid">
              <div className="provenance-item"><span>Owner</span><b>{selected.owner} · {selected.role}</b></div>
              <div className="provenance-item"><span>Due</span><b>{fmtDateTime(selected.due)} · {slaLabel(selected, pack.project.anchor)}</b></div>
              <div className="provenance-item"><span>Date / venue</span><b>{pack.dates.find((d) => d.id === selected.dateId)?.city ?? "All dates"} · {pack.venues.find((v) => v.id === selected.venueId)?.name ?? "No venue"}</b></div>
              <div className="provenance-item"><span>Estimate</span><b>{selected.estimate}</b></div>
            </div>

            <div className="section-label"><span>Why now?</span></div>
            <p className="small muted">{selected.whyNow}</p>

            <div className="section-label"><span>Evidence</span><span className="soft xsmall">pinned to the source</span></div>
            <div className="col gap6">
              {selected.evidence.map((e) => (
                <div className="evidence-item" key={e.id}>
                  <b>{e.label}</b>
                  <span>{e.source} · {e.id}</span>
                </div>
              ))}
            </div>

            <div className="section-label"><span>Suggested check / fix</span></div>
            <div className="checklist">
              {selected.checks.map((c) => (
                <button key={c.id} className={c.done ? "done" : ""} onClick={() => store.completeRiskCheck(selected.id, c.id)}>
                  <span className="box">{c.done && <Icon name="check" size={10} />}</span>
                  <span>{c.label}{c.done && <span className="soft"> · done</span>}</span>
                </button>
              ))}
            </div>
            <div className="provenance-item mt12">
              <span>Recommended fix · {selected.fix.effort} · {fmtMoney(selected.fix.cost)}</span>
              <b>{selected.fix.label} — {selected.fix.owner}</b>
            </div>

            <div className="section-label"><span>Provenance</span></div>
            <p className="xsmall mono soft">{selected.provenance}</p>

            <div className="section-label"><span>History</span></div>
            <div className="risk-timeline">
              {selected.history.map((h, i) => (
                <div className="risk-event" key={`${h.at}-${i}`}>
                  <span className="at">{fmtDateTime(h.at)}</span>
                  <span><b>{h.actor}</b> · {h.action}<span className="mini-audit-note">{h.detail}</span></span>
                </div>
              ))}
              {selected.state === "resolved" && !selected.verifiedAt && (
                <div className="risk-event"><span className="at">next</span><span><b>Fixed but not verified</b><span className="mini-audit-note">Re-run the venue/cue/asset check before this leaves the show-week brief.</span></span></div>
              )}
            </div>

            <div className="section-label"><span>Create from this risk</span></div>
            <div className="row gap6 wrap">
              <button className="btn sm" onClick={() => store.say(`Review task created from ${selected.id} — owner ${selected.owner}`)}><Icon name="plus" size={11} /> Create review task</button>
              <button className="btn sm" onClick={() => store.say(`Approval requested from the producer for ${selected.id}`)}><Icon name="check" size={11} /> Request approval</button>
              <Link to={`/show?look=${selected.lookId ?? ""}`} className="btn sm"><Icon name="look" size={11} /> Open the look</Link>
              <Link to="/venues" className="btn sm"><Icon name="venue" size={11} /> Venue profile</Link>
            </div>

            <p className="xsmall soft mt12">
              CUE recommends. The producer, designer and venue crew decide. No live control, no automatic cue release, no automated safety sign-off.
            </p>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(dismissId)}
        title={`Dismiss ${dismissId ?? "risk"}`}
        onClose={() => setDismissId(null)}
        actions={
          <>
            <button className="btn" onClick={() => setDismissId(null)}>Cancel</button>
            <button className="btn danger" onClick={performDismiss}>Dismiss with reason</button>
          </>
        }
      >
        <p className="small muted">A dismissal is a recorded decision, not a delete. The reason taxonomy is visible in reporting.</p>
        <div className="field mt12">
          <label htmlFor="dismiss-reason">Reason category</label>
          <select id="dismiss-reason" className="select" value={dismissCategory} onChange={(e) => setDismissCategory(e.target.value)}>
            {DISMISS_REASONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="field mt12">
          <label htmlFor="dismiss-note">Note (optional)</label>
          <textarea id="dismiss-note" className="textarea" value={dismissNote} onChange={(e) => setDismissNote(e.target.value)} placeholder="What did you check? What would make this a real risk?" />
        </div>
      </Modal>

      <Modal
        open={Boolean(assignId)}
        title={`Assign ${assignId ?? "risk"}`}
        onClose={() => setAssignId(null)}
        actions={
          <>
            <button className="btn" onClick={() => setAssignId(null)}>Cancel</button>
            <button className="btn primary" onClick={performAssign}>Assign</button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="assign-owner">Owner</label>
          <select id="assign-owner" className="select" value={assignOwner} onChange={(e) => setAssignOwner(e.target.value)}>
            {pack.users.filter((u) => u.role !== "admin").map((u) => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
          </select>
        </div>
        <p className="xsmall soft mt12">Routing is by tour, venue and role. The owner gets a signed deep link; assignment does not change the show.</p>
      </Modal>

      <Modal
        open={briefOpen}
        title={brief.title}
        onClose={() => { setBriefOpen(false); store.markBriefSeen(); }}
        wide
        actions={
          <>
            <button className="btn" onClick={() => { setBriefOpen(false); store.markBriefSeen(); }}>Close</button>
            <button className="btn" onClick={exportBrief}><Icon name="download" size={12} /> Markdown</button>
            <Link to="/mobile" className="btn primary"><Icon name="mobile" size={12} /> Mobile card</Link>
          </>
        }
      >
        <div className="row gap8 wrap mb12">
          <Chip tone="accent">show week</Chip>
          <Chip>{days} days to load-in</Chip>
          <Chip tone="bad">{riskCounts.critical} critical</Chip>
          <Chip>{settings.mode} mode</Chip>
        </div>
        <p className="small muted">{brief.summary}</p>
        <div className="section-label"><span>Top risks</span></div>
        <div className="brief-list">
          {brief.top.map((r) => (
            <button key={r.id} className="brief-item" onClick={() => { setBriefOpen(false); openDetail(r); }}>
              <i style={{ background: r.severity === "critical" ? "var(--bad)" : "var(--warn)" }} />
              <span><b>{r.title}</b><span>{r.id} · {r.owner} · {slaLabel(r, pack.project.anchor)} · {r.fix.label}</span></span>
            </button>
          ))}
        </div>
        <div className="section-label"><span>Approvals due</span></div>
        <div className="brief-list">
          {brief.approvalsDue.length ? brief.approvalsDue.map((a) => <div className="brief-item" key={a}><i style={{ background: "var(--warn)" }} /><span><b>{a}</b></span></div>) : <div className="xsmall soft">None.</div>}
        </div>
        <div className="section-label"><span>Fixed but not verified</span></div>
        <div className="brief-list">
          {brief.fixedNotVerified.length ? brief.fixedNotVerified.map((r) => <div className="brief-item" key={r.id}><i style={{ background: "var(--info)" }} /><span><b>{r.title}</b><span>{r.id} · {r.owner}</span></span></div>) : <div className="xsmall soft">None.</div>}
        </div>
        <div className="section-label"><span>Coverage</span></div>
        <p className="small muted">{brief.coverage}</p>
        <p className="xsmall soft mt12">Generated by {brief.generatedBy}. Recommendations only; safety sign-off is human and never automated.</p>
      </Modal>

      <div className="section-label"><span>Audit</span><span className="soft xsmall">{audits.length} events</span></div>
      <Panel title="Readiness audit" sub="Append-only. Every acknowledgement, dismissal, export and verification.">
        <div className="mini-audit">
          {audits.slice(0, 12).map((a) => (
            <div key={a.id} className="mini-audit-row">
              <span className={`dot ${a.action.includes("risk") ? "warn" : ""}`} />
              <span><b>{a.actor}</b> {a.action} <span className="soft">{a.object}</span><span className="mini-audit-note">{a.detail}</span></span>
              <span className="xsmall soft mono">{fmtDateTime(a.at)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="row gap8 mt16 wrap">
        <button className="btn" onClick={() => setBriefOpen(true)}><Icon name="file" size={13} /> {ui.t("readiness.show_week")}</button>
        <Link to="/venues" className="btn"><Icon name="venue" size={13} /> Venue profiles</Link>
        <Link to="/pilot" className="btn"><Icon name="pilot" size={13} /> Pilot measurement</Link>
        <Link to="/admin" className="btn"><Icon name="admin" size={13} /> Governance</Link>
      </div>
    </div>
  );
}
