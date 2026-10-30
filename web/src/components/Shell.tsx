import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI, type Role } from "../lib/ui";
import { fmtDateTime } from "../lib/engine";
import { Icon } from "./Icon";
import { CommandPalette } from "./CommandPalette";
import { Chip } from "./UI";
import { DemoGuide } from "./DemoGuide";
import { SettingsDrawer } from "./SettingsDrawer";

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
  roles: Role[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", labelKey: "nav.now", icon: "target", roles: ["designer", "producer", "crew", "tour_manager", "admin"], end: true },
  { to: "/show", labelKey: "nav.show", icon: "stage", roles: ["designer", "producer", "crew"] },
  { to: "/cues", labelKey: "nav.cues", icon: "cue", roles: ["designer", "producer", "crew", "tour_manager"] },
  { to: "/budget", labelKey: "nav.budget", icon: "budget", roles: ["designer", "producer", "admin"] },
  { to: "/readiness", labelKey: "nav.readiness", icon: "readiness", roles: ["designer", "producer", "crew", "tour_manager", "admin"] },
  { to: "/agent", labelKey: "nav.agent", icon: "agent", roles: ["designer", "producer", "tour_manager"] },
];

const TITLES: Record<string, string> = {
  "/": "Now — CUE",
  "/show": "Show — CUE",
  "/cues": "Cue sheet — CUE",
  "/budget": "Rig and budget — CUE",
  "/readiness": "Tour readiness — CUE",
  "/agent": "Design agent — CUE",
  "/venues": "Venues — CUE",
  "/versions": "Versions — CUE",
  "/pilot": "Pilot — CUE",
  "/mobile": "Mobile review — CUE",
  "/design": "Design system — CUE",
  "/admin": "Admin — CUE",
  "/provenance": "Provenance — CUE",
  "/settings": "Studio settings — CUE",
  "/glossary": "Glossary — CUE",
  "/about": "About CUE",
  "/stage": "The 90-second show — CUE",
  "/booth": "Booth — CUE",
};

