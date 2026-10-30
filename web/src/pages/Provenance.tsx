import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { downloadText, fmtDate, toCsv } from "../lib/engine";
import { Chip, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Provenance() {
  const store = useStore();
  const ui = useUI();
  const { pack } = store;

  const exportRights = () => {
    const header = ["id", "asset", "kind", "owner", "licence", "territory", "from", "to", "status", "source"];
    const body = pack.rights.map((r) => [r.id, r.asset, r.kind, r.owner, r.licence, r.territory, r.from, r.to, r.status, r.source]);
    downloadText(`rights-register-${pack.project.version}.csv`, toCsv([header, ...body]), "text/csv;charset=utf-8");
  };

  const exportSheet = () => {
    const lines = [
      "# CUE provenance sheet",
      "",
      `Show: ${pack.project.artist} — ${pack.project.title} (${pack.project.version})`,
      `Production: ${pack.project.productionCompany}`,
      "",
      "## Track",
      pack.provenance.track,
      `Licence: ${pack.provenance.trackLicence}`,
      "",
      "## Assets",
      pack.provenance.assets,
      "",
      "## Model",
      `${pack.provenance.model} ${pack.provenance.modelVersion}`,
      `Inference: ${pack.provenance.inference}`,
      "",
      "## Data stay",
      pack.provenance.dataStay,
      "",
      "## Rights",
      ...pack.rights.map((r) => `- ${r.asset} — ${r.licence}; ${r.territory}; ${r.from} → ${r.to}; ${r.status}. ${r.source}`),
      "",
      "AI proposals are labelled. The designer authors the show. Safety sign-off is human and never automated.",
    ];
    downloadText(`provenance-${pack.project.version}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
  };

  return (
    <div>
      <PageHead
        kicker={`${pack.project.artist} · ${pack.project.title} · ${pack.project.version}`}
        title="Provenance and data rights"
        sub="Every asset has a licence, every model has a version, every AI proposal is labelled and every export keeps its trail. Unreleased artist content stays local."
        actions={
          <>
            <button className="btn" onClick={exportSheet}><Icon name="download" size={13} /> Provenance sheet</button>
            <button className="btn primary" onClick={exportRights}><Icon name="download" size={13} /> Rights register</button>
          </>
        }
      />

      <div className="provenance-grid mb24">
        <div className="provenance-item"><span>Track</span><b>{pack.provenance.track}</b></div>
        <div className="provenance-item"><span>Track licence</span><b>{pack.provenance.trackLicence}</b></div>
        <div className="provenance-item"><span>Assets</span><b>{pack.provenance.assets}</b></div>
        <div className="provenance-item"><span>Model</span><b>{pack.provenance.model} · {pack.provenance.modelVersion}</b></div>
        <div className="provenance-item"><span>Inference</span><b>{pack.provenance.inference}</b></div>
        <div className="provenance-item"><span>Data stay</span><b>{pack.provenance.dataStay}</b></div>
        <div className="provenance-item"><span>Created</span><b>{fmtDate(pack.provenance.createdAt)}</b></div>
        <div className="provenance-item"><span>Disclosure</span><b>{pack.provenance.note}</b></div>
      </div>

      <div className="readiness-grid">
        <div className="col gap16">
          <Panel title="Rights register" sub="Every asset in the show, with a territory, a window and a source" flush>
            <div style={{ padding: 14 }}>
              <table className="table">
                <thead><tr><th>Asset</th><th>Kind</th><th>Territory</th><th>Window</th><th>Status</th><th>Source</th></tr></thead>
                <tbody>
                  {pack.rights.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.asset}</b><span className="xsmall soft" style={{ display: "block" }}>{r.licence}</span></td>
                      <td><Chip tone={r.kind === "video" ? "info" : r.kind === "likeness" ? "rights" : "neutral"}>{r.kind}</Chip></td>
                      <td className="small">{r.territory}</td>
                      <td className="small mono">{r.from} → {r.to}</td>
                      <td><Chip tone={r.status === "cleared" ? "ok" : r.status === "pending" ? "warn" : "bad"}>{r.status}</Chip></td>
                      <td className="xsmall soft">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="xsmall soft mt12">The video licence expires 2026-11-10. It covers Brooklyn but not Paris, London or Copenhagen. That is a readiness risk, not a footnote.</p>
            </div>
          </Panel>

          <Panel title="What is real and what is simulated" sub="Written in the app, not hidden in a footer">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Real in this demo</th><th>Simulated</th></tr></thead>
                <tbody>
                  {[
                    ["Cue math, budget math, power, weight and glare", "The rig, venue, set and track"],
                    ["The reactive ranking and the human reject/re-rank record", "The look suggestions and their confidence"],
                    ["The release pipeline, the audit trail and the signed export", "The pilot numbers and the production office"],
                    ["The deterministic offline pack and the reset", "The GPU and NPU timing"],
                    ["The design system, theme and keyboard path", "The artist, venue and production company"],
                  ].map(([a, b]) => <tr key={a}><td>{a}</td><td className="soft">{b}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="AI disclosure" sub="The designer remains the author">
            <div className="prose">
              <h2>Lagging the proposal, not the decision</h2>
              <p>Every agent-authored look carries an <b>Agent</b> chip and a model version. The approved show is authored by the designer: the AI proposed, the human chose. A rejection is stored and the ranking is recomputed.</p>
              <h2>Ownership</h2>
              <p>AI-assisted looks and video are owned by the production company under the pilot terms, with the model version and prompt set recorded. The public demo generates its own imagery and synthesis. No third-party footage, no uncleared commercial recording, no artist likeness.</p>
              <h2>Unreleased content</h2>
              <p>Artist content is local by default. The optional NPU path sells privacy, not compute: on-site inference for unreleased material. Any upload needs written permission and is listed in the rights register.</p>
            </div>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="Model card" sub={`${pack.provenance.model} ${pack.provenance.modelVersion}`}>
            <div className="col gap6">
              <div className="provenance-item"><span>Purpose</span><b>Propose looks and cues from the show context; flag power, weight, glare and asset conflicts.</b></div>
              <div className="provenance-item"><span>Inputs</span><b>Setlist, energy curve, stage, rig, venue, look library, cue sheet, rights register.</b></div>
              <div className="provenance-item"><span>Limits</span><b>Ranks on impact first. It does not know the room by feel, and it cannot sign safety.</b></div>
              <div className="provenance-item"><span>Failure modes</span><b>Generic spectacle, over-lighting, confident citations to missing assets. All three are visible in this demo.</b></div>
              <div className="provenance-item"><span>Human check</span><b>A designer rejection is stored; unsafe candidates stay flagged even when ranked first.</b></div>
              <div className="provenance-item"><span>Last validated</span><b>2026-10-27 · rehearsal R2 · 3 shows</b></div>
            </div>
          </Panel>

          <Panel title="Privacy review" sub="Before any unreleased content">
            <div className="not-list">
              {[
                ["Local by default", "The public demo makes no network request after load."],
                ["Explicit permission", "Any upload needs written permission, recorded in the rights register."],
                ["No analytics", "No third-party script, no font CDN, no telemetry."],
                ["Per-tenant isolation", "Production uses a separate store and keys per tenant."],
                ["Retention", "Per tour and per asset; deletion is a recorded action."],
              ].map(([a, b]) => (
                <div className="not-row" key={a}><Icon name="lock" size={12} /><span><b>{a}</b> — {b}</span></div>
              ))}
            </div>
          </Panel>

          <Panel title="Data-rights annex" sub="The short version">
            <p className="small muted">Music: licensed or generated, never an uncleared commercial song. Video: generated in-house with a prompt record. Venue and rig data: customer confidential; no cross-tenant sharing. Artist likeness: rider-bound, broadcast excluded unless signed. AI output: labelled, attributable, designer-owned on approval.</p>
            <div className="row gap6 mt12 wrap">
              <Chip tone="ok">synthetic data</Chip>
              <Chip tone="ok">no customer data</Chip>
              <Chip tone="ok">local demo</Chip>
              <Chip tone="warn">pilot annex required</Chip>
            </div>
            <button className="btn sm mt12" onClick={exportSheet}><Icon name="download" size={12} /> Download the annex</button>
          </Panel>

          <Panel title="Where to check" sub="The trail is in the product, not only the API">
            <div className="col gap6">
              <Link to="/agent" className="rail-link">Agent proposals and citations <Icon name="arrow" size={11} /></Link>
              <Link to="/cues" className="rail-link">Cue sheet and safety signatures <Icon name="arrow" size={11} /></Link>
              <Link to="/versions" className="rail-link">Version approvals and audit <Icon name="arrow" size={11} /></Link>
              <Link to="/readiness" className="rail-link">Risk evidence and provenance <Icon name="arrow" size={11} /></Link>
            </div>
            <p className="xsmall soft mt12">Provenance is visible on every look, cue, asset and export. The public demo is {ui.t("common.offline")}.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
