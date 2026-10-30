import { Link } from "react-router-dom";
import { PageHead, Panel, Chip } from "../components/UI";
import { Icon } from "../components/Icon";

const TERMS = [
  ["Cue", "A numbered action on the show clock. LX, VID, STG, AUD, SFX or CAM."],
  ["Look", "A lighting state: fixtures, colour, focus and movement. A look can repeat; a gesture may not."],
  ["Rig", "The trusses, fixtures, power and rigging that carry the look."],
  ["Venue", "A room with a stage, a rig rating, a supply and a curfew."],
  ["Leg", "A run of dates inside a tour."],
  ["Load-in", "The crew's window to build the show in the venue."],
  ["Changeover", "The time to reset between shows or acts."],
  ["Trim", "The height of a flown truss or screen above the stage deck."],
  ["Sightline", "What the audience can actually see from a seat. A beautiful look can still hide the artist."],
  ["Glare", "Light aimed into the audience's eyes. CUE treats it as a safety and comfort limit, not a mood."],
  ["Safety sign-off", "A named human accepting the risk. Never automated."],
  ["Drop", "The moment the track and the show hit together. In this show, 3:45."],
  ["Universe / address", "The DMX patch coordinates for a fixture. CUE records them so the crew can reproduce the rig."],
  ["Why now?", "The evidence that makes a risk urgent today rather than eventually."],
];

const REAL = [
  "The power, weight and glare math.",
  "The cue sheet, its timing and the safety sign-off.",
  "The budget, the contingencies and the cost of a look.",
  "The readiness lifecycle and the human reject/re-rank.",
  "The audit trail and the offline reset.",
];

const MADE_UP = [
  "The artist, the songs and the venues.",
  "The rig, the set, the video and the audience.",
  "The pilot numbers and the production company.",
  "The GPU/NPU timings and the live integrations.",
  "The music: no commercial recording is used.",
];

export default function Glossary() {
  return (
    <div>
      <PageHead
        kicker="How to read this show"
        title="Glossary"
        sub="The industry has its own language. This is the short version, so a producer, a designer and a venue crew can read the same screen."
        actions={<Link to="/provenance" className="btn"><Icon name="provenance" size={13} /> What is real</Link>}
      />

      <div className="readiness-grid">
        <div className="col gap16">
          <Panel title="The words" sub="One source, not a footnote">
            <div className="glossary-grid">
              {TERMS.map(([term, def]) => (
                <div className="glossary-item" key={term}>
                  <b>{term}</b>
                  <span>{def}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="How to read a cue sheet" sub="The technical score">
            <div className="concept-rules">
              {[
                ["01", "Time is duration from doors, not time-of-day. 03:45.0 is the drop."],
                ["02", "The cue number is the unit of change. LX is light, VID is video, STG is stage, AUD is audio, SFX is effects, CAM is camera."],
                ["03", "A look is the lighting state. The cue sheet names the look, the fade and the owner."],
                ["04", "A safety cue needs a named human signature. The table will not release it without one."],
                ["05", "A rejected look resolves to the approved look on the printed sheet. The original stays visible in the editor."],
              ].map(([n, t]) => (
                <div className="rule-row" key={n}><span className="mono">{n}</span><p>{t}</p></div>
              ))}
            </div>
            <Link to="/cues" className="btn sm mt12">Open the cue sheet <Icon name="arrow" size={11} /></Link>
          </Panel>

          <Panel title="How to read a readiness risk" sub="Evidence first, action second">
            <div className="concept-rules">
              {[
                ["01", "The risk has a severity, an owner, a due time and a state: new → acknowledged → assigned → investigating → resolved or dismissed."],
                ["02", "“Why now?” is the evidence that makes it urgent. It names the source and the change."],
                ["03", "The suggested check is a recommendation. The producer, designer or crew decides."],
                ["04", "“Fixed but not verified” stays on the show-week brief until a re-check passes."],
                ["05", "A dismissal is a recorded decision with a reason category, not a delete."],
              ].map(([n, t]) => (
                <div className="rule-row" key={n}><span className="mono">{n}</span><p>{t}</p></div>
              ))}
            </div>
            <Link to="/readiness" className="btn sm mt12">Open the readiness board <Icon name="arrow" size={11} /></Link>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="What is real here" sub="The demo is synthetic; the engine is not">
            <div className="not-list">
              {REAL.map((t) => <div className="not-row" key={t}><Icon name="check" size={12} className="accent" /><span>{t}</span></div>)}
            </div>
            <div className="section-label"><span>What is made up</span></div>
            <div className="not-list">
              {MADE_UP.map((t) => <div className="not-row" key={t}><Icon name="x" size={12} /><span>{t}</span></div>)}
            </div>
            <div className="row gap6 mt12 wrap">
              <Chip tone="accent">fixed synthetic pack</Chip>
              <Chip>seed 20261030</Chip>
              <Chip>offline</Chip>
            </div>
          </Panel>

          <Panel title="The one-minute version" sub="If you only read one card">
            <p className="small muted">
              A lighting designer finds a drop that lands, rejects a spectacular look that is 44 kg over the truss and 1.6 kW over the
              house supply, and hands the crew a cue sheet that matches the show. The AI proposes; the designer decides. CUE is the
              workspace between the idea and the load-in.
            </p>
            <div className="row gap6 mt12 wrap">
              <Link to="/stage" className="btn sm primary"><Icon name="play" size={11} /> Play it</Link>
              <Link to="/about" className="btn sm">The longer story</Link>
            </div>
          </Panel>

          <Panel title="Still unsure?" sub="Ask the show">
            <p className="small muted">The agent answers from the same records in plain language. It will say when it does not know.</p>
            <Link to="/agent" className="btn sm mt12"><Icon name="agent" size={11} /> Ask the agent</Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