export function Shell({ children }: { children: ReactNode }) {
  const { pack, toast, settings, unread, notifications, readNotification, readAllNotifications, reset, live } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const ui = useUI();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const base = location.pathname === "/" ? "/" : `/${location.pathname.split("/")[1] || ""}`;
  const nav = NAV.filter((item) => item.roles.includes(ui.role));

  useEffect(() => {
    document.title = TITLES[base] ?? "CUE";
  }, [base]);

  const skipIntro = new URLSearchParams(location.search).get("intro") === "0";
  useEffect(() => {
    if (!ui.introSeen && !skipIntro) setGuideOpen(true);
  }, [skipIntro, ui.introSeen]);

  useEffect(() => {
    let gPressed = false;
    let gTimer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        setKeysOpen(true);
        return;
      }
      if (e.key.toLowerCase() === "t") {
        ui.toggleTheme();
        return;
      }
      if (e.key.toLowerCase() === "g") {
        gPressed = true;
        window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gPressed = false;
        }, 900);
        return;
      }
      if (gPressed) {
        gPressed = false;
        const map: Record<string, string> = {
          n: "/", s: "/show", c: "/cues", b: "/budget", r: "/readiness", a: "/agent", v: "/versions", m: "/mobile", e: "/venues",
        };
        const to = map[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate(to);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(gTimer);
    };
  }, [navigate, ui]);

  const roleLabel: Record<Role, string> = {
    designer: ui.t("common.designer"),
    producer: ui.t("common.producer"),
    crew: ui.t("common.crew"),
    tour_manager: ui.t("common.tour_manager"),
    admin: ui.t("common.admin"),
  };

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="CUE home">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span className="brand-text">
            <b>CUE</b>
            <small>{ui.t("app.tagline")}</small>
          </span>
        </NavLink>

        <NavLink to="/show" className="project-chip" title={pack.project.tour}>
          <span className="dot live" />
          <b>{pack.project.title}</b>
          <span className="mono">{pack.project.version}</span>
        </NavLink>

        <button className="cmd-trigger" onClick={() => setCmdOpen(true)} aria-label="Open command palette">
          <Icon name="search" size={14} />
          <span>{ui.t("common.search")}</span>
          <span className="kbd">⌘K</span>
        </button>

        <span className="topbar-spacer" />

        <div className="topbar-actions">
          {ui.showDemoNotices && (
            <button className="demo-pill" onClick={() => setGuideOpen(true)} title="This is a synthetic show. Click for the demo guide.">
              <Icon name="eye" size={12} />
              <span>synthetic show</span>
            </button>
          )}
          <span className="site-pill" title={live ? "Connected to the on-site API" : "Deterministic offline pack"}>
            <span className={`dot ${live ? "live" : "warn"}`} />
            {live ? ui.t("common.live") : ui.t("common.offline")}
          </span>
          <button className="icon-btn" onClick={() => setCmdOpen(true)} aria-label="Search" data-mobile>
            <Icon name="search" size={16} />
          </button>
          <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label={`Notifications, ${unread} unread`}>
            <Icon name="alert" size={16} />
            {unread > 0 && <span className="dot warn" />}
          </button>
          <button className="icon-btn" onClick={ui.toggleTheme} aria-label={`Theme: ${ui.theme}`} title={`Theme: ${ui.theme}`}>
            <Icon name={ui.theme === "dark" ? "moon" : ui.theme === "light" ? "sun" : "contrast"} size={16} />
          </button>
          <button className="locale-btn" onClick={() => ui.setLocale(ui.locale === "en" ? "zh" : "en")} aria-label="Switch language" title="Switch language">
            {ui.locale === "en" ? "EN" : "中"}
          </button>
          <select
            className="role-select"
            value={ui.role}
            aria-label={ui.t("common.role")}
            onChange={(e) => ui.setRole(e.target.value as Role)}
          >
            {(Object.keys(roleLabel) as Role[]).map((r) => (
              <option key={r} value={r}>{roleLabel[r]}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Studio settings" title="Studio settings">
            <Icon name="settings" size={15} />
          </button>
          <button className="icon-btn" onClick={reset} aria-label={ui.t("common.reset_demo")} title={ui.t("common.reset_demo")}>
            <Icon name="reset" size={15} />
          </button>
          <button className="avatar" title={`${pack.project.designer} · ${roleLabel[ui.role]}`} onClick={() => setSettingsOpen(true)}>
            MV
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="Primary">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
            <Icon name={item.icon} size={18} />
            <span>{ui.t(item.labelKey)}</span>
          </NavLink>
        ))}
        <div className="rail-sep" />
        <button className="rail-item" onClick={() => setCmdOpen(true)}>
          <Icon name="grid" size={18} />
          <span>{ui.t("nav.more")}</span>
        </button>
        <div className="rail-bottom">
          <NavLink to="/stage" className="rail-item" title={ui.t("nav.stage")}>
            <Icon name="play" size={18} />
            <span>Stage</span>
          </NavLink>
          <button className="rail-item" onClick={() => setKeysOpen(true)} aria-label="Keyboard shortcuts">
            <Icon name="command" size={18} />
            <span>Keys</span>
          </button>
        </div>
      </nav>

      <nav className="bottom-nav" aria-label="Primary mobile">
        {nav.slice(0, 4).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}>
            <Icon name={item.icon} size={19} />
            <span>{ui.t(item.labelKey)}</span>
          </NavLink>
        ))}
        <button className="rail-item" onClick={() => setCmdOpen(true)}>
          <Icon name="grid" size={19} />
          <span>{ui.t("nav.more")}</span>
        </button>
      </nav>

      <div className="main">
        <main className="content" id="main-content" aria-label="CUE">
          {settings.stopSwitch && (
            <div className="banner danger">
              <Icon name="alert" size={15} />
              <span><b>Readiness is stopped.</b> The show, the cue sheet and the budget are unaffected. Resume from Readiness → settings.</span>
            </div>
          )}
          {children}
        </main>
        <footer className="app-foot">
          <span>
            <b>CUE</b> · {pack.project.tour}
            {ui.showDemoNotices ? " · Synthetic show. No artist, venue or production company is real." : ""}
          </span>
          <span className="foot-links">
            <NavLink to="/settings">Settings</NavLink>
            <NavLink to="/glossary">Glossary</NavLink>
            <NavLink to="/provenance">{ui.t("nav.provenance")}</NavLink>
            <NavLink to="/about">{ui.t("nav.about")}</NavLink>
            <NavLink to="/design">{ui.t("nav.design")}</NavLink>
          </span>
        </footer>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {notifOpen && (
        <div className="modal-back" onClick={() => setNotifOpen(false)} role="presentation">
          <div className="modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Notifications">
            <div className="modal-head">
              <div>
                <div className="page-kicker">Notifications</div>
                <h3>What needs attention</h3>
              </div>
              <button className="btn ghost sm" onClick={() => setNotifOpen(false)} aria-label="Close notifications"><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="row gap8 mb12">
                <button className="btn sm" onClick={readAllNotifications}>Mark all read</button>
                <Chip tone="accent">{unread} unread</Chip>
                <span className="soft small">Email · Slack · in-app. Quiet hours {settings.quietHours}.</span>
              </div>
              <div className="inbox">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`inbox-row${n.read ? "" : " unread"}`}
                    onClick={() => {
                      readNotification(n.id);
                      setNotifOpen(false);
                      navigate(n.riskId ? `/readiness?risk=${n.riskId}` : "/readiness");
                    }}
                  >
                    <span className="dot" />
                    <span>
                      <b>{n.title}</b>
                      <span className="inbox-detail">{n.detail}</span>
                      <span className="inbox-meta mono">{n.channel} · {fmtDateTime(n.at)}</span>
                    </span>
                    <Icon name="chevron" size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {keysOpen && (
        <div className="modal-back" onClick={() => setKeysOpen(false)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="modal-head">
              <h3>Keyboard and command</h3>
              <button className="btn ghost sm" onClick={() => setKeysOpen(false)} aria-label="Close"><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="keys">
                {[
                  ["⌘K / Ctrl K", "Command palette, search, ask"],
                  ["G then N", "Now"],
                  ["G then S", "Show"],
                  ["G then C", "Cue sheet"],
                  ["G then B", "Rig and budget"],
                  ["G then R", "Readiness"],
                  ["G then A", "Agent"],
                  ["T", "Dark / light / high contrast"],
                  ["R", "Reset the stage piece"],
                  ["?", "This sheet"],
                ].map(([k, v]) => (
                  <div key={k} className="row between">
                    <span className="kbd">{k}</span>
                    <span className="small muted">{v}</span>
                  </div>
                ))}
              </div>
              <p className="xsmall soft mt12">
                The agent answers with citations. It never changes a cue, signs safety or releases a show.
              </p>
            </div>
          </div>
        </div>
      )}

      <DemoGuide open={guideOpen} onClose={() => setGuideOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onGuide={() => setGuideOpen(true)} />

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
