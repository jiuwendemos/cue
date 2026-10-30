import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import {
  checkSummary,
  dataFreshnessCheck,
  fmtDate,
  fmtMoney,
  lookStats,
  sightlineCheck,
  venueFitCheck,
} from "../lib/engine";
import type { Venue } from "../types";
import { CheckChip, Chip, Meter, PageHead, Panel, Stat } from "../components/UI";
import { Icon } from "../components/Icon";

function VenuePlan({ venue, design }: { venue: Venue; design: { width: number; depth: number } }) {
  const scale = 260 / Math.max(venue.stage.width, venue.stage.depth);
  const w = venue.stage.width * scale;
  const d = venue.stage.depth * scale;
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={`${venue.name} stage plan`}>
      <rect x="20" y="10" width={w} height={d} fill="none" stroke="var(--line-2)" strokeWidth="1" />
      <rect x={20 + w / 2 - 30} y="12" width="60" height="4" fill="var(--accent)" opacity="0.5" />
      <rect x={20 + w / 2 - 8} y={10 + d * 0.35} width="16" height="12" fill="var(--surface-3)" stroke="var(--line)" />
      <line x1={20 + w / 2} y1={10 + d} x2={20 + w / 2} y2={10 + d + 20} stroke="var(--soft)" strokeDasharray="3 3" />
      <text x={20} y={d + 28} fill="var(--soft)" fontSize="7" fontFamily="var(--font-mono)">STAGE {venue.stage.width} × {venue.stage.depth} m</text>
      <text x={20 + w + 6} y={18} fill="var(--soft)" fontSize="7" fontFamily="var(--font-mono)">DESIGN {design.width} × {design.depth}</text>
      <rect x="20" y="10" width={Math.min(w, design.width * scale)} height={Math.min(d, design.depth * scale)} fill="var(--accent)" opacity="0.05" />
    </svg>
  );
}

