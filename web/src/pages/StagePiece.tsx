import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { showAudio } from "../lib/audio";
import { energyAt, fmtClock, fmtMoney, songAt } from "../lib/engine";
import { StageCanvas } from "../components/StageCanvas";
import { Timeline } from "../components/Timeline";
import { Icon } from "../components/Icon";

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

export default function StagePiece() {
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

  const phase = phaseFor(elapsed);

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
    if (!started || paused || finished) {
      showAudio.stop();
      return;
    }
    showAudio.start(energyAt(pack, stageTime));
    return () => showAudio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, paused, finished]);

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
    }
  }, [elapsed, finished]);

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
    setDecision("rejected");
    store.rejectSuggestion("A-01", "44 kg over the truss, 1.6 kW over supply, blinds the front row.");
  };
  const keep = () => {
    if (decision !== "pending") return;
    setDecision("kept");
    store.acceptSuggestion("A-01");
  };
  const choose = (v: "light" | "video") => {
    if (vote) return;
    setVote(v);
    store.voteDrop(v);
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
  };
  const start = () => {
    void showAudio.ensure();
    setStarted(true);
    setPaused(false);
    setElapsed(0);
    setFinished(false);
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
          <span>{phase.toUpperCase()}</span>
        </div>
        <div className="row gap6">
          {started && (
            <button className="btn sm sp-exit" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume" : "Pause"}>
              <Icon name={paused ? "play" : "pause"} size={12} /> {paused ? "Resume" : "Pause"}
            </button>
          )}
          <button className="btn sm sp-exit" onClick={reset}><Icon name="reset" size={12} /> Reset</button>
          <Link to="/show" className="btn sm sp-exit"><Icon name="x" size={12} /> Exit</Link>
        </div>
      </div>

      <div className="sp-stage">
        <StageCanvas
          pack={pack}
          look={previewLook}
          time={stageTime}
          layer="all"
          showGlare={previewLook.audienceAim > 0 && phase !== "reveal"}
          showLabels
          presenter
        />

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
                  <button className="btn lg" onClick={reset}><Icon name="reset" size={13} /> R · Reset</button>
                  <Link to="/readiness" className="btn lg"><Icon name="readiness" size={13} /> Readiness board</Link>
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
            <div className="sp-card sp-fadein" style={{ background: "rgba(245,242,233,.96)", color: "#141610", borderColor: "rgba(20,22,16,.2)" }}>
              <div className="sp-paper-head">
                <div>
                  <h4 style={{ color: "#555", letterSpacing: ".12em" }}>CUE SHEET · SHOW v5</h4>
                  <b style={{ fontSize: 18, letterSpacing: ".04em" }}>NOVA VALE — NIGHT SIGNAL</b>
                </div>
                <div style={{ textAlign: "right", fontSize: 9, color: "#555" }}>
                  DESIGNER<br />Mara Voss
                </div>
              </div>
              <table className="sp-paper-table">
                <thead><tr><th>#</th><th>Cue</th><th>At</th><th>Action</th><th>Look</th></tr></thead>
                <tbody>
                  {pack.cues.slice(0, 8).map((c) => (
                    <tr key={c.id} className={c.safety ? "warn" : ""}>
                      <td>{c.number}</td>
                      <td>{c.id}</td>
                      <td>{fmtClock(c.at)}</td>
                      <td>{c.title}</td>
                      <td>{c.lookId ? pack.looks.find((l) => l.id === c.lookId)?.name : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 }}>
                <span style={{ fontSize: 9, color: "#555" }}>Safety sign-off: Mara Voss · no cue released automatically.</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, border: "1px dashed #999", padding: "4px 7px" }}>MV-1030</span>
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
            <p className="xsmall soft" style={{ marginTop: 14 }}>Sound on. Deterministic. Press R to reset, ESC to exit.</p>
            {ui.showDemoNotices && <p className="xsmall soft" style={{ marginTop: 6 }}>A synthetic show: Nova Vale, the venue and the track are invented for this demo.</p>}
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
              {vote === "video" ? "The room chose the video drop." : "The room chose the light drop."}
              {" "}The cue sheet is signed. The show is ready — or it isn't, and the readiness board says why.
            </p>
            <div className="row gap8" style={{ justifyContent: "center", marginTop: 18 }}>
              <button className="btn primary" onClick={reset}><Icon name="reset" size={13} /> Reset · R</button>
              <Link to="/show" className="btn">Open the show</Link>
              <Link to="/readiness" className="btn">Readiness board</Link>
            </div>
            <div className="sp-finish-meta">
              <span>{fmtMoney(27527)} landing look</span>
              <span>{pack.cues.length} cues</span>
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
