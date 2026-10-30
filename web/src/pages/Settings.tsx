import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI, type Role } from "../lib/ui";
import { Chip, PageHead, Panel, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

const THEMES = [
  { id: "dark", label: "Control room", note: "Warm black. The default for focus and previz.", colors: ["#08080a", "#121110", "#d7ff4f"] },
  { id: "light", label: "Production office", note: "Paper. Daylight, no glare, for the desk.", colors: ["#f1ede1", "#fbf7ec", "#5b7a0b"] },
  { id: "contrast", label: "High contrast", note: "Black, white, electric. For the back of the room.", colors: ["#000000", "#0b0b0b", "#e8ff00"] },
] as const;

const ROLES: { id: Role; label: string; note: string }[] = [
  { id: "designer", label: "Designer", note: "Looks, video, blocking, cue sheet, safety" },
  { id: "producer", label: "Producer", note: "Budget, rights, versions, approvals" },
  { id: "crew", label: "Venue crew", note: "Cue sheet, rig check, sign-off" },
  { id: "tour_manager", label: "Tour manager", note: "Dates, crew, venues, readiness" },
  { id: "admin", label: "Admin", note: "Integrations, tenancy, billing" },
];

export default function Settings() {
  const ui = useUI();
  const store = useStore();

  return (
    <div>
      <PageHead
        kicker="Studio settings"
        title="Make it yours"
        sub="The show is the same. The room you sit in is yours. Every setting is local; nothing is sent anywhere."
        actions={<Link to="/design" className="btn"><Icon name="design" size={13} /> Design system</Link>}
      />

      <div className="settings-grid">
        <div className="col gap16">
          <Panel title="The room" sub="Three themes, designed together">
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button key={t.id} className={`theme-card${ui.theme === t.id ? " on" : ""}`} onClick={() => ui.setTheme(t.id)}>
                  <span className="theme-swatch">{t.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <b>{t.label}</b>
                  <small>{t.note}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Role" sub="The navigation hides what the role cannot act on. The server still enforces it.">
            <div className="role-grid">
              {ROLES.map((r) => (
                <button key={r.id} className={`role-card${ui.role === r.id ? " on" : ""}`} onClick={() => ui.setRole(r.id)}>
                  <b>{r.label}</b>
                  <span>{r.note}</span>
                  {ui.role === r.id && <Chip tone="accent">viewing</Chip>}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Reading and motion" sub="For the desk, the pit, and the back of the room">
            <div className="setting-row">
              <span className="label">Language<span className="note">The chrome is translated; the industry nouns stay in the glossary.</span></span>
              <div className="row gap4">
                <button className={`btn sm${ui.locale === "en" ? " primary" : " ghost"}`} onClick={() => ui.setLocale("en")}>English</button>
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
              <span className="label">Reduced motion<span className="note">Stops camera, drawer and cue transitions.</span></span>
              <Toggle on={ui.reducedMotion} onChange={ui.setReducedMotion} label="Reduced motion" />
            </div>
            <div className="setting-row">
              <span className="label">Synthetic demo notices<span className="note">The “synthetic show” chip, the footer note and the in-page disclaimers. The data stays synthetic; only the labels go quiet.</span></span>
              <Toggle on={ui.showDemoNotices} onChange={ui.setShowDemoNotices} label="Show demo notices" />
            </div>
            <div className="demo-settings-note mt12">
              <Icon name="eye" size={13} />
              <span>
                This is a public demo built on a fixed synthetic pack. Nova Vale, Halcyon Hall and the tour are invented.
                The math, the cue sheet and the readiness lifecycle are real code. Read <Link to="/provenance" className="accent">what is real</Link>.
              </span>
            </div>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="The show" sub={`${store.pack.project.title} · ${store.pack.project.version}`}>
            <div className="provenance-item"><span>Pack</span><b>seed {store.pack.meta.seed} · v{store.pack.meta.version}</b></div>
            <div className="provenance-item mt8"><span>Generated</span><b>{new Date(store.pack.meta.generated).toLocaleString("en-GB")}</b></div>
            <div className="provenance-item mt8"><span>Decisions</span><b>{store.rejectedLooks.length} rejected looks · {Object.keys(store.signedCues).length} signed cues</b></div>
            <div className="provenance-item mt8"><span>Offline</span><b>No network call after load. No analytics. No external fonts.</b></div>
            <button className="btn danger mt12" onClick={store.reset}><Icon name="reset" size={12} /> Reset every decision</button>
            <p className="xsmall soft mt8">Resets rejected looks, votes, risk states, signed cues and version approvals. The pack and the seed stay the same.</p>
          </Panel>

          <Panel title="Keyboard" sub="The desk is faster than the mouse">
            <div className="keys">
              {[
                ["⌘K / Ctrl K", "Command palette, search, ask"],
                ["G then S", "Show"],
                ["G then C", "Cue sheet"],
                ["G then R", "Readiness"],
                ["T", "Cycle dark / light / contrast"],
                ["R", "Reset the stage piece"],
                ["?", "Shortcut sheet"],
              ].map(([k, v]) => (
                <div key={k} className="row between">
                  <span className="kbd" style={{ minWidth: 90 }}>{k}</span>
                  <span className="small muted">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Who is in the room" sub="Roles and ownership">
            <div className="col gap6">
              {store.pack.users.filter((u) => u.role !== "admin").map((u) => (
                <div key={u.id} className="row between small">
                  <span><b>{u.name}</b> <span className="soft">· {u.role.replace("_", " ")}</span></span>
                  <span className="avatar" style={{ width: 22, height: 22, fontSize: 8 }}>{u.initials}</span>
                </div>
              ))}
            </div>
            <Link to="/admin" className="btn sm mt12">Admin and integrations <Icon name="arrow" size={11} /></Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
