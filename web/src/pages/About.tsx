import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { Chip, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

export default function About() {
  const store = useStore();
  const ui = useUI();
  const { pack } = store;

  return (
    <div>
      <PageHead kicker="About CUE" title="A design studio for the show before the show" sub={`${pack.project.tour} · public demo · synthetic production`} />

      <div className="about-hero mb24">
        <div>
          <h1>The show is designed<br />before the lights go down.</h1>
          <p>
            CUE is the live show design studio. It connects the concept, the stage, the looks, the video,
            the blocking, the setlist, the cue sheet and the budget on one timeline — and exports into the
            tools the crew already uses.
          </p>
          <div className="row gap8 mt16 wrap">
            <Link to="/stage" className="btn primary"><Icon name="play" size={13} /> Play the 90-second show</Link>
            <Link to="/show" className="btn"><Icon name="stage" size={13} /> Open the show</Link>
            <Link to="/pilot" className="btn ghost">Read the pilot</Link>
          </div>
        </div>
        <Panel title="Who it is for" sub="Production companies, touring artists, venues, festivals, brand experiences">
          <div className="col gap6">
            {["Creative director", "Production designer", "Lighting designer", "Video designer", "Tour manager", "Venue crew"].map((r) => (
              <div key={r} className="rail-link">{r}<span className="soft xsmall">{r === "Tour manager" || r === "Venue crew" ? "phone surface" : "desk surface"}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid g2 mb24">
        <Panel title="What CUE is" sub="One project, not eight files">
          <div className="col gap6">
            {[
              "A previz you can play, pause and scrub, with sound.",
              "A cue sheet for lighting, video and stage, with safety signatures.",
              "A rig and budget plan where every look has a cost.",
              "Versions for each venue, tour leg and rehearsal.",
              "A readiness desk that catches venue, rig, rights and asset problems before load-in.",
              "A record of what changed, who approved it and why.",
            ].map((t) => <div className="not-row" key={t}><Icon name="check" size={12} className="accent" /><span>{t}</span></div>)}
          </div>
        </Panel>
        <Panel title="What CUE is not" sub="Enforced as non-goals">
          <div className="not-list">
            {[
              "Not a lighting console. No DMX, no live show control.",
              "Not a renderer replacement. Depence², WYSIWYG, Capture and Vectorworks remain the previz and drafting tools.",
              "Not a music generator. It works with the artist's track.",
              "Not a CAD replacement. It is the design layer above the drafting.",
              "Not autonomous. The designer authors; the AI proposes and checks.",
            ].map((t) => <div className="not-row" key={t}><Icon name="x" size={12} /><span>{t}</span></div>)}
          </div>
        </Panel>
      </div>

      <div className="section-label"><span>The trust beat</span><span className="soft xsmall">the product in one minute</span></div>
      <Panel>
        <div className="grid g3">
          <div>
            <div className="page-kicker">The proposal</div>
            <h3 style={{ fontSize: 18 }}>AERIAL 12</h3>
            <p className="small muted mt8">Twelve beams fan the full width; six wash the front row. Impact 97. In previz it is spectacular.</p>
            <div className="row gap4 mt8 wrap"><Chip tone="bad">44.1 kW</Chip><Chip tone="bad">564 kg</Chip><Chip tone="bad">glare 0.92</Chip></div>
          </div>
          <div>
            <div className="page-kicker">The decision</div>
            <h3 style={{ fontSize: 18 }}>The designer rejects it</h3>
            <p className="small muted mt8">44 kg over the truss. 1.6 kW over the house supply. Six beams below the front-row eyeline. A human says no, and the reason is stored.</p>
            <div className="row gap4 mt8 wrap"><Chip tone="accent">human decision</Chip><Chip>re-ranked</Chip></div>
          </div>
          <div>
            <div className="page-kicker">The landing</div>
            <h3 style={{ fontSize: 18 }}>SIX BEAM + MONOLITH</h3>
            <p className="small muted mt8">Impact 89. 34.5 kW. 312 kg. No audience-aimed fixture. The drop is a horizon, not a rig.</p>
            <div className="row gap4 mt8 wrap"><Chip tone="ok">within supply</Chip><Chip tone="ok">within rating</Chip><Chip tone="ok">€1,373 under</Chip></div>
          </div>
        </div>
        <p className="home-quote mt24">“It was spectacular. It was wrong. <b>The show is not the rig.</b>”</p>
      </Panel>

      <div className="grid g2 mt24">
        <Panel title="The wedge" sub="Not a better renderer">
          <p className="small muted">
            The incumbents are strong. CUE does not try to beat Depence² at previz or grandMA3 at control.
            It is the AI-native design layer that connects concept, previz, cue sheet and budget — and exports
            into the crew's tools. The moat is the workflow and the evidence, not the polygon count.
          </p>
          <div className="row gap6 mt12 wrap">
            <Chip tone="accent">one timeline</Chip>
            <Chip>cost of each look</Chip>
            <Chip>readiness before load-in</Chip>
            <Chip>exports, not lock-in</Chip>
          </div>
        </Panel>
        <Panel title="The pilot" sub="One tour, one venue, 90 days">
          <p className="small muted">
            Start with one production company and three shows, not a whole festival. Baseline the current
            process. Run in shadow mode. Measure iterations to approval, cue changes, rig cost avoided,
            rehearsal time and readiness precision. Written kill criteria before launch.
          </p>
          <div className="row gap6 mt12 wrap">
            <Chip>fewer previz iterations</Chip>
            <Chip>fewer rehearsal changes</Chip>
            <Chip>rig cost avoided</Chip>
            <Chip>rehearsal time saved</Chip>
          </div>
          <Link to="/pilot" className="btn sm mt12">Open the pilot dashboard <Icon name="arrow" size={11} /></Link>
          <a href="https://github.com/jiuwendemos/cue/blob/main/docs/roadmap-next.md" target="_blank" rel="noreferrer" className="btn sm mt8">
            <Icon name="external" size={11} /> The next three tracks
          </a>
        </Panel>
      </div>

      <div className="section-label"><span>Status</span><span className="soft xsmall">what is built in this repository</span></div>
      <div className="pilot-grid">
        {[
          ["0A", "Stage piece", "Built. Deterministic 90-second show with sound, trust beat, vote, cue-sheet reveal and R reset under five seconds."],
          ["0B", "Functional demo", "Built. Editable show, looks, video, blocking, cue sheet, budget, checks, offline pack."],
          ["1", "First pilot surface", "Built as software: venue profile, rights register, budget, cue export, approvals, audit. A real pilot still needs one production company."],
          ["4", "Tour readiness", "Built. Risk board, lifecycle, show-week brief, digests, dismissal taxonomy, kill switch, coverage and precision."],
          ["5", "Interface 2026", "Built. Themes, tokens, command palette, role navigation, mobile review, keyboard path, provenance, EN/中文 chrome."],
          ["6", "Production wiring", "Code paths for the agent, render/inference, integrations, store and security. The end-to-end gate needs a real tour."],
        ].map(([id, title, detail]) => (
          <div className="booth-card" key={id}>
            <span className="num">{id}</span>
            <h3>{title}</h3>
            <p>{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid g2 mt24">
        <Panel title="Data, honestly" sub="See the provenance sheet">
          <p className="small muted">{pack.provenance.note} {pack.provenance.dataStay}</p>
          <Link to="/provenance" className="btn sm mt12">Provenance and rights <Icon name="arrow" size={11} /></Link>
        </Panel>
        <Panel title="Licence and credit" sub="MIT">
          <p className="small muted">
            The code is MIT. The public demo uses a synthetic show, generated stage and video assets, and a
            track synthesised in the browser from the show energy curve. No commercial recording, no artist
            likeness and no venue data are used.
          </p>
          <p className="xsmall soft mt12">Built as a demonstration of evidence-first live-show design. The designer owns the decision; CUE never runs the show.</p>
        </Panel>
      </div>

      <p className="home-quote mt24">The show is designed before the lights go down. <span className="soft" style={{ fontSize: 14 }}>· {ui.locale === "zh" ? "在灯光暗下之前，演出已经设计完成。" : "CUE · public demo · " + pack.project.version}</span></p>
    </div>
  );
}
