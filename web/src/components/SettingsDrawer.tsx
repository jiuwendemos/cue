import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI, type Role } from "../lib/ui";
import { Drawer, Toggle } from "./UI";
import { Icon } from "./Icon";

const THEMES = [
  { id: "dark", label: "Control room", note: "Warm black. The default.", colors: ["#07080a", "#0f1214", "#d7ff4f"] },
  { id: "light", label: "Production office", note: "Paper. Daylight, no glare.", colors: ["#f3f1e8", "#fbf9f1", "#5b7a0b"] },
  { id: "contrast", label: "High contrast", note: "Black, white, electric.", colors: ["#000000", "#0b0b0b", "#e8ff00"] },
] as const;

const ROLES: { id: Role; label: string }[] = [
  { id: "designer", label: "Designer" },
  { id: "producer", label: "Producer" },
  { id: "crew", label: "Venue crew" },
  { id: "tour_manager", label: "Tour manager" },
  { id: "admin", label: "Admin" },
];

export function SettingsDrawer({
  open,
  onClose,
  onGuide,
}: {
  open: boolean;
  onClose: () => void;
  onGuide: () => void;
}) {
  const ui = useUI();
  const store = useStore();

  return (
    <Drawer open={open} title="Studio settings" onClose={onClose} actions={<button className="btn" onClick={onClose}>Done</button>}>
      <div className="col gap16">
        <div>
          <span className="xsmall cap soft">Interface</span>
          <div className="theme-grid mt8">
            {THEMES.map((t) => (
              <button key={t.id} className={`theme-card${ui.theme === t.id ? " on" : ""}`} onClick={() => ui.setTheme(t.id)}>
                <span className="theme-swatch">
                  {t.colors.map((c) => <i key={c} style={{ background: c }} />)}
                </span>
                <b>{t.label}</b>
                <small>{t.note}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <span className="label">View as role<span className="note">Hides actions the role cannot take. The server still enforces it.</span></span>
          <select className="select" style={{ maxWidth: 150 }} value={ui.role} onChange={(e) => ui.setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        <div className="setting-row">
          <span className="label">Language</span>
          <div className="row gap4">
            <button className={`btn sm${ui.locale === "en" ? " primary" : " ghost"}`} onClick={() => ui.setLocale("en")}>EN</button>
            <button className={`btn sm${ui.locale === "zh" ? " primary" : " ghost"}`} onClick={() => ui.setLocale("zh")}>中文</button>
          </div>
        </div>

        <div className="setting-row">
          <span className="label">Density</span>
          <div className="row gap4">
            <button className={`btn sm${ui.density === "comfortable" ? " primary" : " ghost"}`} onClick={() => ui.setDensity("comfortable")}>Comfortable</button>
            <button className={`btn sm${ui.density === "compact" ? " primary" : " ghost"}`} onClick={() => ui.setDensity("compact")}>Compact</button>
          </div>
        </div>

        <div className="setting-row">
          <span className="label">Reduced motion<span className="note">Stops the camera, drawer and cue transitions.</span></span>
          <Toggle on={ui.reducedMotion} onChange={ui.setReducedMotion} label="Reduced motion" />
        </div>

        <div className="settings-divider" />

        <div>
          <span className="xsmall cap soft">Synthetic show</span>
          <div className="setting-row">
            <span className="label">
              Show demo notices
              <span className="note">The “synthetic show” chip, the footer note and the in-page disclaimers. The data stays synthetic; this only quiets the labels.</span>
            </span>
            <Toggle on={ui.showDemoNotices} onChange={ui.setShowDemoNotices} label="Show demo notices" />
          </div>
          <div className="demo-settings-note">
            <Icon name="eye" size={13} />
            <span>Nova Vale, Halcyon Hall and the tour are invented. The math, the cue sheet and the readiness lifecycle are real code over a fixed synthetic pack.</span>
          </div>
          <div className="row gap6 mt12">
            <button className="btn sm" onClick={() => { onClose(); onGuide(); }}><Icon name="about" size={12} /> Read the demo guide</button>
            <Link to="/provenance" className="btn sm" onClick={onClose}><Icon name="provenance" size={12} /> Provenance</Link>
          </div>
        </div>

        <div className="settings-divider" />

        <div>
          <span className="xsmall cap soft">The show</span>
          <div className="row between mt8">
            <span className="small soft">Reset every decision</span>
            <button className="btn sm danger" onClick={() => { store.reset(); onClose(); }}><Icon name="reset" size={11} /> Reset demo</button>
          </div>
          <p className="xsmall soft mt8">Resets the rejected looks, votes, risk states, signed cues and local approvals. The seed and the pack stay the same.</p>
          <div className="row gap6 mt12 wrap">
            <Link to="/settings" className="btn sm" onClick={onClose}><Icon name="settings" size={11} /> Full settings</Link>
            <Link to="/design" className="btn sm" onClick={onClose}><Icon name="design" size={11} /> Design system</Link>
            <Link to="/admin" className="btn sm" onClick={onClose}><Icon name="admin" size={11} /> Admin</Link>
            <Link to="/about" className="btn sm" onClick={onClose}><Icon name="about" size={11} /> About CUE</Link>
          </div>
        </div>

        <p className="xsmall soft">
          Signed in as {store.pack.project.designer} · {store.pack.project.productionCompany} · public demo. No analytics, no external requests after load.
        </p>
      </div>
    </Drawer>
  );
}
