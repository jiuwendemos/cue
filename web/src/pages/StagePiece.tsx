import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { showAudio } from "../lib/audio";
import { budgetTotal, energyAt, fmtClock, fmtMoney, songAt } from "../lib/engine";
import { track } from "../lib/telemetry";
import { StageCanvas } from "../components/StageCanvas";
import { Timeline } from "../components/Timeline";
import { Icon } from "../components/Icon";
import { Panel } from "../components/UI";
import type { Look, Pack } from "../types";

const DROP_LOOKS = ["look-aerial-12", "look-six-beam", "look-video-drop"];

type Phase = "cold" | "touch" | "agent" | "trust" | "choice" | "reveal";
type Decision = "pending" | "rejected" | "kept";
type Vote = "light" | "video" | null;

const DURATION = 92;

function phaseFor(t: number): Phase {
  if (t < 10) return "cold";
  if (t < 25) return "touch";
  if (t < 45) return "agent";
  if (t < 65) return "trust";
  if (t < 82) return "choice";
  return "reveal";
}

/**
 * The 90-second piece is the synthetic demo. In a blank workspace it explains
 * itself and offers the switch instead of pretending the story is yours.
 */
export default function StagePiece() {
  const store = useStore();
  if (store.mode === "workspace") {
    return (
      <div className="tour-start">
        <Panel title="The 90-second show is the synthetic demo" sub="Your workspace has its own cue sheet; this story belongs to Nova Vale.">
          <p className="small muted">
            The piece is a fixed, rehearsed demo: one lamp, one unsafe AI proposal, one human rejection, one room vote.
            Your tour keeps its own data. Switch to the demo to play it, or go back to your show.
          </p>
          <div className="row gap8 mt16 wrap">
            <button className="btn primary" onClick={() => store.setMode("demo")}><Icon name="play" size={13} /> Play the synthetic demo</button>
            <Link to="/tour" className="btn"><Icon name="file" size={13} /> My tour</Link>
            <Link to="/show" className="btn"><Icon name="stage" size={13} /> Open the studio</Link>
          </div>
        </Panel>
      </div>
    );
  }
  return <StagePieceInner />;
}

