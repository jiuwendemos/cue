import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { fmtDateTime, fmtMoney, fmtPct } from "../lib/engine";
import { Chip, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

const SCENARIOS = [
  {
    id: "drop",
    label: "01 · The drop",
    title: "90 seconds, one decision",
    detail: "The deterministic stage piece. The AI proposes a spectacular look that is unsafe; the designer rejects it; the room votes; the cue sheet prints.",
    to: "/stage",
    meta: "90 s · sound · reset R",
    cta: "Play the stage piece",
    icon: "play",
  },
  {
    id: "show",
    label: "02 · The show",
    title: "The full design workspace",
    detail: "Stage, looks, video, blocking, cues, budget and checks. Scrub the track, drag a look onto the build, see the consequence before the render.",
    to: "/show?tab=stage&t=225",
    meta: "3 min · editable · offline",
    cta: "Open the show",
    icon: "stage",
  },
  {
    id: "venue",
    label: "03 · The venue change",
    title: "Rotterdam is 2 m smaller",
    detail: "The same show in a smaller room. The variant, the trim, the screen and the rig check. This is the daily work of the production office.",
    to: "/show?tab=stage&look=look-sideline&t=225",
    meta: "2 min · variant",
    cta: "Open the variant",
    icon: "venue",
  },
  {
    id: "readiness",
    label: "04 · Show week",
    title: "What would stop the load-in",
    detail: "Power, weight, glare, rights and one missing clip. Acknowledge, assign, dismiss with a reason, or accept no action. The brief prints.",
    to: "/readiness?brief=1",
    meta: "3 min · readiness",
    cta: "Open the brief",
    icon: "readiness",
  },
];

export default function Booth() {
  const store = useStore();
  const ui = useUI();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const steps = [
    ["0:00", "Cold open", "One lamp, one line. Let the room settle."],
    ["0:10", "First touch", "Scrub the track. Drag a look onto the build. The cost answers."],
    ["0:35", "The agent", "Three looks. The flags are visible before the choice."],
    ["1:00", "The trust beat", "Reject the unsafe look. Watch the ranking change."],
    ["1:30", "The vote", "Light drop or video drop. Commit to the room."],
    ["2:10", "The consequence", "Open readiness. Power, weight, glare, rights."],
    ["2:45", "Reset", "R on the stage, or Reset in the header. Under five seconds."],
  ];

  return (
    <div>
      <PageHead
        kicker={`${packLabel()} · deterministic booth`}
        title={ui.t("booth.title")}
        sub={ui.t("booth.sub")}
        actions={
          <>
            <Chip tone="ok" dot>offline pack</Chip>
            <button className="btn" onClick={() => { store.reset(); setStep(0); setRunning(false); }}><Icon name="reset" size={13} /> Reset booth</button>
            <Link to="/stage" className="btn primary"><Icon name="play" size={13} /> Start the 90 seconds</Link>
          </>
        }
      />

      <div className="booth-grid mb24">
        {SCENARIOS.map((s) => (
          <div className="booth-card" key={s.id}>
            <span className="num">{s.label}</span>
            <h3>{s.title}</h3>
            <p>{s.detail}</p>
            <div className="row gap4 wrap"><Chip>{s.meta}</Chip><Chip tone={s.id === "drop" ? "accent" : "neutral"}>{s.id === "drop" ? "stage" : "desk"}</Chip></div>
            <div className="foot">
              <Link to={s.to} className="btn sm"><Icon name={s.icon} size={12} /> {s.cta}</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="readiness-grid">
        <Panel title="The three-minute run" sub="Same pack, same result, no network">
          <div className="row gap6 mb12">
            <button className="btn sm" onClick={() => { setRunning(true); setStep(Math.min(steps.length - 1, step + 1)); }}><Icon name="play" size={11} /> Next beat</button>
            <button className="btn sm ghost" onClick={() => { setRunning(false); setStep(0); }}>Reset run</button>
            <span className="xsmall soft">{running ? `beat ${step + 1} / ${steps.length}` : "not running"}</span>
          </div>
          <div className="phase-list">
            {steps.map(([t, title, detail], i) => (
              <div className={`phase-row${i === step && running ? " current" : ""}`} key={t} style={{ opacity: running && i > step ? 0.45 : 1 }}>
                <b>{t}</b>
                <span style={{ flex: 1 }}><b style={{ color: "var(--ink-2)", fontFamily: "inherit", fontSize: "inherit" }}>{title}</b><span className="xsmall soft" style={{ display: "block" }}>{detail}</span></span>
                {i < step && running ? <Icon name="check" size={13} className="done" /> : null}
                {i === step && running ? <Chip tone="accent">now</Chip> : null}
              </div>
            ))}
          </div>
          <div className="row gap6 mt12 wrap">
            <button className="btn sm" onClick={() => navigate("/show?tab=stage&t=225")}>Open the workspace</button>
            <button className="btn sm" onClick={() => navigate("/readiness?brief=1")}>Open the brief</button>
            <button className="btn sm ghost" onClick={() => navigate("/agent")}>Open the agent</button>
          </div>
        </Panel>

        <aside className="col gap16">
          <Panel title="Demo architecture" sub="Offline by design">
            <div className="col gap6">
              <div className="rail-link">Fixed show and fixed stage<span className="soft xsmall">v5 seed 20261030</span></div>
              <div className="rail-link">Precomputed looks and checks<span className="soft xsmall">no cloud model call</span></div>
              <div className="rail-link">All fonts and assets local<span className="soft xsmall">no CDN</span></div>
              <div className="rail-link">Stage and booth routes separate<span className="soft xsmall">reset under 5 s</span></div>
              <div className="rail-link">Provenance panel on Q&amp;A<span className="soft xsmall">every asset</span></div>
            </div>
            <p className="xsmall soft mt12">Generated {fmtDateTime(store.pack.meta.generated)} · pack v{store.pack.meta.version} · demo window {store.pack.meta.demoWindow} s.</p>
          </Panel>

          <Panel title="What to look at" sub="The evidence, not the render">
            <div className="col gap6">
              <div className="provenance-item"><span>Power</span><b>44.1 kW against 43.5 kW. The landing look is 34.5 kW.</b></div>
              <div className="provenance-item"><span>Weight</span><b>564 kg on a 520 kg truss. 312 kg with six beams.</b></div>
              <div className="provenance-item"><span>Glare</span><b>0.92 against a 0.55 limit. The safer look has no audience-aimed fixture.</b></div>
              <div className="provenance-item"><span>Cost</span><b>{fmtMoney(29577)} hero vs {fmtMoney(27627)} landing against {fmtMoney(29000)} approved.</b></div>
              <div className="provenance-item"><span>Readiness</span><b>{fmtPct(store.pack.metrics.precision)} precision, {fmtPct(store.pack.metrics.actionableRate)} actionable, 0 missed load-ins.</b></div>
            </div>
          </Panel>

          <Panel title="After the booth" sub="The motion">
            <div className="prose">
              <p>QR to the playable demo, not a signup form. A one-page “one tour, 90 days” offer. A 10-minute booth version: one song, one drop. Follow-up within 48 hours with the recording and the one-pager. Capture 15 named production and venue leaders.</p>
            </div>
            <Link to="/pilot" className="btn sm mt12">Read the pilot offer <Icon name="arrow" size={11} /></Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function packLabel() {
  return "NOVA VALE · NIGHT SIGNAL · v5";
}
