import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { answerQuestion, type Answer } from "../lib/ask";
import { fmtMoney, fmtPct } from "../lib/engine";
import type { AgentSuggestion } from "../types";
import { Chip, Modal, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

const SAMPLES = [
  "Why is the front truss over?",
  "Show rig conflicts on this leg",
  "Make the drop warmer",
  "What rights expire before Paris?",
  "Which clip is missing?",
  "What does the front row see?",
  "What is the next show?",
  "Who signs the cue sheet?",
];

export default function Agent() {
  const store = useStore();
  const ui = useUI();
  const { pack, ranked, activeLook, rejectedLooks, agentStatus } = store;
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [rejecting, setRejecting] = useState<AgentSuggestion | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setQuery(q);
      setAnswer(answerQuestion(pack, q, { activeLookId: activeLook.id, rejectedLooks }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ask = (q: string) => {
    setQuery(q);
    setAnswer(answerQuestion(pack, q, { activeLookId: activeLook.id, rejectedLooks }));
  };

  const suggestions = useMemo(() => ranked, [ranked]);

  const doReject = () => {
    if (!rejecting) return;
    store.rejectSuggestion(rejecting.id, reason || "Rejected by the designer.");
    setRejecting(null);
    setReason("");
  };

  return (
    <div>
      <PageHead
        kicker={`${pack.project.artist} · ${pack.project.title} · ${pack.project.version}`}
        title={ui.t("agent.title")}
        sub={ui.t("agent.sub")}
        actions={
          <>
            <Chip tone={agentStatus.configured ? "ok" : "info"} dot>{agentStatus.configured ? "configured" : "offline demo"}</Chip>
            <Link to="/provenance" className="btn"><Icon name="provenance" size={13} /> Model card</Link>
          </>
        }
      />

      <div className="agent-grid">
        <div className="col gap16">
          <Panel title={ui.t("agent.ask")} sub="Answers cite the show records. The agent can propose and check; it cannot change a cue or sign safety.">
            <div className="agent-ask">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ask(query);
                }}
                placeholder="Ask about power, weight, rights, a venue, the budget, the drop…"
                aria-label="Ask the show"
              />
              <button className="btn primary" onClick={() => ask(query)}><Icon name="arrow" size={13} /> Ask</button>
            </div>
            <div className="row gap4 wrap mb12">
              {SAMPLES.slice(0, 4).map((s) => <button key={s} className="btn sm ghost" onClick={() => ask(s)}>{s}</button>)}
            </div>
            {answer ? (
              <div className="answer-card">
                <div className="row between">
                  <span className="tag">{answer.tool}</span>
                  <button className="btn sm ghost" onClick={() => ask(query)}><Icon name="refresh" size={11} /> Re-run</button>
                </div>
                <h3 className="mt8">{answer.title}</h3>
                <p>{answer.body}</p>
                {answer.citations.length > 0 && (
                  <div className="answer-cites">
                    {answer.citations.map((c) => (
                      <div className="citation" key={c.id}>
                        <span className="cid">{c.id}</span>
                        <span className="clabel">{c.label}<span className="csrc">{c.source}</span></span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="row gap6 mt12 wrap">
                  {answer.links.map((l) => <Link key={l.to} to={l.to} className="btn sm">{l.label} <Icon name="arrow" size={11} /></Link>)}
                </div>
                <p className="xsmall soft mt12">No cue changed. No approval signed. The answer is a read of the current show and the evidence attached to it.</p>
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon"><Icon name="agent" size={20} /></div>
                <h3>Ask the show a question</h3>
                <p>The agent answers from the rig, the venue, the cue sheet, the rights register and the budget. It will say when the evidence is missing.</p>
                <div className="row gap4 wrap mt12" style={{ justifyContent: "center" }}>
                  {SAMPLES.slice(2).map((s) => <button key={s} className="btn sm" onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Agent status" sub="What is real and what is simulated">
            <div className="agent-status-grid">
              <div className="agent-status"><span>Configured</span><b>{agentStatus.configured ? "yes" : "no"}</b></div>
              <div className="agent-status"><span>Available</span><b>{agentStatus.available ? "yes" : "no"}</b></div>
              <div className="agent-status"><span>Backend</span><b>{agentStatus.backend}</b></div>
              <div className="agent-status"><span>Model</span><b>{agentStatus.model}</b></div>
              <div className="agent-status"><span>Inference</span><b>{pack.provenance.inference}</b></div>
              <div className="agent-status"><span>Data stay</span><b>{pack.provenance.dataStay}</b></div>
            </div>
            <p className="xsmall soft mt12">{agentStatus.detail}</p>
            <div className="row gap6 mt12 wrap">
              <Chip tone="info">/api/agent/status</Chip>
              <Chip tone="info">deterministic local</Chip>
              <Chip>no cloud call in the public demo</Chip>
            </div>
          </Panel>

          <Panel title="System prompt · guardrails" sub="The hard rules before any tool is called">
            <div className="col gap6">
              {[
                "Cite the source record for every claim. If the evidence is missing, say so.",
                "Never change a cue, approve a version or sign safety. Those are human actions.",
                "Never release a cue to the venue. The venue team runs the show.",
                "The designer is the author. The agent proposes; it does not design the show.",
                "If the rig, power or glare evidence conflicts with a spectacular idea, say the conflict first.",
              ].map((rule, i) => (
                <div className="not-row" key={rule}><span className="mono xsmall soft">{String(i + 1).padStart(2, "0")}</span><span>{rule}</span></div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col gap16">
          <Panel title={ui.t("agent.tools")} sub={`${pack.agentTrace.length} steps · every tool call inspectable`}>
            <div className="tool-steps">
              {pack.agentTrace.map((step) => (
                <div key={step.step} className={`tool-step ${step.status}`}>
                  <span className="n">{step.step}</span>
                  <div>
                    <b>{step.title}</b>
                    <p>{step.detail}</p>
                    <div className="row gap4 wrap mt8">
                      <span className="tool">{step.tool}</span>
                      {step.citations.map((c) => <span className="cite" key={c}>{c}</span>)}
                    </div>
                  </div>
                  <span className="ms">{step.ms > 0 ? `${step.ms} ms` : "waiting"}</span>
                </div>
              ))}
            </div>
            <p className="xsmall soft mt12">This is a read-only trace of the proposal. The waiting step is the designer.</p>
          </Panel>

          <Panel title="Ranked proposals" sub="Impact first, consequences attached. A rejection re-ranks on the next read.">
            <div className="suggest-list">
              {suggestions.map((s) => {
                const rejected = s.status === "rejected";
                const accepted = s.status === "accepted";
                return (
                  <div key={s.id} className={`suggest-card${s.rank === 1 && !rejected ? " top" : ""}${rejected ? " rejected" : ""}`}>
                    <div className="st">
                      <div>
                        <h4>#{s.rank} · {s.name}</h4>
                        <p>{s.summary}</p>
                      </div>
                      <Chip tone={rejected ? "bad" : accepted ? "ok" : s.flags.length ? "warn" : "accent"}>{rejected ? "rejected" : accepted ? "accepted" : s.status}</Chip>
                    </div>
                    <div className="row gap6 wrap">
                      <Chip>impact {s.impact}</Chip>
                      <Chip>confidence {fmtPct(s.confidence)}</Chip>
                      <Chip>{fmtMoney(s.costDelta)}</Chip>
                      {s.flags.map((f) => <Chip key={f} tone="bad">{f}</Chip>)}
                    </div>
                    <div className="col gap2">
                      {s.reasons.map((r) => (
                        <div className="citation" key={r.id}>
                          <span className="cid">{r.id}</span>
                          <span className="clabel">{r.label}<span className="csrc">{r.source}</span></span>
                        </div>
                      ))}
                    </div>
                    <div className="row gap6 wrap">
                      <button className="btn sm ok" disabled={rejected || accepted} onClick={() => store.acceptSuggestion(s.id)}><Icon name="check" size={11} /> Accept</button>
                      <button className="btn sm danger" disabled={rejected} onClick={() => { setRejecting(s); setReason(""); }}><Icon name="x" size={11} /> Reject</button>
                      {s.lookId && <Link to={`/show?look=${s.lookId}`} className="btn sm ghost">Preview</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Agent citation coverage" sub="What the pilot measures">
            <div className="row gap16">
              <div><div className="stat-label">Claims with a source</div><div className="stat-value" style={{ fontSize: 28 }}>95<span style={{ fontSize: 12, color: "var(--muted)" }}>%</span></div></div>
              <div><div className="stat-label">Missing evidence</div><div className="stat-value" style={{ fontSize: 28 }}>1</div></div>
              <div><div className="stat-label">Human overrides</div><div className="stat-value" style={{ fontSize: 28 }}>{Object.keys(store.rejectedLooks).length}</div></div>
            </div>
            <p className="xsmall soft mt12">The one missing evidence item is SIGNAL BARS v4. The agent says “missing asset”, not a guess. That is the behaviour the pilot checks.</p>
            <Link to="/pilot" className="btn sm mt12">Pilot measurement <Icon name="arrow" size={11} /></Link>
          </Panel>
        </div>
      </div>

      <Modal
        open={Boolean(rejecting)}
        title={`Reject ${rejecting?.name ?? "proposal"}`}
        onClose={() => setRejecting(null)}
        actions={
          <>
            <button className="btn" onClick={() => setRejecting(null)}>Cancel</button>
            <button className="btn danger" onClick={doReject} disabled={!reason.trim()}>Reject and re-rank</button>
          </>
        }
      >
        <p className="small muted">The rejection is stored with the show. The system keeps the reason and re-ranks. A human decision is a data point, not an error.</p>
        <div className="field mt12">
          <label htmlFor="agent-reason">Reason</label>
          <textarea id="agent-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="44 kg over the truss, 1.6 kW over supply, blinds the front row." />
        </div>
        <div className="row gap6 mt12 wrap">
          {["Over the truss rating", "Over the house supply", "Blinds the front row", "Does not answer the song"].map((r) => <button key={r} className="btn sm" onClick={() => setReason(r)}>{r}</button>)}
        </div>
      </Modal>
    </div>
  );
}
