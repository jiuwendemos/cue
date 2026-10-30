import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { showAudio } from "../lib/audio";
import {
  checkSummary,
  effectiveLook,
  energyAt,
  fmtClock,
  fmtMoney,
  fmtPct,
  lookStats,
  performersAt,
  songAt,
  trussLoads,
} from "../lib/engine";
import type { Look } from "../types";
import { StageCanvas } from "../components/StageCanvas";
import { Timeline } from "../components/Timeline";
import { Icon } from "../components/Icon";
import { CheckChip, Chip, Meter, Modal, PageHead, Panel, Swatches, Tabs } from "../components/UI";
import { MOOD } from "../data/mood";

type Tab = "stage" | "looks" | "video" | "blocking" | "concept";
type Layer = "all" | "set" | "light" | "video" | "blocking";

const TABS: { id: Tab; label: string }[] = [
  { id: "stage", label: "Stage" },
  { id: "concept", label: "Concept" },
  { id: "looks", label: "Looks" },
  { id: "video", label: "Video" },
  { id: "blocking", label: "Blocking" },
];

function LookTile({
  look,
  active,
  rejected,
  onUse,
  onReject,
  onDragStart,
  compact = false,
}: {
  look: Look;
  active: boolean;
  rejected: boolean;
  onUse: () => void;
  onReject: () => void;
  onDragStart: () => void;
  compact?: boolean;
}) {
  const store = useStore();
  const stats = lookStats(store.pack, look);
  return (
    <div
      className={`look-card${active ? " active" : ""}${rejected ? " rejected" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", look.id);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart();
      }}
      onDoubleClick={onUse}
    >
      <div className="palette-bar">
        {look.palette.map((c) => <i key={c} style={{ background: c }} />)}
      </div>
      <div className="look-top">
        <div>
          <div className="look-name">{look.name}</div>
          <div className="look-code">{look.code} · impact {look.impact}</div>
        </div>
        <Swatches colors={look.palette} />
      </div>
      {!compact && <p className="look-desc">{look.description}</p>}
      <div className="look-meta">
        <span>{stats.fixtureCount} fixtures</span>
        <span>{(stats.powerKw).toFixed(1)} kW</span>
        <span>{stats.frontKg} kg</span>
      </div>
      <div className="look-meta">
        <span className={stats.budgetTotal > store.budgetApproved ? "bad" : "soft"}>{fmtMoney(stats.budgetTotal)} show</span>
        <span className={stats.glare > 0.55 ? "bad" : "soft"}>glare {stats.glare.toFixed(2)}</span>
      </div>
      <div className="look-actions">
        {active ? <Chip tone="accent">Active</Chip> : <button className="btn sm" onClick={onUse}>Use</button>}
        <button className="btn sm ghost" onClick={onReject} disabled={rejected}>{rejected ? "Rejected" : "Reject"}</button>
        {look.createdBy === "agent" && <Chip tone="info">Agent</Chip>}
      </div>
    </div>
  );
}

export default function Workspace() {
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "stage";
  const lookParam = params.get("look");
  const [time, setTime] = useState(225);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<Layer>("all");
  const [showGlare, setShowGlare] = useState(true);
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Look | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [muted, setMuted] = useState(false);

  const { pack, activeLook, rejectedLooks, cues, checks } = store;
  const summary = checkSummary(checks);
  const stats = useMemo(() => lookStats(pack, activeLook), [activeLook, pack]);
  const song = songAt(pack, time);

  useEffect(() => {
    if (!lookParam) return;
    const look = pack.looks.find((l) => l.id === lookParam);
    if (look && look.id !== activeLook.id) store.selectLook(look.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookParam]);

  useEffect(() => {
    const raw = params.get("t");
    const t = Number(raw);
    if (raw !== null && raw !== "" && Number.isFinite(t) && t >= 0) setTime(Math.min(440, t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (playing) {
      showAudio.start(energyAt(pack, time));
    } else {
      showAudio.stop();
    }
    return () => showAudio.stop();
  }, [playing, pack]);

  useEffect(() => {
    if (playing) showAudio.setEnergy(energyAt(pack, time));
  }, [pack, playing, time]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  const scrub = (t: number) => {
    setTime(t);
    if (!playing) showAudio.scrubPreview(energyAt(pack, t));
  };

  const useLook = (look: Look) => {
    store.selectLook(look.id);
    const p = new URLSearchParams(params);
    p.set("look", look.id);
    setParams(p, { replace: true });
  };

  const doReject = () => {
    if (!rejecting) return;
    const suggestion = pack.suggestions.find((s) => s.lookId === rejecting.id);
    if (suggestion) store.rejectSuggestion(suggestion.id, rejectReason || "Designer rejected the proposal.");
    else store.rejectLook(rejecting.id, rejectReason || "Designer rejected the proposal.");
    setRejecting(null);
    setRejectReason("");
  };

  const previewLook = effectiveLook(pack, activeLook.id, rejectedLooks, store.acceptedLookId) ?? activeLook;

  return (
    <div>
      <PageHead
        kicker={`${pack.project.artist} · ${pack.project.tour}`}
        title={`${pack.project.title} · ${pack.project.version}`}
        sub="One project. Stage, looks, video, blocking, cues and cost on one timeline. The designer authors; CUE proposes and checks."
        actions={
          <>
            <Link to="/cues" className="btn"><Icon name="cue" size={13} /> Cue sheet</Link>
            <Link to="/budget" className="btn"><Icon name="budget" size={13} /> Budget</Link>
            <Link to="/stage" className="btn primary"><Icon name="play" size={13} /> 90-second show</Link>
          </>
        }
      />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div className="workspace">
        <div className="stage-column">
          {tab !== "concept" && (
            <>
          <div className="transport">
            <button className="btn primary sm" onClick={() => { if (!playing) void showAudio.ensure(); setPlaying((p) => !p); }}>
              <Icon name={playing ? "pause" : "play"} size={13} /> {playing ? "Pause" : "Play"}
            </button>
            <div className="mv">
              <button className="btn sm" onClick={() => scrub(Math.max(0, time - 5))} aria-label="Back five seconds"><Icon name="chevron" size={12} style={{ transform: "rotate(180deg)" }} /></button>
              <button className="btn sm" onClick={() => scrub(Math.min(440, time + 5))} aria-label="Forward five seconds"><Icon name="chevron" size={12} /></button>
            </div>
            <span className="time">{fmtClock(time)}</span>
            <span className="speed">{song?.title} · energy {(energyAt(pack, time) * 100).toFixed(0)}%</span>
            <span className="spacer" />
            <div className="mv">
              {(["all", "set", "light", "video", "blocking"] as Layer[]).map((l) => (
                <button key={l} className={`btn sm${layer === l ? " primary" : " ghost"}`} onClick={() => setLayer(l)}>{l === "all" ? "All" : l[0].toUpperCase() + l.slice(1)}</button>
              ))}
            </div>
            <button className={`btn sm${showGlare ? " danger" : ""}`} onClick={() => setShowGlare((v) => !v)} aria-pressed={showGlare}>
              <Icon name="eye" size={12} /> Glare
            </button>
            <button className="btn sm ghost" onClick={() => setTime(225)}><Icon name="reset" size={12} /> Drop</button>
            <button
              className="btn sm ghost"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                showAudio.setMuted(next);
              }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              <Icon name={muted ? "mute" : "volume"} size={12} />
            </button>
          </div>

          <div className="look-strip" role="list" aria-label="Quick looks">
            {pack.looks.map((look) => (
              <button
                key={look.id}
                role="listitem"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", look.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => useLook(look)}
                className={`look-chip${look.id === activeLook.id ? " active" : ""}${rejectedLooks.includes(look.id) ? " rejected" : ""}`}
                title={`${look.name} — drag onto the build`}
              >
                <span className="look-chip-palette">
                  {look.palette.map((c) => <i key={c} style={{ background: c }} />)}
                </span>
                <span>{look.name}</span>
                <b className="mono">{look.impact}</b>
              </button>
            ))}
          </div>

          <StageCanvas
            pack={pack}
            look={previewLook}
            time={time}
            layer={layer}
            showGlare={showGlare && previewLook.audienceAim > 0}
            selectedFixture={selectedFixture}
            onSelectFixture={setSelectedFixture}
          />

          <Timeline
            pack={pack}
            cues={cues}
            time={time}
            onScrub={scrub}
            selectedCue={null}
            onDropLook={(lookId, at) => {
              const look = pack.looks.find((l) => l.id === lookId);
              if (look) {
                useLook(look);
                scrub(at);
              }
            }}
            activeLookId={previewLook.id}
          />
            </>
          )}

          {tab === "stage" && (
            <Panel title="The look rail" sub="Drag a look onto the timeline to set the build. Double-click to preview." flush>
              <div style={{ padding: 12 }}>
                <div className="look-rail">
                  {pack.looks.map((look) => (
                    <LookTile
                      key={look.id}
                      look={look}
                      active={look.id === activeLook.id}
                      rejected={rejectedLooks.includes(look.id)}
                      onUse={() => useLook(look)}
                      onReject={() => { setRejecting(look); setRejectReason(""); }}
                      onDragStart={() => undefined}
                      compact
                    />
                  ))}
                </div>
              </div>
            </Panel>
          )}

          {tab === "concept" && (
            <div className="col gap16">
              <Panel title="The concept" sub={`${pack.project.title} · ${pack.project.version} · designer ${pack.project.designer}`}>
                <p className="concept-mood">{pack.concept.mood}</p>
                <p className="concept-statement">{pack.concept.narrative}</p>
                <div className="concept-refs">
                  {pack.concept.references.map((r) => <Chip key={r}>{r}</Chip>)}
                </div>
                <div className="concept-signature">
                  <span className="mono">Mara Voss</span>
                  <span className="xsmall soft">designer · 28 Sep 2026</span>
                </div>
              </Panel>

              <div className="concept-board">
                <Panel title="Moodboard" sub="Generated reference cards. No third-party imagery.">
                  <div className="moodboard two">
                    {MOOD.map((m, i) => (
                      <div className="mood-card" key={m.ref} style={{ transform: `rotate(${i % 2 === 0 ? -0.8 : 0.9}deg)` }}>
                        <div className="mood-art" style={{ background: `radial-gradient(120% 100% at 20% 10%, ${m.from}, ${m.via} 42%, ${m.to} 80%)` }}>
                          <span className="mood-grain" />
                          <span className="mood-index mono">REF 0{i + 1}</span>
                        </div>
                        <b>{m.ref}</b>
                        <span>{m.note}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn sm ghost mt12" onClick={() => store.say("Reference added to the moodboard — the designer's eye, not the agent's.")}><Icon name="plus" size={11} /> Add a reference</button>
                </Panel>

                <div className="col gap16">
                  <Panel title="Rules, not decoration" sub="A look may repeat; a gesture may not.">
                    <div className="concept-rules">
                      {pack.concept.rules.map((r, i) => (
                        <div className="rule-row" key={r}><span className="mono">{String(i + 1).padStart(2, "0")}</span><p>{r}</p></div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="The palette" sub="Every look, in one glance">
                    <div className="palette-list">
                      {pack.looks.map((l) => (
                        <button key={l.id} className={`palette-row${l.id === activeLook.id ? " active" : ""}`} onClick={() => useLook(l)}>
                          <Swatches colors={l.palette} size={14} />
                          <span>{l.name}</span>
                          <span className="xsmall soft">{l.mood}</span>
                          <b className="mono">{l.impact}</b>
                        </button>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="The set" sub="Energy, not a spreadsheet">
                    <div className="setlist-stack">
                      {pack.setlist.map((s, i) => (
                        <div key={s.id} className="setlist-block">
                          <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                          <span className="name">{s.title}</span>
                          <span className="xsmall soft">{s.bpm} bpm · {s.key}</span>
                          <span className="set-energy"><i style={{ width: `${s.energyEnd * 100}%` }} /></span>
                          <span className="xsmall mono soft">{fmtClock(s.start)}–{fmtClock(s.end)}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
          )}

          {tab === "looks" && (
            <Panel title="All looks" sub="Impact is the creative score. Power, weight and glare are the consequences." flush>
              <div className="look-grid">
                {pack.looks.map((look) => (
                  <LookTile
                    key={look.id}
                    look={look}
                    active={look.id === activeLook.id}
                    rejected={rejectedLooks.includes(look.id)}
                    onUse={() => useLook(look)}
                    onReject={() => { setRejecting(look); setRejectReason(""); }}
                    onDragStart={() => undefined}
                  />
                ))}
              </div>
            </Panel>
          )}

          {tab === "video" && (
            <Panel title="Video" sub="Content, mapping and transitions. The screen is a 12 × 5 m Absen on the back truss.">
              <div className="video-grid">
                {pack.videos.map((video) => (
                  <div className="video-card" key={video.id}>
                    <div className="video-preview" style={{ background: `linear-gradient(120deg, ${video.palette[0]}, ${video.palette[1]} 60%, #050607)` }}>
                      {video.status === "missing" && <div className="vp-missing">MISSING</div>}
                      <div className="vp-bar" style={{ background: video.palette[0] }} />
                    </div>
                    <div className="video-body">
                      <div className="row between">
                        <h4>{video.name}</h4>
                        <Chip tone={video.status === "delivered" ? "ok" : video.status === "missing" ? "bad" : "warn"}>{video.status}</Chip>
                      </div>
                      <p className="mono">{video.clip} · {video.resolution}</p>
                      <p>{video.mapping} · {video.transition} · complexity {video.cueComplexity}/10</p>
                      <p className="mt8">{video.note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="xsmall soft mt12">Video is not generated by CUE. It works with the artist's content and keeps the rights register attached to every clip.</p>
            </Panel>
          )}

          {tab === "blocking" && (
            <Panel title={`Blocking at ${fmtClock(time)}`} sub="Artist, dancers and camera. The previz follows the same marks the crew will spike.">
              <div className="blocking-list">
                {performersAt(pack, time).map((p) => (
                  <div className="blocking-row" key={p.performer}>
                    <span className="at">{fmtClock(time)}</span>
                    <span className="who">{p.performer} <span className="soft">· {p.role}</span><span className="blocking-note">{p.note}</span></span>
                    <span className="pos">x {p.x.toFixed(1)} · y {p.y.toFixed(1)} · z {p.z.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <div className="section-label"><span>Marks in the book</span><span className="soft xsmall">{pack.blocking.length} keys</span></div>
              <div className="blocking-list">
                {pack.blocking.map((b) => (
                  <div className="blocking-row" key={b.id}>
                    <span className="at">{fmtClock(b.at)}</span>
                    <span className="who">{b.performer} <span className="soft">· {b.note}</span></span>
                    <span className="pos">{b.x.toFixed(1)}, {b.y.toFixed(1)}, {b.z.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <aside className="side-column">
          <Panel
            title="Active look"
            sub={`${previewLook.code} · ${previewLook.createdBy === "agent" ? "agent proposal" : "designer authored"}`}
            actions={<Link to="/agent" className="btn sm ghost">Why this look?</Link>}
          >
            <div
              className="look-feature"
              style={{ background: `linear-gradient(120deg, ${previewLook.palette[0]} 0%, ${previewLook.palette[1] ?? previewLook.palette[0]} 46%, #0a0d09 100%)` }}
            >
              <span className="mono">{previewLook.code}</span>
              <b>{previewLook.name}</b>
            </div>
            <div className="row between mb12">
              <div>
                <Swatches colors={previewLook.palette} size={13} />
                <span className="xsmall soft" style={{ display: "block", marginTop: 4 }}>{previewLook.createdBy === "agent" ? "agent proposal" : "designer authored"}</span>
              </div>
              <Chip tone={rejectedLooks.includes(previewLook.id) ? "bad" : previewLook.status === "approved" ? "ok" : "accent"}>{rejectedLooks.includes(previewLook.id) ? "rejected" : previewLook.status}</Chip>
            </div>
            <p className="small muted" style={{ marginBottom: 12 }}>{previewLook.description}</p>
            <div className="col gap12">
              <Meter value={stats.powerKw} max={pack.rig.power.kw} tone={stats.supplyPct > 1 ? "bad" : stats.supplyPct > 0.9 ? "warn" : "ok"} label="Power" right={`${stats.powerKw.toFixed(1)} / ${pack.rig.power.kw} kW`} />
              <Meter value={stats.frontKg} max={stats.frontCapacityKg} tone={stats.weightPct > 1 ? "bad" : stats.weightPct > 0.9 ? "warn" : "ok"} label="Front truss" right={`${stats.frontKg} / ${stats.frontCapacityKg} kg`} />
              <Meter value={stats.glare} max={0.55} tone={stats.glare > 0.55 ? "bad" : "ok"} label="Glare index" right={stats.glare.toFixed(2)} />
              <Meter value={stats.budgetTotal} max={store.budgetApproved} tone={stats.budgetTotal > store.budgetApproved ? "warn" : "ok"} label="Show budget" right={fmtMoney(stats.budgetTotal)} />
            </div>
            <div className="row gap6 mt12 wrap">
              <Chip>{stats.fixtureCount} fixtures</Chip>
              <Chip>{fmtMoney(stats.cost)} add-on</Chip>
              <Chip>{lookStats(pack, previewLook).fixtureCount} patched</Chip>
            </div>
            <div className="row gap6 mt12">
              {store.activeSuggestion && !rejectedLooks.includes(previewLook.id) && store.activeSuggestion.status !== "rejected" && (
                <button className="btn sm ok" onClick={() => store.acceptSuggestion(store.activeSuggestion!.id)}><Icon name="check" size={12} /> Accept</button>
              )}
              <button className="btn sm danger" onClick={() => { setRejecting(previewLook); setRejectReason(""); }}><Icon name="x" size={12} /> Reject</button>
            </div>
          </Panel>

          <Panel title="Consequences" sub={`${summary.fail} fail · ${summary.warn} warn · ${summary.pass} pass`} actions={<Chip tone={summary.fail ? "bad" : summary.warn ? "warn" : "ok"}>{summary.fail ? "Stop" : summary.warn ? "Review" : "Clear"}</Chip>}>
            <div className="check-list">
              {checks.map((check) => (
                <div className="check-row" key={check.id}>
                  <span className={`status ${check.status}`} />
                  <div>
                    <h4>{check.title}</h4>
                    <p>{check.detail}</p>
                  </div>
                  <CheckChip status={check.status} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Fixture inspector" sub={selectedFixture ? "click a fixture in the previz" : "hover a fixture in the previz"}>
            {selectedFixture ? (() => {
              const f = pack.rig.fixtures.find((x) => x.id === selectedFixture);
              if (!f) return <div className="empty">Fixture not found.</div>;
              const lit = previewLook.fixtureIds.includes(f.id);
              return (
                <div className="col gap6">
                  <div className="row between"><b>{f.label}</b><Chip tone={lit ? "accent" : "neutral"}>{lit ? "lit" : "dark"}</Chip></div>
                  <div className="fixture-detail mono">{f.kind} · {f.watts} W · {f.weightKg} kg · {f.beamAngle}°</div>
                  <div className="fixture-detail mono">universe {f.universe} / address {f.address} · {f.truss}</div>
                  <div className="fixture-detail">x {f.x} · y {f.y} · z {f.z}</div>
                  <p className="xsmall soft">{f.purpose}</p>
                  <button className="btn sm ghost" onClick={() => setSelectedFixture(null)}>Clear selection</button>
                </div>
              );
            })() : (
              <div className="col gap6">
                <p className="small muted">Click any diamond in the previz to inspect its patch, weight, beam angle and raison d'être.</p>
                <div className="fixture-list">
                  {pack.rig.fixtures.slice(0, 10).map((f) => (
                    <button key={f.id} className={`fixture-row${previewLook.fixtureIds.includes(f.id) ? " on" : ""}`} onClick={() => setSelectedFixture(f.id)} style={{ background: "none", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                      <b>{f.id}</b>
                      <span><span className="kind">{f.kind}</span> · {f.label}</span>
                      <span className="soft">{f.watts} W</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Truss loads" sub="Cable and clamps included">
            <div className="col gap10">
              {trussLoads(pack, previewLook).map((t) => (
                <Meter key={t.truss} value={t.kg} max={t.capacityKg} tone={t.pct > 1 ? "bad" : t.pct > 0.9 ? "warn" : "ok"} label={t.name} right={`${t.kg} / ${t.capacityKg} kg`} />
              ))}
            </div>
          </Panel>

          {store.activeSuggestion && (
            <Panel title="Why this look?" sub={`${store.activeSuggestion.name} · confidence ${fmtPct(store.activeSuggestion.confidence)}`}>
              <div className="col gap6">
                {store.activeSuggestion.reasons.map((r) => (
                  <div className="evidence-item" key={r.id}>
                    <b>{r.label}</b>
                    <span>{r.source}</span>
                  </div>
                ))}
                {store.activeSuggestion.flags.length > 0 && (
                  <div className="row gap4 wrap mt8">
                    {store.activeSuggestion.flags.map((f) => <Chip key={f} tone="bad">{f}</Chip>)}
                  </div>
                )}
                <p className="xsmall soft mt8">The agent ranks on impact first. It shows the flags, but the human decides what is safe.</p>
                <Link to="/agent" className="btn sm mt8">Open the agent trace <Icon name="arrow" size={12} /></Link>
              </div>
            </Panel>
          )}
        </aside>
      </div>

      <Modal
        open={Boolean(rejecting)}
        title={`Reject ${rejecting?.name ?? "look"}`}
        onClose={() => setRejecting(null)}
        actions={
          <>
            <button className="btn" onClick={() => setRejecting(null)}>Cancel</button>
            <button className="btn danger" onClick={doReject} disabled={!rejectReason.trim()}>Reject with reason</button>
          </>
        }
      >
        <p className="small muted">The rejection is stored with the show and the ranking is recomputed. A reason is required — it is the record of a human decision.</p>
        <div className="field mt12">
          <label htmlFor="reject-reason">Reason</label>
          <textarea id="reject-reason" className="textarea" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. 44 kg over the truss, 1.6 kW over supply, blinds the front row." />
        </div>
        <div className="row gap6 mt12 wrap">
          {["Over the truss rating", "Over the house supply", "Blinds the front row", "Does not answer the song"].map((r) => (
            <button key={r} className="btn sm" onClick={() => setRejectReason(r)}>{r}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
