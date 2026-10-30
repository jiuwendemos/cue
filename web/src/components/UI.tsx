import type { ReactNode } from "react";
import type { AuditEvent, CheckStatus, ReadinessRisk, RiskState, Severity } from "../types";
import { fmtDateTime, fmtPct } from "../lib/engine";
import { Icon } from "./Icon";

export function PageHead({ kicker, title, sub, actions }: { kicker?: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <div className="page-kicker">{kicker}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  sub,
  actions,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <div>
            <h3>{title}</h3>
            {sub && <span className="panel-sub">{sub}</span>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className={flush ? "panel-body flush" : "panel-body"}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "info" | "rights";

export function Chip({ tone = "neutral", children, dot = false, className = "" }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`chip ${tone} ${className}`}>
      {dot && <i className="dot" />}
      {children}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: Severity }) {
  const tone: Tone = severity === "critical" ? "bad" : severity === "high" ? "warn" : severity === "medium" ? "info" : "neutral";
  return <Chip tone={tone}>{severity}</Chip>;
}

const STATE_LABEL: Record<RiskState, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  assigned: "Assigned",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function StateChip({ state, reason }: { state: RiskState; reason?: string }) {
  const tone: Tone = state === "resolved" ? "ok" : state === "dismissed" ? "neutral" : state === "investigating" ? "info" : state === "assigned" ? "accent" : state === "acknowledged" ? "warn" : "bad";
  return (
    <span title={reason}>
      <Chip tone={tone} dot>{STATE_LABEL[state]}</Chip>
    </span>
  );
}

export function CheckChip({ status }: { status: CheckStatus }) {
  const tone: Tone = status === "pass" ? "ok" : status === "warn" ? "warn" : "bad";
  return <Chip tone={tone}>{status === "pass" ? "Pass" : status === "warn" ? "Warn" : "Fail"}</Chip>;
}

export function Meter({
  value,
  max = 1,
  tone = "accent",
  label,
  right,
  tall = false,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "ok" | "warn" | "bad" | "info";
  label?: string;
  right?: string;
  tall?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  return (
    <div className="meter-wrap">
      {(label || right) && (
        <div className="meter-label">
          <span>{label}</span>
          <span className="mono">{right ?? fmtPct(pct)}</span>
        </div>
      )}
      <div className={`meter ${tone}${tall ? " tall" : ""}`} role="img" aria-label={`${label ?? "meter"} ${fmtPct(pct)}`}>
        <i style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, unit, foot, tone = "" }: { label: string; value: string | number; unit?: string; foot?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function Sparkline({
  values,
  width = 160,
  height = 38,
  color = "var(--accent)",
  fill = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width - pad} ${height - pad} L${pad} ${height - pad} Z`;
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {fill && <path d={area} fill={color} opacity={0.1} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bars({ data, max, color = "var(--accent)" }: { data: { label: string; value: number }[]; max?: number; color?: string }) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.label} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <i style={{ width: `${(d.value / top) * 100}%`, background: color }} />
          </div>
          <span className="bar-value mono">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ value, label, size = 88, tone = "var(--accent)" }: { value: number; label?: string; size?: number; tone?: string }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={5}
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="donut-label">
        <b>{Math.round(pct * 100)}%</b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  actions,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className={`modal${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="drawer-back" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close panel">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {actions && <div className="drawer-actions">{actions}</div>}
      </aside>
    </div>
  );
}

export function Empty({ icon = "about", title, note, action }: { icon?: string; title: string; note?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {note && <p>{note}</p>}
      {action && <div className="mt12">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          className={`tab${value === item.id ? " active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`toggle${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function Swatches({ colors, size = 10 }: { colors: string[]; size?: number }) {
  return (
    <span className="swatches" aria-label="Look palette">
      {colors.map((c) => (
        <i key={c} style={{ background: c, width: size, height: size }} />
      ))}
    </span>
  );
}

export function RiskRow({
  risk,
  onOpen,
  selected,
}: {
  risk: ReadinessRisk;
  onOpen: (risk: ReadinessRisk) => void;
  selected?: boolean;
}) {
  return (
    <button className={`risk-row${selected ? " selected" : ""}`} onClick={() => onOpen(risk)}>
      <span className={`severity-bar ${risk.severity}`} />
      <span className="risk-main">
        <span className="risk-top">
          <b className="mono">{risk.id}</b>
          <span className="risk-title">{risk.title}</span>
        </span>
        <span className="risk-sub">{risk.detail}</span>
      </span>
      <span className="risk-meta">
        <StateChip state={risk.state} reason={risk.dismissedReason} />
        <span className="risk-date mono">{risk.owner}</span>
        <span className="risk-date mono">{fmtDateTime(risk.due)}</span>
      </span>
    </button>
  );
}

export function AuditList({ events, limit = 10 }: { events: AuditEvent[]; limit?: number }) {
  if (!events.length) return <Empty icon="file" title="No audit events" note="Nothing has been decided yet." />;
  return (
    <div className="audit-list">
      {events.slice(0, limit).map((e) => (
        <div key={e.id} className="audit-row">
          <span className="audit-time mono">{fmtDateTime(e.at)}</span>
          <span className="audit-detail">
            <b>{e.actor}</b> · {e.action} <span className="soft">· {e.object}</span>
            <span className="audit-note">{e.detail}</span>
          </span>
          <Chip>{e.modelVersion}</Chip>
        </div>
      ))}
    </div>
  );
}

export function IndexCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: Tone }) {
  return (
    <div className="index-card">
      <span className="index-label">{label}</span>
      <span className={`index-value ${tone ?? ""}`}>{value}</span>
      {note && <span className="index-note">{note}</span>}
    </div>
  );
}
