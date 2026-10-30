import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { budgetForLook, downloadText, fmtMoney, fmtPct, toCsv } from "../lib/engine";
import { clearEvents, demoSummary, track, type DemoSummary } from "../lib/telemetry";
import { BUYER, DEMO_CUT } from "../lib/positioning";
import { Chip, PageHead, Panel, Stat } from "../components/UI";
import { Icon } from "../components/Icon";

interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export default function Manager() {
  const store = useStore();
  const ui = useUI();
  const { pack } = store;
  const m = pack.metrics;
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<DemoSummary>(() => demoSummary());
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [resetMs, setResetMs] = useState<number | null>(null);

  const aerial = budgetForLook(pack, "look-aerial-12");
  const landing = budgetForLook(pack, "look-six-beam");
  const under = (store.budgetApproved ?? pack.budget.approved) - landing;
  const iterationDrop = 1 - m.previzIterations / m.baselineIterations;
  const vote = store.vote;
  const chosen = vote === "video" ? "Video drop" : vote === "light" ? "Light drop" : "AERIAL 12 (uncommitted)";

  useEffect(() => {
    document.title = "Manager brief — CUE";
    track("manager.open");
    setSummary(demoSummary());
  }, []);

  const move = useCallback((delta: number) => {
    setStep((current) => Math.min(DEMO_CUT.length - 1, Math.max(0, current + delta)));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const runChecks = async () => {
    setChecking(true);
    const results: Check[] = [];
    try {
      const canvas = document.createElement("canvas");
      const webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
      results.push({ id: "webgl", label: "3D stage", ok: webgl, detail: webgl ? "WebGL available" : "SVG stage only" });
    } catch {
      results.push({ id: "webgl", label: "3D stage", ok: false, detail: "WebGL blocked" });
    }
    const audio = typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
    results.push({ id: "audio", label: "Room audio", ok: audio, detail: audio ? "AudioContext available" : "silent fallback" });
    let swReady = false;
    try {
      const registrations = await Promise.race([
        "serviceWorker" in navigator ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
      ]);
      swReady = Array.isArray(registrations) && registrations.length > 0;
    } catch {
      swReady = false;
    }
    results.push({ id: "sw", label: "Offline shell", ok: swReady, detail: swReady ? "service worker active" : "network-only (dev server)" });
    try {
      await Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, 1500))]);
      const fonts = document.fonts.check("12px Inter");
      results.push({ id: "fonts", label: "Fonts", ok: fonts, detail: fonts ? "Inter and mono loaded" : "system fallback" });
    } catch {
      results.push({ id: "fonts", label: "Fonts", ok: false, detail: "font check failed" });
    }
    let storage = false;
    try {
      localStorage.setItem("cue-check", "1");
      localStorage.removeItem("cue-check");
      storage = true;
    } catch {
      storage = false;
    }
    results.push({ id: "storage", label: "Local store", ok: storage, detail: storage ? "state survives a reload" : "private mode" });
    results.push({
      id: "net",
      label: "Connection",
      ok: true,
      detail: navigator.onLine ? "online" : "offline — the demo still runs",
    });
    // Measure to the next task, then the browser paints. rAF is throttled in a
    // background tab, which would make a venue check hang, so use a timer.
    const started = performance.now();
    store.reset();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
    const ms = Math.round(performance.now() - started);
    setResetMs(ms);
    results.push({ id: "reset", label: "Reset under 5 s", ok: ms < 5000, detail: `${ms} ms to a clean show` });
    setChecks(results);
    setChecking(false);
    setSummary(demoSummary());
    track("manager.venue_check", results.filter((r) => r.ok).length + "/" + results.length);
  };

  const exportProof = () => {
    const rows = [
      ["measure", "baseline", "this show", "method", "not claimed"],
      ["previz_iterations", m.baselineIterations, m.previzIterations, "reviews to approval", "not a claim about the idea"],
      ["cue_changes", 17, m.cueChanges, "cue-sheet diff in rehearsal", "not that fewer cues is better"],
      ["rig_cost_avoided_eur", 0, m.rigCostAvoided, "add-on removed before the order", "not booked until invoiced"],
      ["rehearsal_hours_saved", 0, m.rehearsalHoursSaved, "crew timesheet per show week", "not a person score"],
      ["approval_on_time", 0, m.approvalOnTime, "show versions approved before the gate", "not a creative judgement"],
      ["stage_seconds", 90, summary.stageSeconds ?? "", "local demo instrumentation", "one demo, not a study"],
      ["time_to_first_touch_ms", 15000, summary.timeToFirstTouchMs ?? "", "local demo instrumentation", "one demo, not a study"],
    ];
    downloadText(`cue-manager-proof-${pack.project.version}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };

  const printBrief = () => {
    document.body.classList.add("cue-print-brief");
    window.print();
    window.setTimeout(() => document.body.classList.remove("cue-print-brief"), 800);
  };

  const current = DEMO_CUT[step];
  const funnel = summary;

  const proof = useMemo(
    () => [
      {
        label: "Previz iterations avoided",
        value: `${Math.round(iterationDrop * 100)}%`,
        foot: `${m.previzIterations} to approval vs ${m.baselineIterations} baseline`,
      },
      { label: "Rig cost avoided", value: fmtMoney(m.rigCostAvoided), foot: "the add-on removed before the order" },
      { label: "Rehearsal time", value: `${m.rehearsalHoursSaved} h`, foot: "per show week, from the crew timesheet" },
      { label: "Approvals on time", value: fmtPct(m.approvalOnTime), foot: "show versions before the gate" },
    ],
    [iterationDrop, m.approvalOnTime, m.baselineIterations, m.previzIterations, m.rehearsalHoursSaved, m.rigCostAvoided],
  );

  return (
    <div className="manager">
      <PageHead
        kicker={`MANAGER BRIEF · ${BUYER.label.toUpperCase()}`}
        title="Run a tour, not a demo"
        sub={BUYER.sentence}
        actions={
          <>
            <Link to="/stage" className="btn primary"><Icon name="play" size={13} /> Start the 90-second show</Link>
            <button className="btn" onClick={printBrief}><Icon name="print" size={13} /> Print brief</button>
            <button className="btn" onClick={exportProof}><Icon name="download" size={13} /> Export proof</button>
          </>
        }
      />

      <div className="manager-buyer">
        {[
          ["Buyer", BUYER.label],
          ["Daily desk", BUYER.desk],
          ["Why now", BUYER.why],
          ["Not", BUYER.notFor],
        ].map(([label, text]) => (
          <div key={label} className="manager-buyer-cell">
            <span className="xsmall cap soft">{label}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="stat-rail mb24">
        {proof.map((item) => (
          <Stat key={item.label} label={item.label} value={item.value} foot={item.foot} tone="accent" />
        ))}
      </div>

      <Panel
        title="The 10-minute cut"
        sub="Arrow keys move. Each step is a live page, not a slide."
        actions={<span className="xsmall mono soft">{step + 1} / {DEMO_CUT.length} · press →</span>}
      >
        <div className="manager-steps">
          {DEMO_CUT.map((item, index) => (
            <button
              key={item.id}
              className={`manager-step${index === step ? " on" : ""}`}
              onClick={() => setStep(index)}
              aria-current={index === step}
            >
              <span className="mono">{item.n}</span>
              <b>{item.title}</b>
              <span className="soft">{item.metric} · {item.label}</span>
            </button>
          ))}
        </div>
        <div className="manager-stage">
          <div>
            <div className="page-kicker">{current.n} · {current.label.toUpperCase()}</div>
            <h3>{current.title}</h3>
            <p className="small muted">{current.say}</p>
            <div className="row gap6 mt12 wrap">
              <Link to={current.to} className="btn primary"><Icon name="arrow" size={12} /> Open this screen</Link>
              <button className="btn" onClick={() => move(-1)} disabled={step === 0}>← Back</button>
              <button className="btn" onClick={() => move(1)} disabled={step === DEMO_CUT.length - 1}>Next →</button>
            </div>
          </div>
          <div className="manager-stage-side">
            <div className="manager-quote">“{BUYER.proofLine}”</div>
            <div className="row gap6 wrap mt12">
              <Chip tone="ok">one buyer</Chip>
              <Chip>no live control</Chip>
              <Chip>human signs</Chip>
            </div>
          </div>
        </div>
      </Panel>

      <div className="manager-grid">
        <Panel title="Proof the manager remembers" sub="Modelled on this show; a pilot replaces each row with a measured value.">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Measure</th><th>Baseline</th><th>This show</th><th>Not claimed</th></tr></thead>
              <tbody>
                <tr><td>Iterations to approval</td><td>{m.baselineIterations}</td><td><b>{m.previzIterations}</b></td><td>not the quality of the idea</td></tr>
                <tr><td>Cue changes in rehearsal</td><td>17</td><td><b>{m.cueChanges}</b></td><td>not that fewer cues is better</td></tr>
                <tr><td>Rig cost avoided</td><td>—</td><td><b>{fmtMoney(m.rigCostAvoided)}</b></td><td>not booked until invoiced</td></tr>
                <tr><td>Rehearsal hours saved</td><td>—</td><td><b>{m.rehearsalHoursSaved} h</b></td><td>not a person score</td></tr>
                <tr><td>Approvals on time</td><td>—</td><td><b>{fmtPct(m.approvalOnTime)}</b></td><td>not a creative judgement</td></tr>
                <tr><td>Show cost, landing look</td><td>{fmtMoney(aerial)} hero</td><td><b>{fmtMoney(landing)}</b></td><td>before contingency is signed</td></tr>
                <tr><td>Headroom under approval</td><td>—</td><td><b>{fmtMoney(under)}</b></td><td>before the next venue variant</td></tr>
              </tbody>
            </table>
          </div>
          <div className="row gap6 mt12 wrap">
            <Chip tone={vote ? "ok" : "warn"}>{vote ? `room chose: ${chosen}` : "room has not voted"}</Chip>
            <Chip>{pack.cues.length} cues</Chip>
            <Chip>{fmtMoney(landing)} landing look</Chip>
            <Link to="/pilot" className="btn sm">Open the pilot plan <Icon name="arrow" size={10} /></Link>
          </div>
          <p className="xsmall soft mt12">
            The pilot runs one production company, three shows and 90 days against the current process. Until then these are
            modelled numbers, and the page says so. No claim without a method and a counter-claim.
          </p>
        </Panel>

        <Panel
          title="Which moments land"
          sub="Local event log. No user id, no network, no third party."
          actions={
            <div className="row gap6">
              <button className="btn sm" onClick={() => setSummary(demoSummary())}><Icon name="refresh" size={11} /> Refresh</button>
              <button className="btn sm ghost" onClick={() => { clearEvents(); setSummary(demoSummary()); track("manager.open"); }}>Clear</button>
            </div>
          }
        >
          <div className="manager-funnel">
            <div><b>{funnel.count}</b><span>{funnel.count === 1 ? "event" : "events"}</span></div>
            <div><b>{funnel.timeToFirstTouchMs === null ? "—" : `${(funnel.timeToFirstTouchMs / 1000).toFixed(1)} s`}</b><span>to first touch</span></div>
            <div><b>{funnel.stageSeconds === null ? "—" : `${funnel.stageSeconds} s`}</b><span>stage arc</span></div>
            <div><b>{funnel.reached.vote ? "yes" : "no"}</b><span>room voted</span></div>
          </div>
          <div className="row gap4 wrap mt12">
            {(["start", "touch", "reject", "vote", "finish", "sheet"] as const).map((key) => (
              <Chip key={key} tone={funnel.reached[key] ? "ok" : "info"}>{key}</Chip>
            ))}
          </div>
          <div className="manager-event-list">
            {funnel.events.slice(-8).reverse().map((event, index) => (
              <div key={`${event.at}-${index}`} className="manager-event">
                <span className="mono soft">{new Date(event.at).toLocaleTimeString(ui.locale === "zh" ? "zh-CN" : "en-GB")}</span>
                <b>{event.name}</b>
                <span className="soft">{event.detail ?? ""}</span>
              </div>
            ))}
            {funnel.events.length === 0 && <p className="xsmall soft mt8">Run the 90-second show; the beats appear here.</p>}
          </div>
        </Panel>

        <Panel
          title="Venue check"
          sub="Run it on the demo machine, in the room, before the first manager walks in."
          actions={<button className="btn sm" onClick={() => void runChecks()} disabled={checking}><Icon name="activity" size={11} /> {checking ? "Testing…" : checks ? "Run again" : "Run check"}</button>}
        >
          {checks ? (
            <div className="manager-checks">
              {checks.map((check) => (
                <div key={check.id} className="row between small">
                  <span><Icon name={check.ok ? "check" : "alert"} size={12} className={check.ok ? "done" : ""} /> {check.label}</span>
                  <span className={check.ok ? "ok" : "warn"}>{check.detail}</span>
                </div>
              ))}
              <div className="row between small mt8">
                <span className="soft">Reset drill</span>
                <b className="mono">{resetMs} ms</b>
              </div>
            </div>
          ) : (
            <div className="prose">
              <p>Checks the room, not the pitch: WebGL, audio, the offline shell, fonts, local storage, the connection and a reset under five seconds.</p>
              <p className="xsmall soft">In fallback mode the stage runs SVG with no audio: <span className="mono">#/stage?fallback=1</span>.</p>
            </div>
          )}
        </Panel>

        <Panel title="Before the demo" sub="The critique's do-not-do list, kept where the demo is built.">
          <div className="col gap6">
            {[
              "Do not drift into live console or DMX control. CUE designs; the crew runs the show.",
              "Do not pitch four buyers. This brief is the production company.",
              "Do not call it a design tool. It is a production workspace.",
              "Do not let the docs say “concept only”. This is a live demo, built.",
            ].map((rule, index) => (
              <div className="not-row" key={rule}><span className="mono xsmall soft">{String(index + 1).padStart(2, "0")}</span><span>{rule}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="xsmall soft mt16">
        {ui.showDemoNotices ? "Synthetic show. " : ""}The manager brief is local: the funnel is stored in this browser and the proof
        table is modelled until a pilot replaces it. No live control, no automatic cue release.
      </p>
    </div>
  );
}
