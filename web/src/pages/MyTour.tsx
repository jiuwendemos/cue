import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { budgetTotal, downloadText, fmtMoney } from "../lib/engine";
import { blankBudgetLine, blankCue, blankDate, blankLook, blankVenue, createWorkspacePack, nextCue } from "../lib/blank";
import { createExamplePack } from "../data/example";
import { cuesFromCsv, fixturesFromCsv } from "../lib/csv";
import type { BudgetCategory, Cue, CueKind, CueStatus, Look, Pack, TourDate, Venue } from "../types";
import { Chip, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

const CUE_KINDS: CueKind[] = ["LX", "VID", "STG", "AUD", "SFX", "CAM"];
const CUE_STATUS: CueStatus[] = ["draft", "review", "approved", "released"];
const BUDGET_CATEGORIES: BudgetCategory[] = ["rig", "crew", "power", "video", "transport", "content", "contingency"];

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function seconds(value: string): number {
  const [m, s] = value.split(":").map((part) => Number(part) || 0);
  return Math.max(0, m * 60 + s);
}

function row<T>(label: string, value: T, onChange: (value: T) => void, type = "text", step?: string) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        className="input"
        type={type}
        step={step}
        value={String(value)}
        onChange={(event) => onChange((type === "number" ? Number(event.target.value) : event.target.value) as T)}
      />
    </label>
  );
}