export default function Venues() {
  const store = useStore();
  const ui = useUI();
  const { pack, activeLook } = store;
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(params.get("venue") ?? pack.project.venueId);
  const selected = pack.venues.find((v) => v.id === selectedId) ?? pack.venues[0];
  const stats = useMemo(() => lookStats(pack, activeLook), [activeLook, pack]);

  useEffect(() => {
    const id = params.get("venue");
    if (id && pack.venues.some((v) => v.id === id)) setSelectedId(id);
  }, [pack.venues, params]);

  const select = (v: Venue) => {
    setSelectedId(v.id);
    const p = new URLSearchParams(params);
    p.set("venue", v.id);
    setParams(p, { replace: true });
  };

  const fit = venueFitCheck(pack, selected.id);
  const freshness = dataFreshnessCheck(pack, selected.id);
  const sight = sightlineCheck(pack, selected.id);
  const checks = [fit, freshness, sight];
  const summary = checkSummary(checks);
  const date = pack.dates.find((d) => d.venueId === selected.id);
  const powerHeadroom = selected.power.kw - stats.powerKw;
  const weightHeadroom = selected.rigCapacityKg - stats.frontKg;

  return (
    <div>
      <PageHead
        kicker={`${pack.project.tour} · venue library`}
        title="Venues"
        sub="One design, seven rooms. Every venue carries its own stage, rig, power, sightline and freshness record. CUE does not assume a room is the same."
        actions={
          <>
            <Link to="/readiness" className="btn"><Icon name="readiness" size={13} /> Readiness</Link>
            <button className="btn" onClick={() => store.say(`Venue profile verification requested for ${selected.name}`)}><Icon name="refresh" size={13} /> Verify profile</button>
          </>
        }
      />

      <div className="stat-rail mb24">
        <Stat label="Selected venue" value={selected.city} foot={`${selected.name} · ${selected.capacity} cap`} />
        <Stat label="Stage" value={`${selected.stage.width} × ${selected.stage.depth}`} unit="m" foot={`${selected.stage.trim} m trim · design ${pack.stage.width} × ${pack.stage.depth} m / ${pack.stage.trim} m`} />
        <Stat label="Power headroom" value={`${powerHeadroom.toFixed(1)}`} unit="kW" foot={`${stats.powerKw.toFixed(1)} kW look / ${selected.power.kw} kW supply`} tone={powerHeadroom < 0 ? "bad" : ""} />
        <Stat label="Rig headroom" value={`${weightHeadroom}`} unit="kg" foot={`${stats.frontKg} kg front / ${selected.rigCapacityKg} kg venue`} tone={weightHeadroom < 0 ? "bad" : ""} />
      </div>

      <div className="venue-grid mb24">
        {pack.venues.map((v) => {
          const d = pack.dates.find((x) => x.venueId === v.id);
          const current = v.id === selected.id;
          return (
            <button key={v.id} className={`venue-card${current ? " current" : ""}`} onClick={() => select(v)} style={{ textAlign: "left", font: "inherit" }}>
              <div className="row between">
                <div>
                  <h3>{v.name}</h3>
                  <span className="city">{v.city}, {v.country} · {v.capacity} cap</span>
                </div>
                <Chip tone={v.status === "verified" ? "ok" : v.status === "stale" ? "warn" : "bad"}>{v.status}</Chip>
              </div>
              <div className="venue-spec">
                <div>Stage<b>{v.stage.width} × {v.stage.depth} m</b></div>
                <div>Trim<b>{v.stage.trim} m</b></div>
                <div>Power<b>{v.power.amps} A · {v.power.kw} kW</b></div>
                <div>Rig<b>{v.rigCapacityKg} kg</b></div>
                <div>Load-in<b>{v.loadInHours} h / {v.changeoverHours} h</b></div>
                <div>Front row<b>{v.frontRow.distance} m · eye {v.frontRow.eyeHeight} m</b></div>
              </div>
              {d && <div className="row gap6 mt8"><Chip tone="info">{fmtDate(d.date)}</Chip><Chip>{d.status.replace("_", " ")}</Chip></div>}
              <div className="venue-plan"><VenuePlan venue={v} design={{ width: pack.stage.width, depth: pack.stage.depth }} /></div>
            </button>
          );
        })}
      </div>

      <div className="readiness-grid">
        <Panel title={`${selected.name} · fit for this show`} sub={`${selected.city} · last verified ${fmtDate(selected.lastVerified)} by ${selected.verifiedBy}`}>
          <div className="venue-spec" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div>Crew call<b>{fmtDate(date?.crewCall)}</b></div>
            <div>Curfew<b>{selected.curfew}</b></div>
            <div>Stage notes<b style={{ fontWeight: 400 }}>{selected.notes}</b></div>
          </div>
          <div className="col gap12 mt16">
            {checks.map((c) => (
              <div key={c.id} className="check-row">
                <span className={`status ${c.status}`} />
                <div><h4>{c.title}</h4><p>{c.detail}</p></div>
                <CheckChip status={c.status} />
              </div>
            ))}
          </div>
          <div className="row gap6 mt16 wrap">
            <Chip tone={summary.fail ? "bad" : summary.warn ? "warn" : "ok"}>{summary.fail} fail · {summary.warn} warn · {summary.pass} pass</Chip>
            <button className="btn sm" onClick={() => store.say(`${selected.name}: venue variant created from ${pack.project.version}`)}><Icon name="plus" size={11} /> Create venue variant</button>
            <button className="btn sm ghost" onClick={() => store.say(`${selected.name}: load-in and changeover copied to the tour calendar`)}><Icon name="calendar" size={11} /> Add to calendar</button>
          </div>
        </Panel>

        <aside className="col gap16">
          <Panel title="What changes here" sub={`${selected.city} vs ${pack.project.title} ${pack.project.version}`}>
            <div className="col gap10">
              <Meter value={selected.stage.width} max={Math.max(selected.stage.width, pack.stage.width)} tone={fit.status === "fail" ? "bad" : "ok"} label="Stage width" right={`${selected.stage.width} / design ${pack.stage.width} m`} />
              <Meter value={selected.stage.depth} max={Math.max(selected.stage.depth, pack.stage.depth)} tone={fit.status === "fail" ? "bad" : "ok"} label="Stage depth" right={`${selected.stage.depth} / design ${pack.stage.depth} m`} />
              <Meter value={selected.stage.trim} max={Math.max(selected.stage.trim, pack.stage.trim)} tone="ok" label="Trim height" right={`${selected.stage.trim} / design ${pack.stage.trim} m`} />
              <Meter value={selected.power.kw} max={Math.max(selected.power.kw, stats.powerKw)} tone={powerHeadroom < 0 ? "bad" : "ok"} label="Power" right={`${stats.powerKw.toFixed(1)} / ${selected.power.kw} kW`} />
              <Meter value={selected.rigCapacityKg} max={Math.max(selected.rigCapacityKg, stats.frontKg)} tone={weightHeadroom < 0 ? "bad" : "ok"} label="Rig" right={`${stats.frontKg} / ${selected.rigCapacityKg} kg`} />
            </div>
            <p className="xsmall soft mt12">The fit check compares the venue against the current show, not against an ideal room. A smaller room is not a bad room; it is a variant.</p>
          </Panel>

          <Panel title="Data rights" sub="Venue data is customer confidential">
            <div className="col gap6">
              <div className="provenance-item"><span>Profile source</span><b>{selected.verifiedBy} · {fmtDate(selected.lastVerified)}</b></div>
              <div className="provenance-item"><span>Freshness contract</span><b>12 months. {selected.status === "verified" ? "Inside the window." : "Outside the window: a risk is raised."}</b></div>
              <div className="provenance-item"><span>Retention</span><b>Per tour. No venue data crosses the production network in a live deployment.</b></div>
            </div>
            <Link to="/provenance" className="btn sm mt12">Data-rights annex <Icon name="arrow" size={11} /></Link>
          </Panel>

          <Panel title="Cost at this venue" sub={`${activeLook.name} · one show`}>
            <div className="row between"><span className="small soft">Landing look</span><b className="mono">{fmtMoney(27527)}</b></div>
            <div className="row between mt8"><span className="small soft">Power headroom</span><b className={`mono ${powerHeadroom < 0 ? "bad" : "ok"}`}>{powerHeadroom.toFixed(1)} kW</b></div>
            <div className="row between mt8"><span className="small soft">Rig headroom</span><b className={`mono ${weightHeadroom < 0 ? "bad" : "ok"}`}>{weightHeadroom} kg</b></div>
            <div className="row between mt8"><span className="small soft">Load-in</span><b className="mono">{selected.loadInHours} h / {selected.changeoverHours} h change</b></div>
            <p className="xsmall soft mt12">The cost is the same design. The venue changes the risk, not the invoice.</p>
          </Panel>
        </aside>
      </div>

      {ui.showDemoNotices && <p className="xsmall soft mt16">Public demo: all venue profiles are synthetic. No venue, crew or artist data is real. The freshness and coverage rules are the ones a pilot would run.</p>}
    </div>
  );
}
