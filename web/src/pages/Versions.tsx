import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { downloadText, fmtDate, fmtDateTime, fmtTimecode, toCsv } from "../lib/engine";
import { AuditList, Chip, Modal, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Versions() {
  const store = useStore();
  const ui = useUI();
  const { pack, versions, currentVersion } = store;
  const [selectedId, setSelectedId] = useState(currentVersion.id);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("Design intent, cue sheet and budget match the rehearsal.");
  const [approveActor, setApproveActor] = useState(pack.project.producer);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("Show — final");
  const [newNote, setNewNote] = useState("Locked after the safety sign-off.");
  const [compareId, setCompareId] = useState(versions[Math.max(0, versions.length - 2)]?.id ?? currentVersion.id);

  const selected = versions.find((v) => v.id === selectedId) ?? currentVersion;
  const previous = versions[Math.max(0, versions.findIndex((v) => v.id === selected.id) - 1)] ?? selected;
  const compare = versions.find((v) => v.id === compareId) ?? previous;
  const approvals = useMemo(() => store.audits.filter((a) => a.action.startsWith("version") || a.object === selected.id), [selected.id, store.audits]);

  const approve = () => {
    store.approveVersion(selected.id, approveActor, approveNote);
    setApproveOpen(false);
  };

  const create = () => {
    const id = store.createVersion(newLabel, newNote);
    setCreateOpen(false);
    setSelectedId(id);
  };

  const exportVersions = () => {
    const header = ["id", "label", "at", "author", "status", "note", "approved_by", "approved_at", "signature", "changes"];
    const body = versions.map((v) => [v.id, v.label, v.at, v.author, v.status, v.note, v.approvedBy ?? "", v.approvedAt ?? "", v.signature ?? "", v.changes.map((c) => `${c.kind}: ${c.detail}`).join(" | ")]);
    downloadText(`versions-${pack.project.version}.csv`, toCsv([header, ...body]), "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHead
        kicker={`${pack.project.artist} · ${pack.project.tour}`}
        title="Versions and approvals"
        sub="A show is a sequence of decisions. Every version keeps its author, its changes, its approval and an immutable signature."
        actions={
          <>
            <button className="btn" onClick={exportVersions}><Icon name="download" size={13} /> CSV</button>
            <button className="btn" onClick={() => setCreateOpen(true)}><Icon name="plus" size={13} /> New version</button>
            <Link to="/cues" className="btn primary"><Icon name="cue" size={13} /> Cue sheet</Link>
          </>
        }
      />

      <div className="stat-rail mb24">
        <div className="stat">
          <div className="stat-label">Current version</div>
          <div className="stat-value">{currentVersion.id}</div>
          <div className="stat-foot">{currentVersion.label} · {currentVersion.status}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{versions.filter((v) => v.status === "approved").length}<small>/ {versions.length}</small></div>
          <div className="stat-foot">last sign-off {fmtDate(versions.filter((v) => v.status === "approved").slice(-1)[0]?.approvedAt)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Cue changes</div>
          <div className="stat-value">{pack.metrics.cueChanges}</div>
          <div className="stat-foot">during rehearsal · baseline 17</div>
        </div>
        <div className="stat">
          <div className="stat-label">Safety signatures</div>
          <div className="stat-value">{Object.keys(store.signedCues).length}<small>/ {pack.cues.filter((c) => c.safety).length}</small></div>
          <div className="stat-foot">human only · never automated</div>
        </div>
      </div>

      <div className="version-grid">
        <Panel title="Version history" sub={`${versions.length} versions · immutable`} flush>
          <div className="version-list">
            {versions.map((v) => (
              <button key={v.id} className={`version-row${selected.id === v.id ? " selected" : ""}`} onClick={() => { setSelectedId(v.id); setCompareId(previous.id); }}>
                <span className="vid">{v.id}</span>
                <span>
                  <b>{v.label}</b>
                  <span>{fmtDate(v.at)} · {v.author} · {v.changes.length} changes</span>
                </span>
                <Chip tone={v.status === "approved" ? "ok" : v.status === "review" ? "warn" : "neutral"}>{v.status}</Chip>
              </button>
            ))}
          </div>
        </Panel>

        <div className="col gap16">
          <Panel
            title={`${selected.id} · ${selected.label}`}
            sub={`${fmtDateTime(selected.at)} · ${selected.author} · ${selected.status}`}
            actions={
              <>
                {selected.status !== "approved" ? (
                  <button className="btn primary sm" onClick={() => setApproveOpen(true)}><Icon name="check" size={12} /> Approve version</button>
                ) : (
                  <Chip tone="ok"><Icon name="check" size={11} /> approved</Chip>
                )}
                <Link to={`/show?look=${store.activeLookId}`} className="btn sm"><Icon name="stage" size={12} /> Open show</Link>
              </>
            }
          >
            <p className="small muted">{selected.note}</p>
            <div className="row gap6 mt12 wrap">
              <Chip tone="accent">{selected.changes.length} changes</Chip>
              <Chip>{selected.id === currentVersion.id ? "current" : "historical"}</Chip>
              {selected.approvedBy && <Chip tone="ok">signed {selected.signature}</Chip>}
            </div>
            {selected.approvedBy && (
              <div className="row between mt16">
                <div>
                  <div className="xsmall soft">Approved by</div>
                  <div className="small">{selected.approvedBy} · {fmtDateTime(selected.approvedAt)}</div>
                </div>
                <span className="signature">{selected.signature}</span>
              </div>
            )}
            <div className="section-label"><span>What changed in this version</span></div>
            <div className="diff-list">
              {selected.changes.map((c, i) => (
                <div className="diff-row" key={`${c.kind}-${i}`}>
                  <span className="kind">{c.kind}</span>
                  <span style={{ color: "var(--ink-2)" }}>{c.detail}</span>
                </div>
              ))}
            </div>
            <div className="section-label"><span>Compare</span></div>
            <div className="row gap8 wrap mb12">
              <select className="select" style={{ maxWidth: 200 }} value={compareId} onChange={(e) => setCompareId(e.target.value)} aria-label="Compare with version">
                {versions.filter((v) => v.id !== selected.id).map((v) => <option key={v.id} value={v.id}>{v.id} — {v.label}</option>)}
              </select>
              <span className="xsmall soft">{compare.id} → {selected.id}</span>
            </div>
            <div className="diff-list">
              {[...compare.changes, ...selected.changes].map((c, i) => (
                <div className="diff-row" key={`cmp-${i}`}>
                  <span className="kind">{c.kind}</span>
                  <span style={{ color: "var(--ink-2)" }}>{c.detail}</span>
                </div>
              ))}
            </div>
            <p className="xsmall soft mt12">Cue-sheet changes are reviewed before export. The pilot adds a line-level cue diff and a signed export; this public demo shows the version-level diff.</p>
          </Panel>

          <div className="grid g2">
            <Panel title="Venue and leg variants" sub="One show, one variant per room">
              <div className="col gap6">
                {pack.dates.map((d) => {
                  const v = pack.venues.find((x) => x.id === d.venueId);
                  return (
                    <div key={d.id} className="row between small">
                      <span><b>{d.city}</b> <span className="soft">· {v?.name}</span></span>
                      <Chip tone={d.status === "ready" ? "ok" : d.status === "at_risk" ? "warn" : "info"}>{d.status.replace("_", " ")}</Chip>
                    </div>
                  );
                })}
              </div>
              <Link to="/venues" className="btn sm mt12">Open venue variants <Icon name="arrow" size={11} /></Link>
            </Panel>

            <Panel title="Approval chain" sub="Who signed, when, on what evidence">
              <div className="col gap8">
                <div className="provenance-item"><span>Designer</span><b>{pack.project.designer} · cue sheet signed</b></div>
                <div className="provenance-item"><span>Producer</span><b>{selected.approvedBy ? `${selected.approvedBy} · ${selected.signature}` : "outstanding"}</b></div>
                <div className="provenance-item"><span>Venue crew</span><b>R. Okafor · rig and power at load-in</b></div>
                <div className="provenance-item"><span>Safety</span><b>SIGNED BY A HUMAN. Never automated.</b></div>
              </div>
              <div className="row gap6 mt12 wrap">
                <Chip tone={selected.status === "approved" ? "ok" : "warn"}>{selected.status === "approved" ? "approved" : "approval due"}</Chip>
                <Chip>audit {approvals.length} events</Chip>
              </div>
            </Panel>
          </div>

          <Panel title="Approval audit" sub="Append-only. Reviews, edits, signatures and exports.">
            <AuditList events={approvals} limit={8} />
          </Panel>

          <Panel title="Cue sheet diff · v4 → current" sub={`${pack.metrics.cueChanges} changes during rehearsal against a baseline of 17`}>
            <div className="diff-list">
              {[
                ["LX 7", "AERIAL 12 rejected; cue resolves to SIX BEAM + MONOLITH"],
                ["LX 8", "Strobe hit moved 0.4 s after the drop; collision flagged"],
                ["VID 4", "SIGNAL BARS v4 missing; cue blocked, MONOLITH fallback prepared"],
                ["LX 20", "Afterglow warm palette locked; no new fixture"],
                ["STG 3", "Monolith strike window reduced to 90 s"],
              ].map(([id, detail]) => (
                <div className="diff-row" key={id}>
                  <span className="kind">{id}</span>
                  <span style={{ color: "var(--ink-2)" }}>{detail}</span>
                </div>
              ))}
            </div>
            <div className="row gap6 mt12">
              <Link to="/cues" className="btn sm"><Icon name="cue" size={12} /> Open cue sheet</Link>
              <span className="xsmall soft">Last change {fmtTimecode(pack.cues[pack.cues.length - 1].at)} · {pack.project.version}</span>
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={approveOpen}
        title={`Approve ${selected.id} — ${selected.label}`}
        onClose={() => setApproveOpen(false)}
        actions={
          <>
            <button className="btn" onClick={() => setApproveOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={approve} disabled={!approveNote.trim()}>Sign and approve</button>
          </>
        }
      >
        <p className="small muted">Approval is a human signature. It is attached to this version and cannot be edited. The cue sheet still needs the venue crew's safety sign-off before any cue is released.</p>
        <div className="field mt12">
          <label htmlFor="approve-actor">Actor</label>
          <select id="approve-actor" className="select" value={approveActor} onChange={(e) => setApproveActor(e.target.value)}>
            {pack.users.filter((u) => u.role !== "admin").map((u) => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
          </select>
        </div>
        <div className="field mt12">
          <label htmlFor="approve-note">Approval note</label>
          <textarea id="approve-note" className="textarea" value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={createOpen}
        title="Create a show version"
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <button className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={create} disabled={!newLabel.trim()}>Create draft</button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="new-label">Label</label>
          <input id="new-label" className="input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </div>
        <div className="field mt12">
          <label htmlFor="new-note">Note</label>
          <textarea id="new-note" className="textarea" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
        </div>
        <p className="xsmall soft mt12">The draft captures the active look, cue count, signed cues and approved budget. It does not change the show.</p>
      </Modal>

      <p className="xsmall soft mt16">
        The current show is {currentVersion.id} · {currentVersion.status}. {ui.t("common.approved")} versions are immutable; edits create a new version.
      </p>
    </div>
  );
}