export default function MyTour() {
  const store = useStore();
  const ui = useUI();
  const navigate = useNavigate();
  const ws = store.workspace;
  const active = store.mode === "workspace" && ws;
  const fileInput = useRef<HTMLInputElement>(null);
  const cueInput = useRef<HTMLInputElement>(null);
  const fixtureInput = useRef<HTMLInputElement>(null);

  const [start, setStart] = useState({
    artist: "",
    title: "",
    tour: "",
    venueName: "Home venue",
    city: "",
    capacity: 500,
    date: "",
  });
  const [show, setShow] = useState({ artist: "", title: "", tour: "", designer: "", producer: "", tourManager: "", company: "" });
  const [venueDraft, setVenueDraft] = useState<Venue | null>(null);
  const [lookDraft, setLookDraft] = useState<Look | null>(null);
  const [cueDraft, setCueDraft] = useState<Cue | null>(null);
  const [cueTime, setCueTime] = useState("0:00");
  const [dateDraft, setDateDraft] = useState<TourDate>(() => blankDate());
  const [line, setLine] = useState({ name: "", category: "crew" as BudgetCategory, qty: 1, unitCost: 0 });
  const [approved, setApproved] = useState("0");

  useEffect(() => {
    document.title = "My tour - CUE";
    if (ws) {
      setShow({
        artist: ws.project.artist,
        title: ws.project.title,
        tour: ws.project.tour,
        designer: ws.project.designer,
        producer: ws.project.producer,
        tourManager: ws.project.tourManager,
        company: ws.project.productionCompany,
      });
      setApproved(String(ws.budget.approved));
    }
  }, [ws?.project.id, ws?.budget.approved]);

  const total = useMemo(() => (ws ? budgetTotal(ws, ws.looks[0]?.id) : 0), [ws]);

  if (!active || !ws) {
    return (
      <div>
        <PageHead
          kicker="MY TOUR · BLANK WORKSPACE"
          title="Start with your show"
          sub="This is your workspace: one venue, one look, one cue to begin with. The synthetic show stays one click away."
          actions={<Link to="/settings" className="btn"><Icon name="settings" size={13} /> Data source</Link>}
        />
        {ws && store.mode === "demo" && (
          <div className="banner mb16">
            <Icon name="file" size={14} />
            <span>You have a saved tour. <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => store.setMode("workspace")}>Open my tour</button></span>
          </div>
        )}
        <div className="tour-start">
          <Panel title="The first four things" sub="You can change all of it later in this page.">
            <div className="grid g2">
              {row("Artist", start.artist, (v) => setStart((s) => ({ ...s, artist: v })))}
              {row("Show title", start.title, (v) => setStart((s) => ({ ...s, title: v })))}
              {row("Tour name", start.tour, (v) => setStart((s) => ({ ...s, tour: v })))}
              {row("Venue", start.venueName, (v) => setStart((s) => ({ ...s, venueName: v })))}
              {row("City", start.city, (v) => setStart((s) => ({ ...s, city: v })))}
              {row("Capacity", start.capacity, (v) => setStart((s) => ({ ...s, capacity: v })), "number")}
              {row("First show date", start.date, (v) => setStart((s) => ({ ...s, date: v })), "date")}
            </div>
            <div className="row gap8 mt16 wrap">
              <button
                className="btn primary"
                onClick={() => {
                  const pack = createWorkspacePack({
                    artist: start.artist,
                    title: start.title,
                    tour: start.tour,
                    designer: "You",
                    producer: "You",
                    tourManager: "You",
                    company: "Your company",
                    venueName: start.venueName,
                    city: start.city,
                    capacity: start.capacity,
                    date: start.date || blankDate().date,
                  });
                  store.startWorkspace(pack);
                  navigate("/tour");
                }}
              >
                <Icon name="plus" size={13} /> Create my tour
              </button>
              <button
                className="btn"
                onClick={() => {
                  store.startWorkspace(createExamplePack());
                  navigate("/tour");
                }}
              >
                <Icon name="spark" size={13} /> Load the worked example
              </button>
              <button className="btn" onClick={() => store.setMode("demo")}><Icon name="shows" size={13} /> See the synthetic demo instead</button>
            </div>
            <p className="xsmall soft mt12">
              Saved in this browser. Nothing is uploaded. On site, signatures, approvals and readiness actions go to the tenant database.
            </p>
          </Panel>

          <Panel title="The Harbour Lights example" sub="A small club tour you can load, analyse and change. Everything in it is synthetic.">
            <div className="prose">
              <p>
                Four rooms, 12 cues, 20 fixtures, a 15,000 EUR budget and four open risks: a 20 kW room against a 24.3 kW
                design, a missing clip, a licence that ends before Manchester, and two rooms smaller than the stage.
              </p>
              <div className="row gap8 mt12 wrap">
                <button
                  className="btn primary"
                  onClick={() => {
                    store.startWorkspace(createExamplePack());
                    navigate("/tour");
                  }}
                >
                  <Icon name="spark" size={13} /> Load the example
                </button>
                <button className="btn" onClick={() => downloadText("harbour-lights-show-pack.json", JSON.stringify(createExamplePack(), null, 2), "application/json")}>
                  <Icon name="download" size={13} /> Show pack JSON
                </button>
                <a className="btn" href={new URL("examples/harbour-lights/cues-grandma3.csv", document.baseURI).toString()} download>
                  <Icon name="download" size={13} /> Cues CSV
                </a>
                <a className="btn" href={new URL("examples/harbour-lights/fixtures-vectorworks.csv", document.baseURI).toString()} download>
                  <Icon name="download" size={13} /> Fixtures CSV
                </a>
              </div>
              <p className="xsmall soft mt12">
                The files live in <span className="mono">examples/harbour-lights/</span> and are described in
                <span className="mono"> examples/harbour-lights/README.md</span>: what to fill in, what to upload, and the
                questions to ask of the result.
              </p>
            </div>
          </Panel>

          <Panel title="Or bring what you have" sub="A show pack from another machine, or a blank one to edit by hand.">
            <div className="prose">
              <p>Export a workspace as JSON, edit it, and import it back here. The same shape drives the whole app.</p>
              <div className="row gap8 mt12 wrap">
                <button className="btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={13} /> Import JSON</button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      const parsed = JSON.parse(await file.text()) as Pack;
                      if (!parsed.project || !Array.isArray(parsed.cues) || !Array.isArray(parsed.venues)) throw new Error("Not a CUE show pack");
                      store.importWorkspace(parsed);
                      navigate("/tour");
                    } catch (error) {
                      store.say(error instanceof Error ? error.message : "The file could not be read.");
                    }
                  }}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const edit = (fn: (draft: Pack) => void) => store.updateWorkspace(fn);

  return (
    <div>
      <PageHead
        kicker={`MY TOUR · ${ws.project.version} · ${ws.venues.length} venue(s) · ${ws.cues.length} cue(s)`}
        title={ws.project.title}
        sub={`${ws.project.artist} · ${ws.project.tour}. Your data, saved in this browser.`}
        actions={
          <>
            <button className="btn" onClick={() => store.setMode("demo")}><Icon name="shows" size={13} /> Synthetic demo</button>
            <button className="btn primary" onClick={() => navigate("/show")}><Icon name="stage" size={13} /> Open the studio</button>
          </>
        }
      />

      <div className="tour-grid">
        <Panel title="The show" sub="The identity the rest of the app reads.">
          <div className="grid g2">
            {row("Artist", show.artist, (v) => setShow((s) => ({ ...s, artist: v })))}
            {row("Title", show.title, (v) => setShow((s) => ({ ...s, title: v })))}
            {row("Tour", show.tour, (v) => setShow((s) => ({ ...s, tour: v })))}
            {row("Company", show.company, (v) => setShow((s) => ({ ...s, company: v })))}
            {row("Designer", show.designer, (v) => setShow((s) => ({ ...s, designer: v })))}
            {row("Producer", show.producer, (v) => setShow((s) => ({ ...s, producer: v })))}
            {row("Tour manager", show.tourManager, (v) => setShow((s) => ({ ...s, tourManager: v })))}
          </div>
          <button
            className="btn primary mt12"
            onClick={() => {
              edit((draft) => {
                draft.project.artist = show.artist || "Your artist";
                draft.project.title = show.title || "Untitled show";
                draft.project.tour = show.tour || "Untitled tour";
                draft.project.productionCompany = show.company || "Your company";
                draft.project.designer = show.designer || "You";
                draft.project.producer = show.producer || "You";
                draft.project.tourManager = show.tourManager || "You";
              });
              store.say("Show details saved");
            }}
          >
            Save show
          </button>
        </Panel>

        <Panel title="Dates" sub={`${ws.dates.length} on the calendar`} actions={<button className="btn sm" onClick={() => setDateDraft(blankDate(ws.venues[0]?.id, ws.venues[0]?.city))}><Icon name="plus" size={11} /> New date</button>}>
          <div className="tour-list">
            {ws.dates.map((date) => (
              <div key={date.id} className="tour-row">
                <b>{date.city}</b>
                <span className="soft">{date.date} · {ws.venues.find((v) => v.id === date.venueId)?.name ?? "no venue"}</span>
                <button className="btn sm ghost" onClick={() => edit((draft) => { draft.dates = draft.dates.filter((d) => d.id !== date.id); })}><Icon name="x" size={10} /></button>
              </div>
            ))}
            {ws.dates.length === 0 && <p className="xsmall soft">No dates. Add one so checks and readiness have a target.</p>}
          </div>
          <div className="grid g2 mt12">
            {row("City", dateDraft.city, (v) => setDateDraft((d) => ({ ...d, city: v })))}
            {row("Date", dateDraft.date, (v) => setDateDraft((d) => ({ ...d, date: v })), "date")}
          </div>
          <div className="row gap8 mt8 wrap">
            <select className="input" value={dateDraft.venueId} onChange={(e) => setDateDraft((d) => ({ ...d, venueId: e.target.value }))}>
              {ws.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
            </select>
            <button
              className="btn"
              onClick={() => {
                edit((draft) => {
                  draft.dates.push({ ...dateDraft, show: `${dateDraft.date}T20:00:00`, loadIn: `${dateDraft.date}T08:00:00`, crewCall: `${dateDraft.date}T12:00:00` });
                });
                store.say("Date added");
              }}
            >
              Add date
            </button>
          </div>
        </Panel>

        <Panel
          title="Venues"
          sub={`${ws.venues.length} in the workspace`}
          actions={<button className="btn sm" onClick={() => setVenueDraft({ ...blankVenue("", ""), id: "new" })}><Icon name="plus" size={11} /> New venue</button>}
        >
          <div className="tour-list">
            {ws.venues.map((venue) => (
              <div key={venue.id} className="tour-row">
                <b>{venue.name}</b>
                <span className="soft">{venue.city} · {venue.stage.width}×{venue.stage.depth} m · {venue.power.kw} kW · {venue.rigCapacityKg} kg</span>
                <button className="btn sm ghost" onClick={() => setVenueDraft(venue)}>Edit</button>
              </div>
            ))}
          </div>
          {venueDraft && (
            <div className="tour-form">
              <div className="grid g2">
                {row("Name", venueDraft.name, (v) => setVenueDraft((d) => d && { ...d, name: v }))}
                {row("City", venueDraft.city, (v) => setVenueDraft((d) => d && { ...d, city: v }))}
                {row("Capacity", venueDraft.capacity, (v) => setVenueDraft((d) => d && { ...d, capacity: v }), "number")}
                {row("Stage width (m)", venueDraft.stage.width, (v) => setVenueDraft((d) => d && { ...d, stage: { ...d.stage, width: v } }), "number", "0.1")}
                {row("Stage depth (m)", venueDraft.stage.depth, (v) => setVenueDraft((d) => d && { ...d, stage: { ...d.stage, depth: v } }), "number", "0.1")}
                {row("Trim (m)", venueDraft.stage.trim, (v) => setVenueDraft((d) => d && { ...d, stage: { ...d.stage, trim: v } }), "number", "0.1")}
                {row("Power (kW)", venueDraft.power.kw, (v) => setVenueDraft((d) => d && { ...d, power: { ...d.power, kw: v } }), "number")}
                {row("Rig rating (kg)", venueDraft.rigCapacityKg, (v) => setVenueDraft((d) => d && { ...d, rigCapacityKg: v }), "number")}
                {row("Load-in (h)", venueDraft.loadInHours, (v) => setVenueDraft((d) => d && { ...d, loadInHours: v }), "number")}
                {row("Curfew", venueDraft.curfew, (v) => setVenueDraft((d) => d && { ...d, curfew: v }))}
              </div>
              <div className="row gap8 mt12 wrap">
                <button
                  className="btn primary"
                  onClick={() => {
                    edit((draft) => {
                      const index = draft.venues.findIndex((v) => v.id === venueDraft.id);
                      if (index >= 0) draft.venues[index] = venueDraft;
                      else draft.venues.push({ ...venueDraft, id: `v-${Date.now()}`, lastVerified: new Date().toISOString().slice(0, 10), verifiedBy: "You" });
                    });
                    setVenueDraft(null);
                    store.say("Venue saved");
                  }}
                >
                  Save venue
                </button>
                <button className="btn" onClick={() => setVenueDraft(null)}>Cancel</button>
                {ws.venues.length > 1 && ws.venues.some((v) => v.id === venueDraft.id) && (
                  <button className="btn danger" onClick={() => { edit((draft) => { draft.venues = draft.venues.filter((v) => v.id !== venueDraft.id); }); setVenueDraft(null); }}>Remove</button>
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Looks" sub={`${ws.looks.length} in the library`} actions={<button className="btn sm" onClick={() => setLookDraft({ ...blankLook(ws.rig.fixtures.map((f) => f.id)), id: "new" })}><Icon name="plus" size={11} /> New look</button>}>
          <div className="tour-list">
            {ws.looks.map((look) => (
              <div key={look.id} className="tour-row">
                <b>{look.name}</b>
                <span className="soft">{look.fixtureIds.length} fixtures · {look.palette.join(" ")}</span>
                <button className="btn sm ghost" onClick={() => setLookDraft(look)}>Edit</button>
              </div>
            ))}
          </div>
          {lookDraft && (
            <div className="tour-form">
              <div className="row gap6 mb8">
                <button className="btn sm" onClick={() => setLookDraft((d) => d && { ...d, fixtureIds: ws.rig.fixtures.map((f) => f.id) })}>All fixtures</button>
                <button className="btn sm" onClick={() => setLookDraft((d) => d && { ...d, fixtureIds: [] })}>None</button>
              </div>
              <div className="grid g2">
                {row("Name", lookDraft.name, (v) => setLookDraft((d) => d && { ...d, name: v }))}
                {row("Palette (hex, comma)", lookDraft.palette.join(", "), (v) => setLookDraft((d) => d && { ...d, palette: v.split(",").map((c) => c.trim()).filter(Boolean) }))}
                {row("Audience-aimed fixtures", lookDraft.audienceAim, (v) => setLookDraft((d) => d && { ...d, audienceAim: v }), "number")}
                {row("Energy (0-1)", lookDraft.energy, (v) => setLookDraft((d) => d && { ...d, energy: v }), "number", "0.05")}
              </div>
              <div className="look-fixtures">
                <span className="label">Fixtures in this look<span className="note">{lookDraft.fixtureIds.length} of {ws.rig.fixtures.length} selected</span></span>
                <div className="look-fixture-grid">
                  {ws.rig.fixtures.map((fixture) => {
                    const on = lookDraft.fixtureIds.includes(fixture.id);
                    return (
                      <label key={fixture.id} className={`look-fixture${on ? " on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setLookDraft((draft) =>
                              draft
                                ? {
                                    ...draft,
                                    fixtureIds: on
                                      ? draft.fixtureIds.filter((id) => id !== fixture.id)
                                      : [...draft.fixtureIds, fixture.id],
                                  }
                                : draft,
                            )
                          }
                        />
                        <span>{fixture.label}<small>{fixture.watts} W · {fixture.weightKg} kg</small></span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="row gap8 mt12 wrap">
                <button
                  className="btn primary"
                  onClick={() => {
                    edit((draft) => {
                      const index = draft.looks.findIndex((l) => l.id === lookDraft.id);
                      if (index >= 0) draft.looks[index] = lookDraft;
                      else draft.looks.push({ ...lookDraft, id: `look-${Date.now()}` });
                    });
                    setLookDraft(null);
                    store.say("Look saved");
                  }}
                >
                  Save look
                </button>
                <button className="btn" onClick={() => setLookDraft(null)}>Cancel</button>
                {ws.looks.length > 1 && <button className="btn danger" onClick={() => { edit((draft) => { draft.looks = draft.looks.filter((l) => l.id !== lookDraft.id); }); setLookDraft(null); }}>Remove</button>}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Cue sheet"
        sub={`${ws.cues.length} cue(s) · ${fmtMoney(total)} at the current looks`}
        actions={<button className="btn sm" onClick={() => { const next = nextCue(ws.cues); setCueDraft({ ...blankCue(), id: next.id, number: next.number, lookId: ws.looks[0]?.id, title: "New cue" }); setCueTime("0:00"); }}><Icon name="plus" size={11} /> New cue</button>}
      >
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Cue</th><th>At</th><th>Title</th><th>Look</th><th>Status</th><th /></tr></thead>
            <tbody>
              {ws.cues.map((cue) => (
                <tr key={cue.id}>
                  <td>{cue.number}</td>
                  <td>{cue.id}</td>
                  <td className="mono">{clock(cue.at)}</td>
                  <td>{cue.title}</td>
                  <td>{ws.looks.find((l) => l.id === cue.lookId)?.name ?? "—"}</td>
                  <td>{cue.status}</td>
                  <td><button className="btn sm ghost" onClick={() => { setCueDraft(cue); setCueTime(clock(cue.at)); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cueDraft && (
          <div className="tour-form">
            <div className="grid g2">
              {row("Number", cueDraft.number, (v) => setCueDraft((d) => d && { ...d, number: v }), "number")}
              {row("Cue id", cueDraft.id, (v) => setCueDraft((d) => d && { ...d, id: v }))}
              {row("Time (m:ss)", cueTime, (v) => setCueTime(v))}
              {row("Title", cueDraft.title, (v) => setCueDraft((d) => d && { ...d, title: v }))}
              {row("Detail", cueDraft.detail, (v) => setCueDraft((d) => d && { ...d, detail: v }))}
              {row("Fade (s)", cueDraft.fade, (v) => setCueDraft((d) => d && { ...d, fade: v }), "number")}
              <label className="field">
                <span className="label">Kind</span>
                <select className="input" value={cueDraft.kind} onChange={(e) => setCueDraft((d) => d && { ...d, kind: e.target.value as CueKind })}>
                  {CUE_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Look</span>
                <select className="input" value={cueDraft.lookId ?? ""} onChange={(e) => setCueDraft((d) => d && { ...d, lookId: e.target.value || undefined })}>
                  <option value="">—</option>
                  {ws.looks.map((look) => <option key={look.id} value={look.id}>{look.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Status</span>
                <select className="input" value={cueDraft.status} onChange={(e) => setCueDraft((d) => d && { ...d, status: e.target.value as CueStatus })}>
                  {CUE_STATUS.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">Safety sign-off</span>
                <select className="input" value={cueDraft.safety ? "yes" : "no"} onChange={(e) => setCueDraft((d) => d && { ...d, safety: e.target.value === "yes" })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </div>
            <div className="row gap8 mt12 wrap">
              <button
                className="btn primary"
                onClick={() => {
                  edit((draft) => {
                    const saved = { ...cueDraft, at: seconds(cueTime) };
                    const index = draft.cues.findIndex((c) => c.id === saved.id);
                    if (index >= 0) draft.cues[index] = saved;
                    else draft.cues.push(saved);
                  });
                  setCueDraft(null);
                  store.say("Cue saved");
                }}
              >
                Save cue
              </button>
              <button className="btn" onClick={() => setCueDraft(null)}>Cancel</button>
              {ws.cues.some((c) => c.id === cueDraft.id) && (
                <button className="btn danger" onClick={() => { edit((draft) => { draft.cues = draft.cues.filter((c) => c.id !== cueDraft.id); }); setCueDraft(null); }}>Remove</button>
              )}
            </div>
          </div>
        )}
      </Panel>

      <div className="tour-grid">
        <Panel title="Budget" sub={`${fmtMoney(total)} at the current looks · approved ${fmtMoney(ws.budget.approved)}`}>
          <div className="row gap8 mb12">
            <label className="field" style={{ flex: 1 }}>
              <span className="label">Approved total (EUR)</span>
              <input className="input" type="number" value={approved} onChange={(e) => setApproved(e.target.value)} />
            </label>
            <button className="btn" onClick={() => { store.setBudgetApproved(Number(approved) || 0); }}>Set approved</button>
          </div>
          <div className="tour-list">
            {ws.budget.lines.map((item) => (
              <div key={item.id} className="tour-row">
                <b>{item.name}</b>
                <span className="soft">{item.category} · {item.qty} × {fmtMoney(item.unitCost)}</span>
                <button className="btn sm ghost" onClick={() => edit((draft) => { draft.budget.lines = draft.budget.lines.filter((l) => l.id !== item.id); })}><Icon name="x" size={10} /></button>
              </div>
            ))}
          </div>
          <div className="grid g2 mt12">
            {row("Line name", line.name, (v) => setLine((l) => ({ ...l, name: v })))}
            <label className="field">
              <span className="label">Category</span>
              <select className="input" value={line.category} onChange={(e) => setLine((l) => ({ ...l, category: e.target.value as BudgetCategory }))}>
                {BUDGET_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            {row("Qty", line.qty, (v) => setLine((l) => ({ ...l, qty: v })), "number")}
            {row("Unit cost", line.unitCost, (v) => setLine((l) => ({ ...l, unitCost: v })), "number")}
          </div>
          <button
            className="btn mt8"
            onClick={() => {
              if (!line.name.trim()) return;
              edit((draft) => { draft.budget.lines.push({ ...blankBudgetLine(line.name, line.category), qty: line.qty, unitCost: line.unitCost }); });
              setLine({ name: "", category: "crew", qty: 1, unitCost: 0 });
            }}
          >
            Add line
          </button>
        </Panel>

        <Panel title="Your data" sub="It stays in this browser unless you export it.">
          <div className="col gap8">
            <button className="btn" onClick={() => downloadText(`${ws.project.title.replace(/\s+/g, "-").toLowerCase()}.json`, JSON.stringify(ws, null, 2), "application/json")}>
              <Icon name="download" size={12} /> Export my tour (JSON)
            </button>
            <button className="btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={12} /> Import a show pack</button>
            <button className="btn" onClick={() => cueInput.current?.click()}><Icon name="upload" size={12} /> Import cues (grandMA3 CSV)</button>
            <button className="btn" onClick={() => fixtureInput.current?.click()}><Icon name="upload" size={12} /> Import fixtures (Vectorworks CSV)</button>
            <input
              ref={cueInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const cues = cuesFromCsv(await file.text(), ws.cues.map((c) => c.id));
                if (!cues.length) {
                  store.say("No cues found. The columns are Cue, Name, Trigger, Fade, Command, Note.");
                  return;
                }
                edit((draft) => {
                  draft.cues = [...draft.cues, ...cues].sort((a, b) => a.number - b.number);
                });
                store.say(`${cues.length} cues imported from ${file.name}`);
                event.target.value = "";
              }}
            />
            <input
              ref={fixtureInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const parsed = fixturesFromCsv(await file.text());
                if (!parsed.fixtures.length) {
                  store.say("No fixtures found. The columns are id, label, kind, truss, x, y, z, watts, weight_kg.");
                  return;
                }
                edit((draft) => {
                  draft.rig.fixtures = parsed.fixtures;
                  const known = new Set(draft.rig.trusses.map((t) => t.id));
                  for (const truss of parsed.trusses) if (!known.has(truss.id)) draft.rig.trusses.push(truss);
                  const ids = new Set(parsed.fixtures.map((f) => f.id));
                  for (const look of draft.looks) {
                    look.fixtureIds = look.fixtureIds.filter((id) => ids.has(id));
                    if (!look.fixtureIds.length) look.fixtureIds = parsed.fixtures.slice(0, 6).map((f) => f.id);
                  }
                });
                store.say(`${parsed.fixtures.length} fixtures imported — the checks now use the new rig`);
                event.target.value = "";
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text()) as Pack;
                  if (!parsed.project || !Array.isArray(parsed.cues) || !Array.isArray(parsed.venues)) throw new Error("Not a CUE show pack");
                  store.importWorkspace(parsed);
                } catch (error) {
                  store.say(error instanceof Error ? error.message : "The file could not be read.");
                }
              }}
            />
            <button className="btn" onClick={() => store.setMode("demo")}><Icon name="shows" size={12} /> Open the synthetic demo</button>
            <button
              className="btn danger"
              onClick={() => {
                store.deleteWorkspace();
                navigate("/tour");
              }}
            >
              <Icon name="x" size={12} /> Delete my tour
            </button>
          </div>
          <p className="xsmall soft mt12">
            The demo and your tour are separate. Switching never deletes the other. Reset (Settings) clears decisions, not your data.
          </p>
          <div className="row gap6 mt12 wrap">
            <Chip tone="info">{ui.locale === "zh" ? "本地保存" : "saved in this browser"}</Chip>
            <Chip tone="ok">no upload</Chip>
          </div>
        </Panel>
      </div>
    </div>
  );
}
