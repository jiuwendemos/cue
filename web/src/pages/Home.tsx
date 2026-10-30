import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { daysUntil, downloadText, fmtDate, fmtMoney, fmtPct, fmtShortDate, songAt, timeAgo } from "../lib/engine";
import { showPosterSvg } from "../lib/poster";
import { Donut, Meter, PageHead, Panel, Sparkline } from "../components/UI";
import { StageCanvas } from "../components/StageCanvas";
import { Icon } from "../components/Icon";
import { MOOD } from "../data/mood";

export default function Home() {
  const store = useStore();
  const ui = useUI();
  const navigate = useNavigate();
  const { pack, activeLook, risks, openRisks, riskCounts, metrics, nextDateId, audits } = store;
  const next = pack.dates.find((d) => d.id === nextDateId) ?? pack.dates[0];
  const venue = pack.venues.find((v) => v.id === next.venueId);
  const days = daysUntil(next.show, pack.project.anchor);
  const stageTime = 236;
  const song = songAt(pack, stageTime);

  const decisions = useMemo(() => {
    const roleKinds: Record<string, string[]> = {
      designer: ["power", "weight", "glare", "asset"],
      producer: ["budget", "rights", "crew"],
      crew: ["power", "weight", "sightline", "venue"],
      tour_manager: ["schedule", "venue", "crew", "data", "asset"],
      admin: ["data", "rights", "budget"],
    };
    const kinds = roleKinds[ui.role] ?? [];
    return openRisks
      .filter((r) => kinds.includes(r.kind) || r.severity === "critical")
      .slice(0, 4);
  }, [openRisks, ui.role]);

  return (
    <div>
      <PageHead
        kicker={`${pack.project.tour} · ${pack.project.leg}`}
        title="Now"
        actions={
          <>
            <Link to="/show" className="btn primary"><Icon name="stage" size={14} /> {ui.t("home.open_show")}</Link>
            <Link to="/stage" className="btn"><Icon name="play" size={13} /> {ui.t("home.play_stage")}</Link>
            <button className="btn ghost" onClick={() => downloadText("night-signal-poster.svg", showPosterSvg(pack), "image/svg+xml")} title="Download the show poster as SVG">
              <Icon name="download" size={13} /> Poster
            </button>
            <Link to="/booth" className="btn ghost"><Icon name="shows" size={13} /> {ui.t("nav.booth")}</Link>
          </>
        }
      />

      <div className="poster-hero">
        <div className="poster-copy">
          <div className="poster-meta">
            <span>NOVA VALE</span>
            <span className="dot" />
            <span>EUROPEAN TOUR 2026</span>
            <span className="dot" />
            <span>SHOW {pack.project.version}</span>
          </div>
          <h1 className="poster-title">
            NIGHT<br /><em>SIGNAL</em>
          </h1>
          <p className="poster-line">The show is designed before the lights go down.</p>
          <p className="poster-lead">
            One workspace for the stage, the looks, the video, the blocking, the cues and the budget.
            The designer authors; CUE proposes and checks.
          </p>
          <div className="poster-actions">
            <Link to="/show?tab=looks" className="btn primary lg"><Icon name="look" size={15} /> Find the drop</Link>
            <Link to="/readiness?brief=1" className="btn lg"><Icon name="readiness" size={15} /> {riskCounts.open} things on the desk</Link>
          </div>

          <div className="poster-setlist">
            <span className="xsmall cap soft">The set</span>
            {pack.setlist.map((s, i) => (
              <div className="song-row" key={s.id}>
                <span className="song-num mono">0{i + 1}</span>
                <span className="song-name">{s.title}</span>
                <span className="song-time mono">{Math.floor(s.start / 60)}:{String(s.start % 60).padStart(2, "0")}–{Math.floor(s.end / 60)}:{String(s.end % 60).padStart(2, "0")}</span>
                <span className="energy-bar" aria-label={`energy ${Math.round(s.energyEnd * 100)} percent`}>
                  <i style={{ width: `${s.energyEnd * 100}%` }} />
                </span>
              </div>
            ))}
            <span className="xsmall soft">7:20 · three songs · one drop at 3:45 · one lamp at 0:06</span>
          </div>
        </div>

        <div className="poster-stage">
          <div className="poster-stage-head">
            <span className="tag">PREVIZ · {fmtClockShort(stageTime)} · {song?.title}</span>
            <span className="tag">{activeLook.name}</span>
          </div>
          <div className="stage-tease">
            <StageCanvas pack={pack} look={activeLook} time={stageTime} layer="all" showGlare={activeLook.audienceAim > 0} showLabels={false} />
            <Link to="/stage" className="btn primary stage-tease-play" aria-label="Play the 90-second show">
              <Icon name="play" size={14} /> Play the 90 seconds
            </Link>
          </div>
          <div className="poster-caption">
            <span>The rig is wrong here. That is the point.</span>
            <Link to="/show" className="accent">Open the studio →</Link>
          </div>
        </div>
      </div>

      <div className="studio-ledger">
        {[
          ["Time to first look", `${metrics.timeToFirstLook}s`, "standing start"],
          ["Previz iterations", `${metrics.previzIterations} / ${metrics.baselineIterations}`, "before approval"],
          ["Rig cost avoided", fmtMoney(metrics.rigCostAvoided), "caught before load-in"],
          ["Cue changes", `${metrics.cueChanges} / show`, "baseline 17"],
          ["Readiness precision", fmtPct(metrics.precision), "gate 0.80"],
        ].map(([label, value, foot]) => (
          <div className="ledger-item" key={label}>
            <span>{label}</span>
            <b>{value}</b>
            <small>{foot}</small>
          </div>
        ))}
      </div>

      <div className="studio-grid">
        <div>
          <div className="section-label"><span>On the desk</span><Link to="/readiness" className="xsmall accent">All of it →</Link></div>
          <div className="desk-list">
            {decisions.map((risk, i) => (
              <button key={risk.id} className="desk-row" onClick={() => navigate(`/readiness?risk=${risk.id}`)}>
                <span className={`desk-num ${risk.severity}`}>0{i + 1}</span>
                <span className="desk-main">
                  <span className="kind">{risk.kind} · {risk.id} · {risk.owner}</span>
                  <h3>{risk.title}</h3>
                  <p>{risk.detail}</p>
                </span>
                <span className="desk-meta">
                  <b>{fmtShortDate(risk.due)}</b>
                  <span>{risk.state.replace("_", " ")}</span>
                </span>
              </button>
            ))}
            <button className="desk-row" onClick={() => navigate("/versions")}>
              <span className="desk-num high">05</span>
              <span className="desk-main">
                <span className="kind">approval · show v5</span>
                <h3>Producer sign-off on the show version</h3>
                <p>The designer signed the cue sheet. The producer has not approved v5, and the safety cues wait for the venue crew.</p>
              </span>
              <span className="desk-meta"><b>v5</b><span>in review</span></span>
            </button>
          </div>

          <div className="section-label"><span>Moodboard</span><span className="soft xsmall">the references behind the show</span></div>
          <div className="moodboard">
            {MOOD.map((m, i) => (
              <div className="mood-card" key={m.ref} style={{ transform: `rotate(${i % 2 === 0 ? -1.1 : 1.2}deg)` }}>
                <div className="mood-art" style={{ background: `radial-gradient(120% 100% at 20% 10%, ${m.from}, ${m.via} 42%, ${m.to} 80%)` }}>
                  <span className="mood-grain" />
                  <span className="mood-index mono">REF 0{i + 1}</span>
                </div>
                <b>{m.ref}</b>
                <span>{m.note}</span>
              </div>
            ))}
          </div>

          <div className="section-label"><span>The rules</span><span className="soft xsmall">concept v3</span></div>
          <div className="concept-rules">
            {pack.concept.rules.map((r, i) => (
              <div className="rule-row" key={r}><span className="mono">{String(i + 1).padStart(2, "0")}</span><p>{r}</p></div>
            ))}
          </div>
        </div>

        <aside className="col gap18">
          <div className="ticket">
            <div className="ticket-head">
              <span className="xsmall mono">ADMIT ONE · {pack.project.version}</span>
              <span className={`ticket-stamp ${next.status}`}>{next.status.replace("_", " ")}</span>
            </div>
            <div className="ticket-body">
              <span className="xsmall cap soft">{days} days to load-in</span>
              <h3>{next.city}</h3>
              <span className="ticket-venue">{venue?.name}</span>
              <div className="ticket-grid">
                <span><b>{fmtDate(next.date)}</b>show</span>
                <span><b>{venue?.loadInHours} h</b>load-in</span>
                <span><b>{venue?.power.kw} kW</b>supply</span>
                <span><b>{venue?.rigCapacityKg} kg</b>venue rig</span>
              </div>
              <div className="row gap6 mt12">
                <Link to="/venues" className="btn sm">Venue</Link>
                <Link to="/readiness?brief=1" className="btn sm">Brief</Link>
              </div>
            </div>
            <div className="ticket-perf" />
            <div className="ticket-foot">
              <span>NOVA VALE · NIGHT SIGNAL</span>
              <span className="mono">SHOW {pack.project.version}</span>
            </div>
          </div>

          <div className="trust-mini">
            <span className="xsmall cap soft">The trust beat</span>
            <div className="trust-pair">
              <div>
                <span className="tag">AI 01</span>
                <b>AERIAL 12</b>
                <span className="xsmall soft">97 impact · 44.1 kW · 564 kg</span>
                <span className="trust-cross">REJECTED</span>
              </div>
              <span className="trust-arrow">→</span>
              <div>
                <span className="tag">AI 02</span>
                <b>SIX BEAM</b>
                <span className="xsmall soft">89 impact · 34.5 kW · 312 kg</span>
                <span className="trust-tick">LANDS</span>
              </div>
            </div>
            <p>“It was spectacular. It was wrong. The show is not the rig.”</p>
          </div>

          <Panel title="Readiness" sub={`${next.city} · ${fmtDate(next.date)}`} actions={<Link to="/readiness" className="btn sm ghost">Board</Link>}>
            <div className="readiness-meters">
              <Donut value={metrics.precision} label="precision" size={78} tone="var(--accent)" />
              <div className="col gap6">
                <Meter value={riskCounts.open} max={Math.max(1, risks.length)} tone="warn" label="Open" right={`${riskCounts.open}`} />
                <Meter value={riskCounts.critical} max={Math.max(1, riskCounts.open)} tone="bad" label="Critical" right={`${riskCounts.critical}`} />
                <Meter value={metrics.approvalOnTime} tone="ok" label="On time" right={fmtPct(metrics.approvalOnTime)} />
              </div>
            </div>
            <div className="brief-list mt12">
              {openRisks.slice(0, 3).map((r) => (
                <button key={r.id} className="brief-item" onClick={() => navigate(`/readiness?risk=${r.id}`)}>
                  <i style={{ background: r.severity === "critical" ? "var(--bad)" : r.severity === "high" ? "var(--warn)" : "var(--info)" }} />
                  <span><b>{r.title}</b><span>{r.id} · {r.owner}</span></span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="The week" sub="studio ledger">
            <div className="weekly-row">
              {metrics.weekly.slice(-6).map((w, i) => (
                <div key={w.week} className="weekly-cell">
                  <span className="xsmall mono soft">{w.week}</span>
                  <Sparkline values={metrics.weekly.map((x) => x.iterations)} width={70} height={24} color={i === 5 ? "var(--accent)" : "var(--soft)"} fill={false} />
                  <b className="mono">{w.iterations}</b>
                  <span className="xsmall soft">iter.</span>
                </div>
              ))}
            </div>
            <div className="row between mt12"><span className="xsmall soft">Last activity</span><span className="xsmall mono soft">{timeAgo(audits[0]?.at)}</span></div>
            <p className="xsmall muted mt8">{audits[0]?.detail}</p>
          </Panel>
        </aside>
      </div>

      <div className="section-label"><span>The studio</span><span className="soft xsmall">three ways in</span></div>
      <div className="booth-grid">
        {[
          { id: "0A", title: "The 90-second show", detail: "One lamp, one unsafe idea, one human decision. Press R to reset.", to: "/stage", label: "Play", icon: "play" },
          { id: "0B", title: "The studio", detail: "Stage, looks, video, blocking, cues, budget and the checks. Drag a look onto the build.", to: "/show", label: "Open the studio", icon: "stage" },
          { id: "P1", title: "The pilot", detail: "One promised tour, 90 days, measured: iterations, cue changes, cost avoided, rehearsal time.", to: "/pilot", label: "Pilot dashboard", icon: "pilot" },
        ].map((c) => (
          <div key={c.id} className="booth-card">
            <span className="num">{c.id}</span>
            <h3>{c.title}</h3>
            <p>{c.detail}</p>
            <div className="foot">
              <Link to={c.to} className="btn sm"><Icon name={c.icon} size={12} /> {c.label}</Link>
            </div>
          </div>
        ))}
      </div>

      {ui.showDemoNotices && (
        <p className="xsmall soft mt24">
          This is a synthetic show. Nova Vale, the venues, the crew and the pilot numbers are invented; the math, the cue sheet and the readiness lifecycle are real code over a fixed pack.
          {" "}<Link to="/provenance" className="accent">What is real →</Link>
          {" · "}Hide this note in Studio settings (the gear).
        </p>
      )}
    </div>
  );
}

function fmtClockShort(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
