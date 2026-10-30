import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { answerQuestion, type Answer } from "../lib/ask";
import { fmtMoney, fmtPct } from "../lib/engine";
import type { AgentSuggestion } from "../types";
import { Chip, Modal, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

interface LiveStep {
  tool: string;
  args: Record<string, unknown>;
  ms: number;
  ok: boolean;
  citations: string[];
}

interface LiveAnswer extends Answer {
  steps?: LiveStep[];
  notice?: string;
  backend?: string;
  degraded?: boolean;
  elapsed_ms?: number;
}

/** The agent writes light markdown (bold and inline code). Render just that. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

const WORKSPACE_SAMPLES = [
  "Which room cannot power the full look?",
  "Which shows fall outside the video licence?",
  "What does the Long Way look cost?",
  "Which clip is missing, and what is the fallback?",
  "What load is on the front truss?",
  "What should the producer fix first?",
];

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
  const [answer, setAnswer] = useState<LiveAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ ok: boolean; latency_ms?: number; answer?: string; error?: string } | null>(null);
  const [probing, setProbing] = useState(false);
  const [rejecting, setRejecting] = useState<AgentSuggestion | null>(null);
  const [reason, setReason] = useState("");

  const ask = async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setAnswer(answerQuestion(pack, q, { activeLookId: activeLook.id, rejectedLooks }));
      return;
    }
    // A deep link can land before the on-site handshake finishes.
    const online = store.live || (await store.untilBooted());
    const workspace = store.mode === "workspace";
    if (!online) {
      if (workspace) {
        setAnswer({
          question: q,
          title: "The agent needs the on-site runtime",
          body: "Your tour is analysed by the OpenJiuwen runtime. Start the on-site service, or open the synthetic demo for the offline answer set.",
          citations: [],
          links: [{ label: "Data source", to: "/settings" }],
          tool: "agent.unavailable",
        });
        return;
      }
      setAnswer(answerQuestion(pack, q, { activeLookId: activeLook.id, rejectedLooks }));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(new URL("api/agent/ask", document.baseURI).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          active_look_id: activeLook.id,
          rejected_looks: rejectedLooks,
          // The on-site runtime reads the posted pack; it never writes it.
          ...(workspace ? { pack: store.pack } : {}),
        }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(detail.detail ?? `HTTP ${response.status}`);
      }
      const data = (await response.json()) as LiveAnswer;
      setAnswer({ ...data, question: q });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent did not answer.";
      store.say(message);
      if (store.mode === "workspace") {
        setAnswer({
          question: q,
          title: "The agent did not answer",
          body: `${message}. Your tour is unchanged; the agent is read-only.`,
          citations: [],
          links: [{ label: "Readiness", to: "/readiness" }],
          tool: "agent.error",
        });
      } else {
        setAnswer(answerQuestion(pack, q, { activeLookId: activeLook.id, rejectedLooks }));
      }
    } finally {
      setBusy(false);
    }
  };

  const runProbe = async () => {
    setProbing(true);
    setProbe(null);
    try {
      const response = await fetch(new URL("api/agent/probe", document.baseURI).toString(), { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; latency_ms?: number; answer?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail ?? `HTTP ${response.status}`);
      setProbe({ ok: Boolean(data.ok), latency_ms: data.latency_ms, answer: data.answer });
    } catch (error) {
      setProbe({ ok: false, error: error instanceof Error ? error.message : "Probe failed." });
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setQuery(q);
      void ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = agentStatus.backend === "openjiuwen";
  const steps = answer?.steps ?? null;
  const samples = store.mode === "workspace" ? WORKSPACE_SAMPLES : SAMPLES;
  const latency = probe?.latency_ms ?? agentStatus.last_latency_ms ?? null;

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
            <Chip tone={live ? "ok" : agentStatus.configured ? "warn" : "info"} dot>
              {live ? `openjiuwen · ${agentStatus.model}` : agentStatus.configured ? "configured" : "offline demo"}
            </Chip>
            {store.mode === "workspace" && <Chip tone="accent">your tour</Chip>}
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
              <button className="btn primary" onClick={() => void ask(query)} disabled={busy}>
                <Icon name="arrow" size={13} /> {busy ? "Thinking…" : "Ask"}
              </button>
            </div>
            <div className="row gap4 wrap mb12">
              {samples.slice(0, 4).map((s) => <button key={s} className="btn sm ghost" onClick={() => void ask(s)} disabled={busy}>{s}</button>)}
            </div>
            {answer ? (
              <div className="answer-card">
                <div className="row between">
                  <span className="tag">{answer.tool}</span>
                  <div className="row gap6">
                    {answer.backend === "openjiuwen" && <Chip tone="ok">openjiuwen</Chip>}
                    {answer.degraded && <Chip tone="warn">local fallback</Chip>}
                    {answer.elapsed_ms ? <span className="xsmall mono soft">{answer.elapsed_ms} ms</span> : null}
                    <button className="btn sm ghost" onClick={() => void ask(query)} disabled={busy}><Icon name="refresh" size={11} /> Re-run</button>
                  </div>
                </div>
                <h3 className="mt8">{answer.title}</h3>
                <div className="answer-body"><RichText text={answer.body} /></div>
                {answer.degraded && (
                  <div className="banner warn mt8"><Icon name="alert" size={13} /><span>{answer.notice ?? "The configured runtime did not answer; this is the deterministic local answer."}</span></div>
                )}
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
                  {samples.slice(2).map((s) => <button key={s} className="btn sm" onClick={() => void ask(s)} disabled={busy}>{s}</button>)}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Agent runtime"
            sub={
              store.mode === "workspace"
                ? live
                  ? "OpenJiuwen reads your posted tour, read-only"
                  : "Your tour needs the on-site runtime"
                : live
                  ? "The on-site build answers through OpenJiuwen"
                  : "The public demo answers deterministically"
            }
            actions={
              store.live ? (
                <button className="btn sm" onClick={() => void runProbe()} disabled={probing}>
                  <Icon name="activity" size={11} /> {probing ? "Testing…" : "Test runtime"}
                </button>
              ) : null
            }
          >
            <div className="agent-status-grid">
              <div className="agent-status"><span>Backend</span><b>{agentStatus.backend}</b></div>
              <div className="agent-status"><span>Model</span><b>{agentStatus.model}</b></div>
              <div className="agent-status"><span>Provider</span><b>{agentStatus.provider ?? "—"}</b></div>
              <div className="agent-status"><span>Endpoint</span><b>{agentStatus.endpoint ?? "—"}</b></div>
              <div className="agent-status"><span>Runtime</span><b>{agentStatus.runtime_version ?? "local"}</b></div>
              <div className="agent-status">
                <span>Last latency</span>
                <b>{latency ? `${latency} ms` : "—"}</b>
              </div>
            </div>
            <p className="xsmall soft mt12">{agentStatus.detail}</p>
            {agentStatus.last_error && <p className="xsmall mt8" style={{ color: "var(--bad)" }}>Last error: {agentStatus.last_error}</p>}
            {probe && (
              <div className={`banner ${probe.ok ? "" : "warn"} mt8`}>
                <Icon name={probe.ok ? "check" : "alert"} size={13} />
                <span>{probe.ok ? `Runtime answered in ${probe.latency_ms} ms: “${probe.answer ?? "ready"}”.` : probe.error}</span>
              </div>
            )}
            <div className="row gap6 mt12 wrap">
              <Chip tone="info">POST /api/agent/ask</Chip>
              <Chip tone="info">POST /api/agent/probe</Chip>
              <Chip>{live ? "read-only tools · cited" : "no cloud call in the public demo"}</Chip>
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
          <Panel
            title={ui.t("agent.tools")}
            sub={steps ? `${steps.length} tool read(s) in this answer · every call inspectable` : `${pack.agentTrace.length} steps · the reference trace`}
          >
            <div className="tool-steps">
              {steps
                ? steps.map((step, index) => (
                    <div key={`${step.tool}-${index}`} className="tool-step done">
                      <span className="n">{index + 1}</span>
                      <div>
                        <b>{step.tool}</b>
                        <p className="mono">{Object.keys(step.args).length ? JSON.stringify(step.args) : "no arguments"}</p>
                        <div className="row gap4 wrap mt8">
                          <span className="tool">{step.citations.length} citation(s)</span>
                          {step.citations.map((c) => <span className="cite" key={c}>{c}</span>)}
                        </div>
                      </div>
                      <span className="ms">{step.ms} ms</span>
                    </div>
                  ))
                : pack.agentTrace.map((step) => (
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
            <p className="xsmall soft mt12">
              {steps
                ? "These are the actual read-only tool calls behind the answer. No tool can change a cue, sign safety or release a show."
                : "This is the reference trace of a proposal. On site, the panel shows the real OpenJiuwen tool calls."}
            </p>
          </Panel>

          {store.mode === "demo" && <Panel title="Ranked proposals" sub="Impact first, consequences attached. A rejection re-ranks on the next read.">
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
          </Panel>}

          {store.mode === "demo" && <Panel title="Agent citation coverage" sub="What the pilot measures">
            <div className="row gap16">
              <div><div className="stat-label">Claims with a source</div><div className="stat-value" style={{ fontSize: 28 }}>95<span style={{ fontSize: 12, color: "var(--muted)" }}>%</span></div></div>
              <div><div className="stat-label">Missing evidence</div><div className="stat-value" style={{ fontSize: 28 }}>1</div></div>
              <div><div className="stat-label">Human overrides</div><div className="stat-value" style={{ fontSize: 28 }}>{Object.keys(store.rejectedLooks).length}</div></div>
            </div>
            <p className="xsmall soft mt12">The one missing evidence item is SIGNAL BARS v4. The agent says “missing asset”, not a guess. That is the behaviour the pilot checks.</p>
            <Link to="/pilot" className="btn sm mt12">Pilot measurement <Icon name="arrow" size={11} /></Link>
          </Panel>}
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
