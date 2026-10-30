import { Link } from "react-router-dom";
import { useUI } from "../lib/ui";
import { Icon } from "./Icon";
import { Chip, Modal } from "./UI";

export function DemoGuide({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  const ui = useUI();

  const close = () => {
    ui.markIntroSeen();
    onClose();
  };

  return (
    <Modal
      open={open}
      title="A note before the show"
      onClose={close}
      wide
      actions={
        <>
          <button className="btn" onClick={close}>Close</button>
          {onOpenSettings && <button className="btn" onClick={() => { close(); onOpenSettings(); }}><Icon name="settings" size={13} /> Settings</button>}
          <Link to="/show" className="btn primary" onClick={close}><Icon name="stage" size={13} /> Take me to the show</Link>
        </>
      }
    >
      <div className="demo-guide">
        <div className="demo-stamp" aria-hidden="true">SYNTHETIC<br />SHOW</div>
        <div className="page-kicker">NOVA VALE · NIGHT SIGNAL · A PUBLIC DEMO</div>
        <h3 className="demo-title">This show is synthetic.<br />The thinking is real.</h3>
        <p className="demo-lead">
          Nova Vale, Halcyon Hall, the crew and the tour are invented. Every number on screen is
          calculated from a fixed synthetic pack, so the demo is deterministic and runs offline.
          Nothing is uploaded. The track is synthesised in your browser.
        </p>

        <div className="demo-columns">
          <div>
            <span className="xsmall cap soft">What is real here</span>
            <div className="not-list">
              {[
                "The power, weight and glare math.",
                "The cue sheet, its timing and the safety sign-off.",
                "The budget, the contingencies and the cost of a look.",
                "The readiness lifecycle and the human reject/re-rank.",
                "The audit trail and the offline reset.",
              ].map((t) => <div className="not-row" key={t}><Icon name="check" size={12} className="accent" /><span>{t}</span></div>)}
            </div>
          </div>
          <div>
            <span className="xsmall cap soft">What is made up</span>
            <div className="not-list">
              {[
                "The artist, the songs and the venues.",
                "The rig, the set, the video and the audience.",
                "The pilot numbers and the production company.",
                "The GPU/NPU timings and the live integrations.",
                "The music: no commercial recording is used.",
              ].map((t) => <div className="not-row" key={t}><Icon name="x" size={12} /><span>{t}</span></div>)}
            </div>
          </div>
        </div>

        <div className="demo-try">
          <span className="xsmall cap soft">Try this, in order</span>
          <div className="demo-steps">
            <Link to="/show?t=225" className="demo-step" onClick={close}>
              <span className="n">01</span>
              <span><b>Scrub the show.</b> Drag a look onto the timeline. The previz and the checks follow.</span>
              <Icon name="arrow" size={13} />
            </Link>
            <Link to="/show?tab=looks" className="demo-step" onClick={close}>
              <span className="n">02</span>
              <span><b>Reject the AERIAL 12.</b> It is 44 kg over the truss and 1.6 kW over the house supply.</span>
              <Icon name="arrow" size={13} />
            </Link>
            <Link to="/readiness?brief=1" className="demo-step" onClick={close}>
              <span className="n">03</span>
              <span><b>Open the show-week brief.</b> Acknowledge, assign or dismiss with a reason.</span>
              <Icon name="arrow" size={13} />
            </Link>
            <Link to="/stage" className="demo-step" onClick={close}>
              <span className="n">04</span>
              <span><b>Play the 90 seconds.</b> One lamp, one unsafe proposal, one human decision.</span>
              <Icon name="arrow" size={13} />
            </Link>
          </div>
        </div>

        <div className="demo-foot">
          <Chip tone="accent"><Icon name="eye" size={11} /> {ui.locale === "zh" ? "合成演出" : "synthetic show"}</Chip>
          <span className="small muted">
            You can hide the synthetic-show labels in <b>Settings → Interface</b>. The data stays synthetic;
            only the notices go quiet.
          </span>
          <Link to="/glossary" className="btn sm ghost" onClick={close}>Glossary</Link>
          {onOpenSettings && <button className="btn sm ghost" onClick={() => { close(); onOpenSettings(); }}>Open settings</button>}
        </div>
      </div>
    </Modal>
  );
}
