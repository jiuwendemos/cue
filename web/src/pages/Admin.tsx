import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { fmtDateTime, fmtMoney } from "../lib/engine";
import { AuditList, Chip, Meter, PageHead, Panel, Stat, Toggle } from "../components/UI";
import { Icon } from "../components/Icon";

const PERMISSIONS: Record<string, string[]> = {
  designer: ["show.edit", "look.author", "cue.edit", "cue.sign", "export.cue_sheet"],
  producer: ["show.approve", "budget.approve", "rights.edit", "readiness.live", "export.budget"],
  crew: ["cue.read", "cue.sign", "rig.check", "venue.verify"],
  tour_manager: ["readiness.edit", "crew.assign", "venue.verify", "calendar.sync"],
  admin: ["integrations.edit", "users.edit", "billing.edit", "audit.read", "tenant.edit"],
};

export default function Admin() {
  const store = useStore();
  const ui = useUI();
  const { pack } = store;
  const [renderDevice, setRenderDevice] = useState<"gpu" | "cpu" | "npu">("gpu");
  const [quality, setQuality] = useState("high");
  const [strict, setStrict] = useState(true);
  const [local, setLocal] = useState(true);
  const [signed, setSigned] = useState(true);
  const [backup, setBackup] = useState("");

  const connected = pack.integrations.filter((i) => i.status === "connected" || i.status === "simulated").length;

  return (
    <div>
      <PageHead
        kicker={`${pack.project.productionCompany} · ${pack.project.tour}`}
        title="Administration"
        sub="Integrations, roles, tenancy, render, billing and the security case. The public demo is synthetic; the pilot runs on one production network."
        actions={
          <>
            <button className="btn" onClick={() => store.say("Signed export created for the venue — expires in 72 hours.")}><Icon name="lock" size={13} /> Signed export</button>
            <Link to="/provenance" className="btn primary"><Icon name="provenance" size={13} /> Data rights</Link>
          </>
        }
      />

      <div className="stat-rail mb24">
        <Stat label="Tier" value={pack.billing.plan.split(" · ")[1] ?? "tour"} foot={`${pack.billing.shows} shows · ${pack.billing.seats} seats`} />
        <Stat label="MRR" value={fmtMoney(pack.billing.mrr)} foot={`next invoice ${pack.billing.nextInvoice}`} />
        <Stat label="Integrations" value={connected} unit={`/ ${pack.integrations.length}`} foot="connected or simulated" />
        <Stat label="Readiness mode" value={store.settings.mode} foot={store.settings.stopSwitch ? "stopped" : "running"} tone={store.settings.stopSwitch ? "bad" : "accent"} />
      </div>

      <div className="admin-grid">
        <div className="col gap16">
          <Panel title="Integrations" sub="CUE exchanges plans. It does not control the show." flush>
            <div style={{ padding: 14 }}>
              {pack.integrations.map((i) => (
                <div className="integration-row" key={i.id}>
                  <span>
                    <b>{i.name}</b>
                    <span className="proto">{i.protocol} · {i.direction} · {i.kind}</span>
                    <span className="xsmall soft" style={{ display: "block" }}>{i.detail}</span>
                  </span>
                  <Chip tone={i.status === "connected" ? "ok" : i.status === "simulated" ? "warn" : i.status === "error" ? "bad" : "neutral"}>{i.status}</Chip>
                  <span className="proto mono">{i.direction}</span>
                  <button className="btn sm" onClick={() => store.say(`${i.name}: handshake simulated — no hardware attached in the public demo.`)}>Test</button>
                </div>
              ))}
              <p className="xsmall soft mt12">Vectorworks, Capture, WYSIWYG, Depence², grandMA3, disguise, Notch and Resolume are strong tools. CUE is the design layer above them and exports into them; it does not replace them or run the show.</p>
            </div>
          </Panel>

          <Panel title="Exports and MCP" sub="Real files when the on-site service is running. Read-only tools; no live control.">
            {store.live ? (
              <div className="col gap6">
                {[
                  ["iCalendar — tour dates", "api/export/ics"],
                  ["grandMA3 cue list — CSV", "api/export/grandma3.csv"],
                  ["grandMA3 cue list — XML", "api/export/grandma3.xml"],
                  ["Resolume clip list — CSV", "api/export/resolume.csv"],
                  ["Vectorworks fixture schedule — CSV", "api/export/vectorworks.csv"],
                  ["MVR exchange package — ZIP", "api/export/mvr.zip"],
                ].map(([label, path]) => (
                  <a key={path} href={new URL(path, document.baseURI).toString()} target="_blank" rel="noreferrer" className="rail-link">
                    {label} <Icon name="external" size={11} />
                  </a>
                ))}
                <div className="provenance-item mt8"><span>MCP endpoint</span><b>POST /mcp · initialize · tools/list · tools/call · show_summary / checks / budget / readiness / cue_sheet / ask</b></div>
              </div>
            ) : (
              <div className="prose">
                <p>These exports are served by the on-site API. The public demo exports the cue sheet locally as CSV, HTML and JSON.</p>
                <p className="xsmall soft">Start the server and open this page on <span className="mono">127.0.0.1:8000</span> to see the live links and the MCP endpoint.</p>
              </div>
            )}
          </Panel>

          <Panel title="Backup, retention and metrics" sub="The pilot path is a file copy; production uses PITR and a tested drill.">
            {store.live ? (
              <div className="col gap8">
                <div className="row gap6 wrap">
                  <button
                    className="btn sm"
                    onClick={async () => {
                      try {
                        const response = await fetch(new URL("api/admin/backup", document.baseURI).toString(), { method: "POST" });
                        const data = (await response.json()) as { path?: string; bytes?: number };
                        setBackup(data.path ?? "");
                        store.say(`Backup created${data.bytes ? ` — ${Math.round(data.bytes / 1024)} kB` : ""}`);
                      } catch {
                        store.say("The backup could not be created.");
                      }
                    }}
                  >
                    <Icon name="download" size={11} /> Create backup
                  </button>
                  <a className="btn sm" href={new URL("api/metrics", document.baseURI).toString()} target="_blank" rel="noreferrer"><Icon name="chart" size={11} /> Metrics</a>
                </div>
                {backup && <span className="xsmall mono soft">{backup}</span>}
                <p className="xsmall soft">Retention: per tour and per asset. Deletion is a recorded action. The public demo keeps nothing.</p>
              </div>
            ) : (
              <p className="small muted">Backup and metrics are on-site operations. The public demo keeps all state in your browser and never sends it anywhere.</p>
            )}
          </Panel>

          <Panel title="Render and inference" sub="GPU/CPU is the core. NPU is optional and never sold as the hero.">
            <div className="setting-row">
              <span className="label">Render device<span className="note">The pilot laptop renders the previz and exports the cue sheet.</span></span>
              <div className="row gap4">
                {(["gpu", "cpu", "npu"] as const).map((d) => (
                  <button key={d} className={`btn sm${renderDevice === d ? " primary" : " ghost"}`} onClick={() => setRenderDevice(d)}>{d.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <span className="label">Quality</span>
              <select className="select" style={{ maxWidth: 120 }} value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="high">High</option>
                <option value="show">Show</option>
              </select>
            </div>
            <div className="setting-row">
              <span className="label">Strict integrations<span className="note">Refuse to report ready when the agent, render path or live connector is missing.</span></span>
              <Toggle on={strict} onChange={setStrict} label="Strict integrations" />
            </div>
            <div className="setting-row">
              <span className="label">Local-only artist content<span className="note">Unreleased material stays in the production network. No upload without written permission.</span></span>
              <Toggle on={local} onChange={setLocal} label="Local only" />
            </div>
            <div className="banner mt12">
              <Icon name={renderDevice === "gpu" ? "bolt" : "cpu"} size={14} />
              <span>
                <b>{renderDevice.toUpperCase()} · {quality}</b> — {renderDevice === "npu" ? "ONNX local look inference; 12 ms / frame on the demo machine." : renderDevice === "gpu" ? "GPU previz path available; 60 fps at the demo resolution." : "CPU fallback at reduced quality; the show still runs, the frame time budget is not claimed."}
              </span>
            </div>
            <div className="row gap6 mt12 wrap">
              <Chip tone="ok">frame budget 8.2 / 16 ms</Chip>
              <Chip tone="ok">export 2.4 s</Chip>
              <Chip tone={local ? "ok" : "warn"}>{local ? "local only" : "upload allowed"}</Chip>
            </div>
          </Panel>

          <Panel title="Security and operations" sub="The pilot runs for 90 days behind a production firewall.">
            <div className="g2">
              <div className="col gap6">
                <div className="row between small"><span className="soft">OIDC / SSO</span><Chip tone="ok">available</Chip></div>
                <div className="row between small"><span className="soft">Server-side roles</span><Chip tone="ok">enforced</Chip></div>
                <div className="row between small"><span className="soft">Signed exports</span><Chip tone="ok">72 h expiry</Chip></div>
                <div className="row between small"><span className="soft">Per-tenant isolation</span><Chip tone="ok">separate store</Chip></div>
                <div className="row between small"><span className="soft">Backup / restore</span><Chip tone="warn">drill due</Chip></div>
              </div>
              <div className="col gap6">
                <div className="row between small"><span className="soft">Observability</span><Chip tone="ok">render · export · agent</Chip></div>
                <div className="row between small"><span className="soft">Offline queue</span><Chip tone="ok">show week</Chip></div>
                <div className="row between small"><span className="soft">Retention</span><Chip tone="ok">per tour</Chip></div>
                <div className="row between small"><span className="soft">Encryption</span><Chip tone="ok">at rest · per tenant</Chip></div>
                <div className="row between small"><span className="soft">Kill switch</span><Chip tone={store.settings.stopSwitch ? "bad" : "ok"}>{store.settings.stopSwitch ? "stopped" : "armed"}</Chip></div>
              </div>
            </div>
            <div className="setting-row mt12">
              <span className="label">Signed show exports<span className="note">The venue gets a signed cue sheet and a provenance trail; the link expires.</span></span>
              <Toggle on={signed} onChange={setSigned} label="Signed exports" />
            </div>
            <p className="xsmall soft mt12">No live control. No DMX. No automatic cue release. Safety sign-off is a human signature and is never automated.</p>
          </Panel>

          <Panel title="Users and roles" sub="Role-based navigation hides what the role cannot act on" flush>
            <div style={{ padding: 14 }}>
              <table className="table">
                <thead><tr><th>User</th><th>Role</th><th>Scope</th><th>Can</th></tr></thead>
                <tbody>
                  {pack.users.map((u) => (
                    <tr key={u.id}>
                      <td><span className="row gap6"><span className="avatar" style={{ width: 24, height: 24, fontSize: 8 }}>{u.initials}</span><b>{u.name}</b></span></td>
                      <td>{u.role.replace("_", " ")}</td>
                      <td className="soft small">{u.venueIds.length ? u.venueIds.map((id) => pack.venues.find((v) => v.id === id)?.city).join(", ") : "all venues"}</td>
                      <td><span className="row gap3 wrap">{PERMISSIONS[u.role].slice(0, 3).map((p) => <Chip key={p}>{p}</Chip>)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="xsmall soft mt12">Server-side role enforcement is required; the UI filter is convenience, not security.</p>
            </div>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="Production readiness" sub="Gate before the first paid show">
            <div className="col gap8">
              {[
                ["Agent runtime", "DeepAgent adapter · 9 tools", "ok"],
                ["Render path", "GPU + CPU fallback; NPU optional", "ok"],
                ["Previz exchange", "Depence² reference adapter", "warn"],
                ["Console export", "grandMA3 reference adapter", "warn"],
                ["Video exchange", "disguise / Resolume", "warn"],
                ["Show store", "Versions, approvals, immutable audit", "ok"],
                ["Security", "OIDC, signed exports, tenant isolation", "warn"],
                ["End-to-end gate", "One real tour, 90 days", "warn"],
              ].map(([label, detail, status]) => (
                <div key={label} className="row between small">
                  <span><b>{label}</b><span className="xsmall soft" style={{ display: "block" }}>{detail}</span></span>
                  <Chip tone={status === "ok" ? "ok" : "warn"}>{status === "ok" ? "ready" : "pilot"}</Chip>
                </div>
              ))}
            </div>
            <Meter value={0.62} tone="warn" label="Production wiring" right="62%" />
            <p className="xsmall soft mt12">The static demo is complete. The production gate opens only with one real tour and one venue.</p>
          </Panel>

          <Panel title="Billing" sub={pack.billing.plan}>
            <div className="row between"><span className="small soft">Per show</span><b className="mono">{fmtMoney(pack.billing.perShow)}</b></div>
            <div className="row between mt8"><span className="small soft">Per seat / month</span><b className="mono">{fmtMoney(pack.billing.perSeatMonth)}</b></div>
            <div className="row between mt8"><span className="small soft">Shows</span><b className="mono">{pack.billing.shows}</b></div>
            <div className="row between mt8"><span className="small soft">Seats</span><b className="mono">{pack.billing.seats}</b></div>
            <div className="row between mt8"><span className="small soft">Setup / integration</span><b className="mono">{fmtMoney(pack.billing.setupFee)}</b></div>
            <div className="row between mt12" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><b>MRR</b><b className="mono">{fmtMoney(pack.billing.mrr)}</b></div>
            <p className="xsmall soft mt12">{pack.billing.note}</p>
            <button className="btn sm mt12" onClick={() => store.say("Invoice draft created in Xero — no charge in the public demo.")}>Create invoice</button>
          </Panel>

          <Panel title="Tenancy and retention" sub="One show, one tenant">
            <div className="provenance-item"><span>Tenant</span><b>Halcyon Productions · EU</b></div>
            <div className="provenance-item mt8"><span>Store</span><b>Per-tenant SQLite / Postgres in production. No shared table to leak across.</b></div>
            <div className="provenance-item mt8"><span>Retention</span><b>Per tour and per asset. Artist content local by default.</b></div>
            <div className="provenance-item mt8"><span>Export</span><b>Signed link, 72 hours, watermarked.</b></div>
            <div className="row gap6 mt12"><Chip tone="ok">isolated</Chip><Chip tone="ok">encrypted</Chip><Chip tone="warn">DR drill due</Chip></div>
          </Panel>

          <Panel title="Kill switch runbook" sub="Readiness only; the show is unaffected">
            <div className="not-list">
              {["Stop readiness scanning", "Notify the production office with the reason", "Keep the show, cue sheet and budget available", "Record the reason in the immutable audit", "Do not resume until the producer signs"].map((s, i) => (
                <div className="not-row" key={s}><span className="mono xsmall soft">{String(i + 1).padStart(2, "0")}</span><span>{s}</span></div>
              ))}
            </div>
            <button className={`btn sm mt12 ${store.settings.stopSwitch ? "ok" : "danger"}`} onClick={() => store.setStopSwitch(!store.settings.stopSwitch, store.settings.stopSwitch ? "Resumed by admin." : "Stopped by admin from the runbook.")}>
              {store.settings.stopSwitch ? "Resume readiness" : "Stop readiness"}
            </button>
          </Panel>

          <Panel title="Recent audit" sub="The operator's view">
            <AuditList events={store.audits} limit={7} />
          </Panel>

          <p className="xsmall soft">Signed in as {ui.role} · {fmtDateTime(new Date().toISOString())} · public demo</p>
        </aside>
      </div>
    </div>
  );
}
