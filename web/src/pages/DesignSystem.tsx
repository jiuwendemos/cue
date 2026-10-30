import { useState } from "react";
import { useUI } from "../lib/ui";
import { Chip, Meter, PageHead, Panel, Swatches, Tabs, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

const TOKENS = [
  ["--bg", "#07080a", "The room before the show"],
  ["--surface", "#0f1214", "Panels, rails, the desk"],
  ["--ink", "#f3f0e7", "Primary text"],
  ["--muted", "#9aa093", "Secondary text"],
  ["--accent", "#d7ff4f", "One accent. The cue light."],
  ["--ok", "#5fe3a1", "Verified, pass, healthy"],
  ["--warn", "#ffb454", "Budget, schedule, review"],
  ["--bad", "#ff6b62", "Safety, stop-work, fail"],
  ["--rights", "#b18cff", "Rights and licence only"],
  ["--verified", "#51e0d2", "Video and signal"],
];

export default function DesignSystem() {
  const ui = useUI();
  const [tab, setTab] = useState<"foundations" | "components" | "accessibility" | "content">("foundations");
  const [toggle, setToggle] = useState(true);
  const [meter, setMeter] = useState(0.68);

  return (
    <div>
      <PageHead
        kicker="Interface 2026 · living catalogue"
        title="Design system"
        sub="Built for a dark control room, a bright production office and a phone in a venue basement. One accent, semantic colour, no text below 11 px, keyboard-first."
        actions={
          <>
            <button className="btn" onClick={ui.toggleTheme}><Icon name="contrast" size={13} /> {ui.theme}</button>
            <select className="select" style={{ maxWidth: 130 }} value={ui.locale} onChange={(e) => ui.setLocale(e.target.value as "en" | "zh")} aria-label="Language">
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </>
        }
      />

      <Tabs
        items={[
          { id: "foundations", label: "Foundations" },
          { id: "components", label: "Components" },
          { id: "accessibility", label: "Accessibility" },
          { id: "content", label: "Content and voice" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {tab === "foundations" && (
        <div className="col gap16">
          <Panel title="Mark" sub="Works at 16 px, 32 px and stage scale">
            <div className="row gap24 wrap">
              <div className="row gap10">
                <span className="brand-mark" style={{ width: 16, height: 16 }} aria-hidden="true"><i /></span>
                <span className="brand-mark" style={{ width: 32, height: 32 }} aria-hidden="true"><i /></span>
                <span className="brand-mark" style={{ width: 64, height: 64 }} aria-hidden="true"><i /></span>
                <span className="brand-mark" style={{ width: 110, height: 110 }} aria-hidden="true"><i /></span>
              </div>
              <div>
                <div className="brand" style={{ minWidth: 0, padding: 0 }}><span className="brand-text"><b style={{ fontSize: 18, letterSpacing: ".24em" }}>CUE</b><small>Live show design studio</small></span></div>
                <p className="xsmall soft mt8">The mark is a cue light: a beam, a lit dot and the deck line. It never contains a wordmark.</p>
              </div>
            </div>
          </Panel>

          <div className="grid g2">
            <Panel title="Colour tokens" sub="Semantic colour is reserved for meaning; the accent is the only decorative colour">
              <div className="swatch-grid">
                {TOKENS.map(([token, hex, note]) => (
                  <div className="swatch-card" key={token}>
                    <i style={{ background: hex }} />
                    <span><b className="mono" style={{ color: "var(--ink-2)" }}>{token}</b><br />{note}</span>
                  </div>
                ))}
              </div>
              <p className="xsmall soft mt12">Color-blind-safe: success and danger differ in hue and position, never hue alone. The risk board uses a severity bar and a label, not only a colour.</p>
            </Panel>

            <Panel title="Theme" sub="Dark, light and high contrast are designed together, not inverted">
              <div className="row gap6 mb12">
                {(["dark", "light", "contrast"] as const).map((t) => (
                  <button key={t} className={`btn sm${ui.theme === t ? " primary" : ""}`} onClick={() => ui.setTheme(t)}>{t}</button>
                ))}
                <button className="btn sm" onClick={ui.toggleTheme}>Cycle</button>
              </div>
              <div className="token-row"><span>Density</span><div className="row gap4"><button className={`btn sm${ui.density === "comfortable" ? " primary" : " ghost"}`} onClick={() => ui.setDensity("comfortable")}>Comfortable</button><button className={`btn sm${ui.density === "compact" ? " primary" : " ghost"}`} onClick={() => ui.setDensity("compact")}>Compact</button></div></div>
              <div className="token-row"><span>Reduced motion</span><Toggle on={ui.reducedMotion} onChange={ui.setReducedMotion} label="Reduced motion" /></div>
              <div className="token-row"><span>Locale</span><span className="mono">{ui.locale}</span></div>
              <div className="panel mt12" style={{ padding: 14, background: "var(--bg-2)" }}>
                <span className="xsmall cap soft">Preview</span>
                <p className="small mt8">The show is designed before the lights go down.</p>
                <div className="row gap6 mt8"><Chip tone="accent">accent</Chip><Chip tone="warn">warn</Chip><Chip tone="bad">safety</Chip><Chip tone="rights">rights</Chip></div>
              </div>
            </Panel>
          </div>

          <Panel title="Type scale" sub="Inter Variable for the desk, JetBrains Mono for the records">
            <div className="col gap8">
              {[
                ["Display 62 / 1.0", "The show is designed before the lights go down.", "clamp(34px, 5vw, 62px)", "display"],
                ["Title 38 / 1.02", "Night Signal · v5", "clamp(25px, 3.1vw, 38px)", "display"],
                ["Heading 23 / 1.16", "The drop is a horizon, not a rig.", "23px", "display"],
                ["Body 13.5 / 1.5", "One workspace for the stage, the looks, the video, the blocking, the cues and the budget.", "13.5px", "body"],
                ["Mono 11 / 1.45", "LX 7 · 03:45.0 · SIX BEAM + MONOLITH · signed MV-1030", "11px", "mono"],
              ].map(([label, sample, style, family]) => (
                <div key={label} className="token-row" style={{ alignItems: "flex-start" }}>
                  <span className="xsmall soft mono" style={{ minWidth: 170 }}>{label}</span>
                  <span style={{ fontSize: style, fontFamily: family === "mono" ? "var(--font-mono)" : family === "display" ? "var(--font-display)" : undefined, lineHeight: 1.1, flex: 1 }}>{sample}</span>
                </div>
              ))}
              <p className="xsmall soft">No text below 11 px in product chrome. The 3D previz labels are diagram annotations, not UI copy.</p>
            </div>
          </Panel>

          <Panel title="Space, radius and motion" sub="Tokens compiled from one source">
            <div className="token-grid">
              <div>
                {["--space-1 4", "--space-2 8", "--space-3 12", "--space-4 16", "--space-5 24", "--space-6 32", "--space-7 48"].map((t) => (
                  <div className="token-row" key={t}><span className="mono">{t.split(" ")[0]}</span><span className="mono">{t.split(" ")[1]} px</span></div>
                ))}
              </div>
              <div>
                {[["--radius-xs", "3 px"], ["--radius-sm", "6 px"], ["--radius", "9 px"], ["--radius-lg", "13 px"], ["--dur", "180 ms"], ["--ease", "cubic-bezier(.2,.7,.2,1)"]].map(([a, b]) => (
                  <div className="token-row" key={a}><span className="mono">{a}</span><span className="mono">{b}</span></div>
                ))}
              </div>
            </div>
            <p className="xsmall soft mt12">Motion is for orientation, not decoration. The previz camera, cue transitions and drawers respect reduced motion.</p>
          </Panel>
        </div>
      )}

      {tab === "components" && (
        <div className="col gap16">
          <Panel title="Buttons and chips" sub="The action hierarchy is visible at 10 metres">
            <div className="component-row">
              <button className="btn primary"><Icon name="play" size={13} /> Primary</button>
              <button className="btn">Secondary</button>
              <button className="btn ok">Approve</button>
              <button className="btn danger">Reject</button>
              <button className="btn ghost">Ghost</button>
              <button className="btn" disabled>Disabled</button>
            </div>
            <div className="component-row">
              <Chip tone="accent">accent</Chip><Chip tone="ok">pass</Chip><Chip tone="warn">warn</Chip><Chip tone="bad">fail</Chip><Chip tone="info">info</Chip><Chip tone="rights">rights</Chip><Chip>neutral</Chip>
            </div>
            <div className="component-row">
              <Swatches colors={["#d7ff4f", "#51e0d2", "#ffb454"]} size={16} />
              <span className="kbd">⌘K</span>
              <span className="tag">tag</span>
              <span className="sign-badge"><Icon name="check" size={11} /> MV-1030</span>
            </div>
          </Panel>

          <div className="grid g2">
            <Panel title="Inputs" sub="32 px minimum, 44 px on phones">
              <div className="col gap10">
                <div className="field"><label htmlFor="ds-input">Venue</label><input id="ds-input" className="input" defaultValue="Halcyon Hall" /></div>
                <div className="field"><label htmlFor="ds-select">Look</label><select id="ds-select" className="select"><option>SIX BEAM + MONOLITH</option><option>AERIAL 12</option></select></div>
                <div className="field"><label htmlFor="ds-text">Note</label><textarea id="ds-text" className="textarea" defaultValue="The front row is never the target." /></div>
                <div className="row between"><span className="small soft">Reduced motion</span><Toggle on={toggle} onChange={setToggle} label="Toggle demo" /></div>
              </div>
            </Panel>
            <Panel title="Meters and data" sub="Numbers with a limit, not a bare chart">
              <div className="col gap12">
                <Meter value={meter} max={1} tone={meter > 0.9 ? "bad" : "ok"} label="Front truss" right={`${Math.round(meter * 520)} / 520 kg`} />
                <input type="range" min={0} max={1} step={0.01} value={meter} onChange={(e) => setMeter(Number(e.target.value))} aria-label="Demo meter" />
                <div className="row gap8">
                  <span className="stat"><span className="stat-label">Cue</span><span className="stat-value" style={{ fontSize: 24 }}>LX 7</span></span>
                  <span className="stat"><span className="stat-label">Impact</span><span className="stat-value" style={{ fontSize: 24 }}>89</span></span>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Timeline and cue row" sub="The core instrument">
            <div className="timeline">
              <div className="timeline-foot" style={{ borderTop: 0, borderBottom: "1px solid var(--line)" }}>
                <span className="mono">03:45.0</span>
                <span className="timeline-kinds"><span><i style={{ background: "#d7ff4f" }} /> LX</span><span><i style={{ background: "#51e0d2" }} /> VID</span><span><i style={{ background: "#ffb454" }} /> SFX</span></span>
                <span className="soft">The playhead is the single source of time.</span>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div className="row between small"><span><b className="mono accent">LX 7</b> · THE DROP</span><span className="mono soft">03:45.0</span><span><Chip tone="bad">safety</Chip></span></div>
                <p className="xsmall soft mt8">The look resolves to SIX BEAM + MONOLITH after the designer rejects AERIAL 12.</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === "accessibility" && (
        <div className="col gap16">
          <Panel title="WCAG 2.2 AA" sub="Signed off before the pilot, not after">
            <div className="g3">
              {[
                ["Contrast", "Body and chrome pass 4.5:1 in all three themes. Large display text passes 3:1.", "pass"],
                ["Keyboard", "Every action has a path: skip link, focus ring, roving tabs, Escape on overlays, no keyboard trap.", "pass"],
                ["Targets", "44 px on touch surfaces. 32 px minimum on the desk.", "pass"],
                ["Motion", "Reduced-motion mode removes camera and drawer transitions, not the content.", "pass"],
                ["Colour", "Risk and status never rely on colour alone; a label and a bar are always present.", "pass"],
                ["Text size", "No product chrome below 11 px. Monospace records are 11 px at minimum.", "pass"],
              ].map(([title, detail, status]) => (
                <div className="provenance-item" key={title}>
                  <span>{title} <Chip tone="ok">{status}</Chip></span>
                  <b>{detail}</b>
                </div>
              ))}
            </div>
            <Meter value={1} tone="ok" label="Keyboard reachability" right="100%" />
            <Meter value={1} tone="ok" label="Contrast (all themes)" right="AA" />
          </Panel>

          <Panel title="Performance budgets" sub="Checked in CI on the pilot laptop">
            <div className="token-grid">
              <div>
                {[["Bundle (single route)", "≤ 220 kB gzip"], ["LCP", "≤ 2.5 s"], ["INP", "≤ 200 ms"], ["CLS", "≤ 0.1"]].map(([a, b]) => (
                  <div className="token-row" key={a}><span>{a}</span><span className="mono">{b}</span></div>
                ))}
              </div>
              <div>
                {[["3D frame time", "≤ 16 ms"], ["Cue table at 10k rows", "virtualised"], ["Offline shell", "≤ 1.2 MB"], ["No external font or CDN", "enforced"]].map(([a, b]) => (
                  <div className="token-row" key={a}><span>{a}</span><span className="mono">{b}</span></div>
                ))}
              </div>
            </div>
            <p className="xsmall soft mt12">The public demo ships the fonts locally, no analytics and no CDN. The previz is SVG, not a WebGL engine; it is a design instrument, not a renderer replacement.</p>
          </Panel>

          <Panel title="Screen audit" sub="1440 · 1024 · 390 px">
            <div className="g3">
              <div className="provenance-item"><span>1440</span><b>The desk. Stage canvas and side rail. No permanent panels that cannot be closed.</b></div>
              <div className="provenance-item"><span>1024</span><b>One column. The stage stays first; the checks and budget move below it.</b></div>
              <div className="provenance-item"><span>390</span><b>Phone surfaces for producers and crew. The 3D canvas is not the phone's job.</b></div>
            </div>
          </Panel>
        </div>
      )}

      {tab === "content" && (
        <div className="col gap16">
          <Panel title="Voice and tone" sub="Designer, producer, crew — not a marketing deck">
            <div className="prose">
              <p><b>Short. Specific. In the room.</b> “The front truss is 44 kg over its rating” beats “We have detected a potential safety concern.”</p>
              <p><b>Name the human.</b> “Mara rejected the look” not “the system rejected the look.” The designer is the author.</p>
              <p><b>Never overstate the AI.</b> “The agent proposes” and “the check fails” are different sentences. Keep them apart.</p>
              <p><b>Say what is missing.</b> A missing clip is “missing”, not “unavailable at this time”.</p>
              <p><b>No exclamation marks. No “oops”.</b> The show is high-stakes; the language is calm.</p>
            </div>
          </Panel>

          <Panel title="Glossary" sub="One source for the industry nouns">
            <div className="token-grid">
              {[
                ["Cue", "A numbered action on the show clock. LX, VID, STG, AUD, SFX or CAM."],
                ["Look", "A lighting state: fixtures, colour, focus and movement."],
                ["Rig", "The trusses, fixtures, power and rigging that carry the look."],
                ["Venue", "A room with a stage, a rig rating, a supply and a curfew."],
                ["Leg", "A run of dates inside a tour."],
                ["Load-in", "The crew's window to build the show in the venue."],
                ["Changeover", "The time to reset between shows or acts."],
                ["Safety sign-off", "A named human accepting the risk. Never automated."],
              ].map(([term, def]) => (
                <div className="token-row" key={term} style={{ alignItems: "flex-start" }}>
                  <span style={{ minWidth: 110 }}><b>{term}</b></span>
                  <span className="soft small" style={{ textAlign: "right", flex: 1 }}>{def}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Dates, times, units" sub="One show, one clock">
            <div className="g3">
              <div className="provenance-item"><span>Time</span><b>mm:ss.t from doors. Times are duration, never time-of-day.</b></div>
              <div className="provenance-item"><span>Money</span><b>EUR for the pilot. One currency per show; no silent conversion.</b></div>
              <div className="provenance-item"><span>Units</span><b>Metres and kilograms. The sheet prints both where the venue uses imperial.</b></div>
            </div>
          </Panel>

          <Panel title="Plain-language errors" sub="What the user sees when something is missing">
            <div className="col gap8">
              <div className="banner danger"><Icon name="alert" size={14} /><span><b>SIGNAL BARS v4 is not delivered.</b> Cue VID 14 cannot play. The fallback is MONOLITH. Delivery is confirmed for 1 Nov.</span></div>
              <div className="banner"><Icon name="alert" size={14} /><span><b>The GPU is not available.</b> The previz will stay on the CPU at reduced quality. Nothing is silently downgraded.</span></div>
              <div className="banner"><Icon name="check" size={14} /><span><b>No action is a valid outcome.</b> Dismissed with a reason and kept in the audit.</span></div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
