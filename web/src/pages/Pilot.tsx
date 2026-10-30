import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { downloadText, fmtMoney, fmtPct, toCsv } from "../lib/engine";
import { Bars, Chip, Donut, Meter, PageHead, Panel, Sparkline, Stat } from "../components/UI";
import { Icon } from "../components/Icon";

export default function Pilot() {
  const store = useStore();
  const ui = useUI();
  const { pack, riskCounts } = store;
  const m = pack.metrics;
  const iterationDrop = 1 - m.previzIterations / m.baselineIterations;
  const cueDrop = 1 - m.cueChanges / 17;

  const exportPilot = () => {
    const rows = [
      ["metric", "value", "baseline", "note"],
      ["previz_iterations", m.previzIterations, m.baselineIterations, "to approval"],
      ["cue_changes", m.cueChanges, 17, "during rehearsal"],
      ["time_to_first_look_s", m.timeToFirstLook, 1080, "standing start"],
      ["time_to_cue_sheet_min", m.timeToCueSheet, 150, "draft"],
      ["rig_cost_avoided_eur", m.rigCostAvoided, 0, "caught before load-in"],
      ["rehearsal_hours_saved", m.rehearsalHoursSaved, 0, "measured"],
      ["risk_precision", m.precision, 0, "confirmed / raised"],
      ["actionable_rate", m.actionableRate, 0, "risks that led to a fix"],
      ["approval_on_time", m.approvalOnTime, 0, "show versions"],
    ];
    downloadText(`pilot-${pack.project.version}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHead
        kicker={`${pack.project.productionCompany} · one tour · 90 days`}
        title="Pilot measurement"
        sub="The pilot is not a demo. One production company, three shows, 90 days, measured against the way the office works now. The designer stays in charge."
        actions={
          <>
            <button className="btn" onClick={exportPilot}><Icon name="download" size={13} /> Export</button>
            <Link to="/readiness" className="btn"><Icon name="readiness" size={13} /> Readiness board</Link>
            <Link to="/booth" className="btn primary"><Icon name="shows" size={13} /> Booth</Link>
          </>
        }
      />

      <div className="stat-rail mb24">
        <Stat label="Previz iterations" value={m.previzIterations} unit={`/ ${m.baselineIterations}`} foot={`−${fmtPct(iterationDrop)} against baseline`} tone="accent" />
        <Stat label="Cue-sheet changes" value={m.cueChanges} unit="/ show" foot={`−${fmtPct(cueDrop)} against baseline 17`} />
        <Stat label="Rig cost avoided" value={fmtMoney(m.rigCostAvoided)} foot="catching the add-on before load-in" />
        <Stat label="Rehearsal time saved" value={m.rehearsalHoursSaved} unit="h" foot="per show week · measured with the crew" />
      </div>

      <div className="pilot-grid mb24">
        <div className="pilot-chart">
          <h4>Iterations to approval</h4>
          <Bars data={m.weekly.map((w) => ({ label: w.week, value: w.iterations }))} max={m.baselineIterations} color="var(--accent)" />
          <p className="xsmall soft mt8">Baseline 11. The pilot target was 4; the show reached 3.</p>
        </div>
        <div className="pilot-chart">
          <h4>Cue changes in rehearsal</h4>
          <Bars data={m.weekly.map((w) => ({ label: w.week, value: w.cueChanges }))} max={17} color="var(--verified)" />
          <p className="xsmall soft mt8">Baseline 17. The drop review removed most of the churn.</p>
        </div>
        <div className="pilot-chart">
          <h4>Show cost</h4>
          <Sparkline values={m.weekly.map((w) => w.cost)} width={260} height={70} color="var(--warn)" />
          <div className="row between mt8">
            <span className="xsmall soft">W34 {fmtMoney(m.weekly[0].cost)}</span>
            <span className="xsmall soft">Now {fmtMoney(m.weekly[m.weekly.length - 1].cost)}</span>
          </div>
          <p className="xsmall soft mt8">The landing look is €1,373 under the approved budget.</p>
        </div>
      </div>

      <div className="readiness-grid">
        <div className="col gap16">
          <Panel title="The 90-day pilot" sub="One production company. Three shows. Run alongside the existing process.">
            <div className="phase-list">
              {[
                ["01", "Baseline the current process", "Iterations, cue changes, rehearsal hours, rig cost, approval time. No tool in the room yet.", true],
                ["02", "Load one tour and one venue", "Track, stage, rig, power, cues, rights, budget, readiness. Shadow mode first.", true],
                ["03", "Run three shows", "The designer uses the desk. The producer uses readiness. The crew uses the cue sheet.", true],
                ["04", "Measure and renew", "Iterations to approval, cue changes, cost avoided, rehearsal time, precision and fatigue.", false],
              ].map(([n, title, detail, done]) => (
                <div className="phase-row" key={String(n)}>
                  <b>{n}</b>
                  <span style={{ flex: 1 }}><b style={{ color: "var(--ink-2)", fontFamily: "inherit", fontSize: "inherit" }}>{title}</b><span className="xsmall soft" style={{ display: "block" }}>{detail}</span></span>
                  {done ? <Icon name="check" size={13} className="done" /> : <Chip tone="warn">in progress</Chip>}
                </div>
              ))}
            </div>
            <div className="row gap6 mt12 wrap">
              <Chip tone="accent">one tour · 90 days</Chip>
              <Chip>shadow mode first</Chip>
              <Chip>no live control</Chip>
              <Chip>no automatic cue release</Chip>
            </div>
          </Panel>

          <Panel title="Gate 2 · what has to be true" sub="Written before launch, not after">
            <div className="col gap12">
              <Meter value={m.precision} tone={m.precision >= 0.8 ? "ok" : "warn"} label="Risk precision ≥ 0.80" right={fmtPct(m.precision)} />
              <Meter value={m.actionableRate} tone={m.actionableRate >= 0.25 ? "ok" : "warn"} label="Actionable rate ≥ 25%" right={fmtPct(m.actionableRate)} />
              <Meter value={m.approvalOnTime} tone="ok" label="Approvals on time" right={fmtPct(m.approvalOnTime)} />
              <div className="row between small"><span className="soft">Missed load-ins</span><b className="ok">0</b></div>
              <div className="row between small"><span className="soft">Kill criteria</span><b className="mono">precision {'<'} 0.60 · fatigue above budget · unsafe routing</b></div>
            </div>
          </Panel>

          <Panel title="What the pilot measures" sub="And what it does not claim">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Measure</th><th>Method</th><th>Not claimed</th></tr></thead>
                <tbody>
                  {[
                    ["Iterations to approval", "Count every previz review until the producer signs.", "Not a claim about the quality of the idea."],
                    ["Cue changes in rehearsal", "Diff the cue sheet each day.", "Not a claim that fewer cues is better."],
                    ["Rig cost avoided", "The add-on removed before the order.", "Not booked savings until the invoice."],
                    ["Rehearsal hours", "Crew timesheet, per show week.", "Not a productivity score for a person."],
                    ["Risk precision", "Confirmed issues / risks raised.", "Shadow mode only, per tour."],
                    ["Approval time", "Version created → signed.", "Not a substitute for judgement."],
                  ].map(([a, b, c]) => (
                    <tr key={a}><td><b>{a}</b></td><td className="soft">{b}</td><td className="soft">{c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="Readiness quality" sub="Shadow → pilot → production">
            <div className="row gap16" style={{ alignItems: "center" }}>
              <Donut value={m.precision} label="precision" size={100} />
              <div className="col gap6">
                <div className="row between small"><span className="soft">Open risks</span><b className="mono">{riskCounts.open}</b></div>
                <div className="row between small"><span className="soft">Critical</span><b className="mono bad">{riskCounts.critical}</b></div>
                <div className="row between small"><span className="soft">Resolved</span><b className="mono ok">{riskCounts.resolved}</b></div>
                <div className="row between small"><span className="soft">Dismissed</span><b className="mono">{riskCounts.dismissed}</b></div>
              </div>
            </div>
            <div className="section-label"><span>Gates</span></div>
            <div className="col gap8">
              <div className="row between small"><span><b>Gate 1</b> · 4-week shadow</span><Chip tone="ok">passed</Chip></div>
              <div className="row between small"><span><b>Gate 2</b> · 90-day tour</span><Chip tone="warn">in progress</Chip></div>
              <div className="row between small"><span><b>Gate 3</b> · production</span><Chip>not started</Chip></div>
            </div>
            <p className="xsmall soft mt12">No customer-facing risk before the producer validates the first N per tour. Kill criteria are written before launch.</p>
          </Panel>

          <Panel title="Pilot offer" sub="One page, one tour">
            <p className="small muted">A 90-day tour readiness pilot for one production company, one tour and one venue. Setup, a shadow month, three shows, a measured review and a renewal decision. Conversion credit from the pilot fee.</p>
            <div className="provenance-grid mt12">
              <div className="provenance-item"><span>Scope</span><b>1 tour · 3 shows · 1 venue</b></div>
              <div className="provenance-item"><span>Mode</span><b>Shadow, then show-week</b></div>
              <div className="provenance-item"><span>Price</span><b>{fmtMoney(pack.billing.perShow)} / show + seats</b></div>
              <div className="provenance-item"><span>Exit</span><b>Kill criteria signed up front</b></div>
            </div>
            <Link to="/about" className="btn sm mt12">Read the offer <Icon name="arrow" size={11} /></Link>
          </Panel>

          <Panel title="The pilot team" sub="Roles, not personas">
            <div className="col gap6">
              {pack.users.filter((u) => u.role !== "admin").map((u) => (
                <div key={u.id} className="row between small">
                  <span><b>{u.name}</b> <span className="soft">· {u.role.replace("_", " ")}</span></span>
                  <span className="avatar" style={{ width: 22, height: 22, fontSize: 8 }}>{u.initials}</span>
                </div>
              ))}
            </div>
            <p className="xsmall soft mt12">The daily user is the production office. The designer is the author. The crew runs the show.</p>
          </Panel>

          <Panel title="What CUE does not do" sub="Enforced as non-goals">
            <div className="not-list">
              {["Run DMX or control the live show", "Replace the previz renderer", "Generate the artist's music", "Replace the CAD drafting tool", "Design the show autonomously", "Sign safety for a human"].map((n) => (
                <div className="not-row" key={n}><Icon name="x" size={12} /><span>{n}</span></div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      <p className="xsmall soft mt16">
        {ui.showDemoNotices ? "The public demo uses synthetic pilot numbers. " : ""}{ui.t("common.offline")}. The measurement definitions and gates are the ones a real pilot would sign.
      </p>
    </div>
  );
}