function StagePieceInner() {
  const navigate = useNavigate();
  const store = useStore();
  const ui = useUI();
  const { pack } = store;
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [decision, setDecision] = useState<Decision>("pending");
  const [vote, setVote] = useState<Vote>(null);
  const [finished, setFinished] = useState(false);
  const last = useRef(0);
  const decided = useRef(false);
  const voted = useRef(false);
  const touched = useRef(false);
  const [params] = useSearchParams();
  const fallback = params.get("fallback") === "1";
  // Rehearsal jump: #/stage?at=76 opens the choice beat without waiting 76 s.
  const startAt = Number(params.get("at"));
  // Kiosk: #/stage?autoplay=1&loop=1 runs the piece on a venue screen.
  const autoplay = params.get("autoplay") === "1";
  const loop = params.get("loop") === "1";
  const [scene3d, setScene3d] = useState(false);
  const [Scene3D, setScene3D] = useState<ComponentType<{ pack: Pack; look: Look; time: number; showGlare?: boolean }> | null>(null);

  const phase = phaseFor(elapsed);

  /** The first deliberate interaction is the demo's real "first touch". */
  const noteTouch = useCallback(() => {
    if (touched.current) return;
    touched.current = true;
    track("stage.touch", phaseFor(elapsed));
  }, [elapsed]);

  const enable3d = useCallback(() => {
    if (fallback) return;
    noteTouch();
    if (Scene3D) {
      setScene3d(true);
      return;
    }
    void import("../components/Stage3D")
      .then((module) => {
        setScene3D(() => module.Stage3D);
        setScene3d(true);
        track("stage.3d");
      })
      .catch(() => store.say("The 3D model could not load. The SVG stage is the fallback."));
  }, [Scene3D, fallback, noteTouch, store]);

  const stageTime = useMemo(() => {
    if (elapsed < 10) return 12;
    if (elapsed < 25) return 12 + ((elapsed - 10) / 15) * (225 - 12);
    if (elapsed < 82) return 225;
    return 225 + Math.min(20, ((elapsed - 82) / 10) * 20);
  }, [elapsed]);

  const aerial = pack.looks.find((l) => l.id === "look-aerial-12") ?? pack.looks[4];
  const six = pack.looks.find((l) => l.id === "look-six-beam") ?? pack.looks[5];
  const videoDrop = pack.looks.find((l) => l.id === "look-video-drop") ?? pack.looks[7];
  const build = pack.looks.find((l) => l.id === "look-build") ?? pack.looks[3];
  const lamp = pack.looks.find((l) => l.id === "look-one-lamp") ?? pack.looks[1];

  const previewLook = useMemo(() => {
    if (elapsed < 10) return lamp;
    if (elapsed < 25) return build;
    if (elapsed < 32) return build;
    if (elapsed < 45) return aerial;
    if (elapsed < 65) return decision === "rejected" ? six : aerial;
    return vote === "video" ? videoDrop : six;
  }, [aerial, build, decision, elapsed, lamp, six, videoDrop, vote]);

  useEffect(() => {
    document.title = "The 90-second show — CUE";
    return () => showAudio.stop();
  }, []);

  useEffect(() => {
    if (!started || paused || finished || fallback) {
      showAudio.stop();
      return;
    }
    showAudio.start(energyAt(pack, stageTime));
    return () => showAudio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, paused, finished, fallback]);

  useEffect(() => {
    if (started && !paused && !finished) showAudio.setEnergy(energyAt(pack, stageTime));
  }, [finished, pack, paused, stageTime, started]);

  useEffect(() => {
    if (!started || paused || finished) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.4, (now - last.current) / 1000);
      last.current = now;
      setElapsed((e) => Math.min(DURATION, e + dt));
    }, 80);
    return () => window.clearInterval(id);
  }, [finished, paused, started]);

  useEffect(() => {
    if (elapsed >= DURATION && !finished) {
      setFinished(true);
      showAudio.stop();
      track("stage.finish", decision === "rejected" ? "rejected" : "kept");
    }
  }, [decision, elapsed, finished]);

  useEffect(() => {
    if (!autoplay) return;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  useEffect(() => {
    if (!loop || !finished) return;
    const id = window.setTimeout(() => {
      reset();
      start();
    }, 5000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, loop]);

  useEffect(() => {
    if (elapsed >= 58 && decision === "pending" && !decided.current) {
      decided.current = true;
      setDecision("rejected");
      store.rejectSuggestion("A-01", "44 kg over the truss, 1.6 kW over supply, blinds the front row.");
    }
  }, [decision, elapsed, store]);

  useEffect(() => {
    if (elapsed >= 79 && vote === null && !voted.current) {
      voted.current = true;
      setVote("light");
      store.voteDrop("light");
    }
  }, [elapsed, store, vote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        reset();
      } else if (e.key === "Escape") {
        navigate("/show");
      } else if (e.key === " " && started) {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "y" && phase === "trust" && decision === "pending") {
        reject();
      } else if (e.key.toLowerCase() === "n" && phase === "trust" && decision === "pending") {
        keep();
      } else if (e.key === "1" && phase === "choice" && !vote) {
        choose("light");
      } else if (e.key === "2" && phase === "choice" && !vote) {
        choose("video");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, phase, started, vote]);

  const reject = () => {
    if (decision !== "pending") return;
    noteTouch();
    setDecision("rejected");
    store.rejectSuggestion("A-01", "44 kg over the truss, 1.6 kW over supply, blinds the front row.");
    track("stage.reject", "AERIAL 12");
  };
  const keep = () => {
    if (decision !== "pending") return;
    noteTouch();
    setDecision("kept");
    store.acceptSuggestion("A-01");
    track("stage.keep", "AERIAL 12");
  };
  const choose = (v: "light" | "video") => {
    if (vote) return;
    noteTouch();
    setVote(v);
    store.voteDrop(v);
    track("stage.vote", v);
  };
  const reset = () => {
    showAudio.stop();
    store.clearDrop();
    setElapsed(0);
    setDecision("pending");
    setVote(null);
    setFinished(false);
    setPaused(false);
    setStarted(false);
    decided.current = false;
    voted.current = false;
    touched.current = false;
    setScene3d(false);
    track("stage.reset");
  };
  const start = () => {
    if (!fallback) void showAudio.ensure();
    const jump = params.get("at") !== null && Number.isFinite(startAt) ? Math.min(DURATION - 1, Math.max(0, startAt)) : 0;
    setStarted(true);
    setPaused(false);
    setElapsed(jump);
    setFinished(false);
    track("stage.start", fallback ? "fallback" : jump > 0 ? `jump:${jump}` : "sound");
  };

  const copy = useMemo(() => {
    if (phase === "cold") {
      return { beat: "0:00 · COLD OPEN", line: "The tour starts in five days.", sub: "Blackout. One practical. The intro of a song no one has heard live. The drop isn't landing yet." };
    }
    if (phase === "touch") {
      return { beat: "0:10 · FIRST TOUCH", line: "Scrub the track. Drag a look onto the build.", sub: "The previz, the audio and the cost meter follow the playhead. The stage is a timeline, not a render." };
    }
    if (phase === "agent") {
      return { beat: "0:25 · THE AGENT WORKS", line: "Three looks. One video moment. Every claim cited.", sub: "It reads the rig, the venue and the energy curve. It proposes a spectacular twelve-fixture aerial for the drop." };
    }
    if (phase === "trust" && decision === "pending") {
      return { beat: "0:45 · THE TRUST BEAT", line: "It is spectacular. It is also wrong.", sub: "44 kg over the front truss. 1.6 kW over the house supply. Six beams below the front-row eyeline. The AI ranked it first on impact." };
    }
    if (phase === "trust" && decision === "rejected") {
      return { beat: "0:53 · THE DESIGNER DECIDES", line: "It was spectacular. It was wrong.", sub: "The six-fixture look with one video moment lands harder. The rejection is saved; the ranking is recomputed." };
    }
    if (phase === "trust" && decision === "kept") {
      return { beat: "0:53 · HUMAN OVERRIDE", line: "The rig stays. The risks stay open.", sub: "This is recorded as a human decision. CUE does not silently correct the designer; the readiness board will carry it." };
    }
    if (phase === "choice") {
      return { beat: "1:05 · THE ROOM VOTES", line: "Light drop, or video drop?", sub: "The light drop has higher rig cost. The video drop is cheaper on rig and heavier on cue complexity. Both are defensible." };
    }
    return { beat: "1:22 · THE REVEAL", line: "The show plays. The cue sheet prints.", sub: "The designer signs the safety cues. No cue is released automatically. Reset with R, under five seconds." };
  }, [decision, phase]);

  const song = songAt(pack, stageTime);
  const activeCue = pack.cues.filter((c) => c.at <= stageTime).slice(-1)[0];

  // The vote is not a mood: it changes the drop cue and the show cost, and the
  // printed sheet in this scene carries both.
  const chosenLook = vote === "video" ? videoDrop : six;
  // Same total the Budget screen shows, so the sheet and the budget agree.
  const showCost = budgetTotal(pack, chosenLook.id);
  const approved = store.budgetApproved ?? pack.budget.approved;
  const delta = showCost - approved;
  const printedLook = (lookId?: string) => {
    if (!lookId) return "—";
    if (DROP_LOOKS.includes(lookId)) return chosenLook.name;
    return pack.looks.find((l) => l.id === lookId)?.name ?? "—";
  };
  // A sheet excerpt that actually contains the drop, so the vote is visible in
  // the rows, not just in a headline.
  const dropCue = pack.cues.find((c) => c.lookId === "look-aerial-12") ?? pack.cues[Math.min(14, pack.cues.length - 1)];
  const sheetCues = dropCue
    ? [...pack.cues.slice(0, 4), dropCue, ...pack.cues.filter((c) => c.at > dropCue.at).slice(0, 2)]
    : pack.cues.slice(0, 8);
  const printSheet = () => {
    track("stage.sheet", chosenLook.name);
    document.body.classList.add("cue-print-sheet");
    window.print();
    window.setTimeout(() => document.body.classList.remove("cue-print-sheet"), 800);
  };

  return (
    <div className="stage-piece">
      <div className="sp-progress"><i style={{ width: `${(elapsed / DURATION) * 100}%` }} /></div>

      <div className="sp-top">
        <div className="sp-brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>CUE</span>
          <span className="soft">· THE 90-SECOND SHOW</span>
        </div>
        <div className="sp-meta">
          <span>NOVA VALE · NIGHT SIGNAL</span>
          <span>{fmtClock(elapsed)} / 1:32</span>
          {fallback && <span className="chip warn">FALLBACK</span>}
          <span>{phase.toUpperCase()}</span>
        </div>
        <div className="row gap6">
          {started && (
            <button
              className="btn sm sp-exit"
              onClick={() => {
                noteTouch();
                setPaused((p) => !p);
              }}
              aria-label={paused ? "Resume" : "Pause"}
            >
              <Icon name={paused ? "play" : "pause"} size={12} /> {paused ? "Resume" : "Pause"}
            </button>
          )}
          {!fallback && (
            <button className={`btn sm sp-exit${scene3d ? " primary" : ""}`} onClick={enable3d} aria-pressed={scene3d} title="Physical 3D model of the room">
              <Icon name="layers" size={12} /> {scene3d ? "3D" : "2D"}
            </button>
          )}
          <button className="btn sm sp-exit" onClick={reset}><Icon name="reset" size={12} /> Reset</button>
          <Link to="/show" className="btn sm sp-exit"><Icon name="x" size={12} /> Exit</Link>
        </div>
      </div>

      <div className={`sp-stage${scene3d && Scene3D && !fallback ? " sp-stage-3d" : ""}`}>
        {scene3d && Scene3D && !fallback ? (
          <Scene3D pack={pack} look={previewLook} time={stageTime} showGlare={previewLook.audienceAim > 0 && phase !== "reveal"} />
        ) : (
          <StageCanvas
            pack={pack}
            look={previewLook}
            time={stageTime}
            layer="all"
            showGlare={previewLook.audienceAim > 0 && phase !== "reveal"}
            showLabels
            presenter
          />
        )}

        <div className="sp-overlay">
          <div className="sp-copy sp-fadein" key={copy.line}>
            <div className="sp-beat">{copy.beat}</div>
            <div className="sp-line">{copy.line.split(" ").map((word, i) => <span key={`${word}-${i}`}>{word} </span>)}</div>
            <p className="sp-sub">{copy.sub}</p>
          </div>

          <div className="sp-bottom">
            <div className="sp-controls">
              {phase === "trust" && decision === "pending" && (
                <>
                  <button className="btn danger lg" onClick={reject}><Icon name="x" size={14} /> Reject the look</button>
                  <button className="btn lg" onClick={keep}>Keep it</button>
                  <span className="sp-countdown">auto-rejects at 0:58 · {Math.max(0, 58 - elapsed).toFixed(0)}s</span>
                </>
              )}
              {phase === "choice" && !vote && (
                <>
                  <button className="btn primary lg" onClick={() => choose("light")}>1 · Light drop</button>
                  <button className="btn lg" onClick={() => choose("video")}>2 · Video drop</button>
                  <span className="sp-countdown">the room is voting · {Math.max(0, 79 - elapsed).toFixed(0)}s</span>
                </>
              )}
              {phase === "reveal" && (
                <>
                  <Link to="/cues" className="btn primary lg"><Icon name="cue" size={14} /> Open the cue sheet</Link>
                  <Link to="/budget" className="btn lg"><Icon name="budget" size={13} /> Budget</Link>
                  <Link to="/manager" className="btn lg"><Icon name="target" size={13} /> Manager brief</Link>
                  <button className="btn lg" onClick={reset}><Icon name="reset" size={13} /> R · Reset</button>
                </>
              )}
              {phase !== "trust" && phase !== "choice" && phase !== "reveal" && (
                <span className="sp-countdown">SPACE pause · R reset · ESC exit</span>
              )}
            </div>
            <div className="sp-now">
              <span className="mono">{song?.title}</span>
              <span className="soft">{fmtClock(stageTime)} · {activeCue?.id ?? "—"} · {previewLook.name}</span>
            </div>
          </div>
        </div>

        <div className="sp-side">
          {phase === "agent" && (
            <div className="sp-card sp-fadein">
              <h4>Agent · three looks, one video</h4>
              <div className="sp-suggest">
                <div className="sp-suggest-row top">
                  <span><b>AERIAL 12</b><span className="soft">impact 97 · +€3,900</span></span>
                  <span className="chip bad">3 flags</span>
                </div>
                <div className="sp-suggest-row">
                  <span><b>SIX BEAM + MONOLITH</b><span className="soft">impact 89 · +€1,950</span></span>
                  <span className="chip ok">passes</span>
                </div>
                <div className="sp-suggest-row">
                  <span><b>SIDELINE WHISPER</b><span className="soft">impact 62 · +€320</span></span>
                  <span className="chip ok">passes</span>
                </div>
              </div>
              <p>The system ranks on impact first. The human is the safety check.</p>
            </div>
          )}

          {phase === "trust" && (
            <>
              <div className="sp-card sp-warning sp-fadein">
                <h4>Rig check · AERIAL 12</h4>
                <div className="big">44.1 / 43.5 kW</div>
                <p>House supply exceeded by 1.6 kW. The extra six beams are the difference.</p>
              </div>
              <div className="sp-card sp-warning sp-fadein">
                <h4>Rigging · front truss</h4>
                <div className="big">564 / 520 kg</div>
                <p>44 kg over the rating. The load test covers the base rig, not the add-on.</p>
              </div>
              <div className="sp-card sp-warning sp-fadein">
                <h4>Sightline · front row</h4>
                <div className="big">glare 0.92</div>
                <p>Six beams at 18° elevation, below the 1.15 m eyeline. Limit 0.55.</p>
              </div>
              {decision === "rejected" && (
                <div className="sp-card sp-fadein" style={{ borderColor: "rgba(215,255,79,.4)" }}>
                  <h4>Re-ranked</h4>
                  <div className="big" style={{ color: "#d7ff4f" }}>SIX BEAM</div>
                  <p>Impact 89. 34.5 kW. 312 kg. No audience-aimed fixture. The rejection is saved to the show.</p>
                </div>
              )}
            </>
          )}

          {phase === "choice" && (
            <div className="sp-card sp-fadein">
              <h4>The room votes · the drop</h4>
              <div className="sp-choice">
                <button className={vote === "light" ? "on" : ""} onClick={() => choose("light")}>
                  <b>Light drop</b>
                  <span>impact 89 · 34.5 kW · +€1,950 content</span>
                </button>
                <button className={vote === "video" ? "on" : ""} onClick={() => choose("video")}>
                  <b>Video drop</b>
                  <span>impact 84 · 19.9 kW · +€2,400 · missing clip</span>
                </button>
              </div>
              <p>{vote === "video"
                ? "Committed. The video drop is cheaper on rig, but SIGNAL BARS is still missing. The cue sheet carries the risk."
                : "Committed. The light drop keeps the rig working; the content add-on is clear."}</p>
            </div>
          )}

          {phase === "reveal" && (
            <div className="sp-card sp-paper sp-fadein" style={{ background: "rgba(245,242,233,.96)", color: "#141610", borderColor: "rgba(20,22,16,.2)" }}>
              <div className="sp-paper-head">
                <div>
                  <h4 style={{ color: "#555", letterSpacing: ".12em" }}>CUE SHEET · SHOW v5</h4>
                  <b style={{ fontSize: 18, letterSpacing: ".04em" }}>NOVA VALE — NIGHT SIGNAL</b>
                </div>
                <div style={{ textAlign: "right", fontSize: 9, color: "#555" }}>
                  DESIGNER<br />Mara Voss
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #bbb", borderBottom: "1px solid #bbb", padding: "6px 0", margin: "8px 0" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", color: "#555" }}>
                  THE DROP · {vote === "video" ? "VIDEO WON" : "LIGHT WON"}
                </span>
                <b style={{ fontSize: 14 }}>{chosenLook.name}</b>
              </div>
              <table className="sp-paper-table">
                <thead><tr><th>#</th><th>Cue</th><th>At</th><th>Action</th><th>Look</th></tr></thead>
                <tbody>
                  {sheetCues.map((c) => (
                    <tr key={c.id} className={c.id === dropCue?.id ? "drop" : c.safety ? "warn" : ""}>
                      <td>{c.number}</td>
                      <td>{c.id}</td>
                      <td>{fmtClock(c.at)}</td>
                      <td>{c.title}{c.id === dropCue?.id ? " · the drop" : ""}</td>
                      <td>{printedLook(c.lookId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                <span>Show cost <b>{fmtMoney(showCost)}</b></span>
                <span>Approved <b>{fmtMoney(approved)}</b></span>
                <span style={{ color: delta <= 0 ? "#1f6b2a" : "#9a2b1f" }}>
                  {delta <= 0 ? "Under" : "Over"} <b>{fmtMoney(Math.abs(delta))}</b>
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                <span style={{ fontSize: 9, color: "#555" }}>Safety sign-off: Mara Voss · no cue released automatically.</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, border: "1px dashed #999", padding: "4px 7px" }}>MV-1030</span>
              </div>
              <div className="row between mt12 no-print">
                <button className="btn sm" onClick={printSheet}><Icon name="print" size={11} /> Print this sheet</button>
                <span style={{ fontSize: 9, color: "#555" }}>Same numbers on screen and on paper.</span>
              </div>
            </div>
          )}
        </div>

        <div className="sp-timeline">
          <Timeline pack={pack} cues={pack.cues} time={stageTime} onScrub={() => undefined} height={76} compact />
        </div>
      </div>

      {!started && (
        <div className="sp-start">
          <div className="sp-start-inner">
            <div className="page-kicker" style={{ color: "#d7ff4f" }}>NOVA VALE · NIGHT SIGNAL · 90 SECONDS</div>
            <h1>The show is designed<br /><em>before the lights go down.</em></h1>
            <p>One lamp, one drop, one human decision. The AI proposes a spectacular look. It is also unsafe. You decide.</p>
            <button className="btn primary" onClick={start}><Icon name="play" size={16} /> {store.vote ? "Play again" : "Play the 90-second show"}</button>
            <p className="xsmall soft" style={{ marginTop: 14 }}>
              {fallback ? "Silent fallback mode. Deterministic SVG stage." : "Sound on. Deterministic."} Press R to reset, ESC to exit.
            </p>
            {ui.showDemoNotices && (
              <p className="xsmall soft" style={{ marginTop: 6 }}>
                A synthetic show: Nova Vale, the venue and the track are invented for this demo.{" "}
                <Link to="/glossary" style={{ color: "#d7ff4f" }}>How to read it →</Link>
              </p>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div className="sp-finish">
          <div className="sp-finish-inner">
            <div className="sp-brand" style={{ justifyContent: "center", marginBottom: 14 }}>
              <span className="brand-mark" aria-hidden="true"><i /></span><span>CUE</span>
            </div>
            <h2>The show is designed<br />before the lights go down.</h2>
            <p>
              {decision === "rejected" ? "The designer rejected the unsafe look. " : "The designer kept the rig; the risk stays open. "}
              {vote === "video" ? "The room chose the video drop" : "The room chose the light drop"}
              {` at ${fmtMoney(showCost)} — ${delta <= 0 ? "under" : "over"} the approved budget by ${fmtMoney(Math.abs(delta))}. `}
              The cue sheet is signed. The show is ready — or it isn't, and the readiness board says why.
            </p>
            <div className="row gap8" style={{ justifyContent: "center", marginTop: 18 }}>
              <button className="btn primary" onClick={reset}><Icon name="reset" size={13} /> Reset · R</button>
              <Link to="/show" className="btn">Open the show</Link>
              <Link to="/readiness" className="btn">Readiness board</Link>
            </div>
            <div className="sp-finish-meta">
              <span>{fmtMoney(showCost)} · {chosenLook.name}</span>
              <span>{delta <= 0 ? `${fmtMoney(Math.abs(delta))} under` : `${fmtMoney(Math.abs(delta))} over`} approved</span>
              <span>{pack.project.version} · {pack.project.tour}</span>
            </div>
          </div>
        </div>
      )}

      {paused && !finished && started && (
        <div className="sp-paused" onClick={() => setPaused(false)}>
          <div>
            <div className="sp-beat">PAUSED</div>
            <p>Click or press Space to continue.</p>
          </div>
        </div>
      )}
    </div>
  );
}
