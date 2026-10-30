import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import {
  budgetAddOns,
  budgetBase,
  budgetForLook,
  budgetRows,
  budgetTotal,
  downloadText,
  fmtMoney,
  fmtPct,
  lookStats,
  toCsv,
} from "../lib/engine";
import type { BudgetCategory } from "../types";
import { Chip, Meter, PageHead, Panel, Stat } from "../components/UI";
import { Icon } from "../components/Icon";

const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  rig: "Rig",
  crew: "Crew",
  power: "Power",
  video: "Video",
  transport: "Transport",
  content: "Content",
  contingency: "Contingency",
};

export default function Budget() {
  const store = useStore();
  const ui = useUI();
  const { pack, activeLook, rejectedLooks } = store;
  const [lookId, setLookId] = useState(activeLook.id);
  const [approved, setApproved] = useState(store.budgetApproved);
  const [draftApproved, setDraftApproved] = useState(String(store.budgetApproved));

  const look = pack.looks.find((l) => l.id === lookId) ?? activeLook;
  const stats = useMemo(() => lookStats(pack, look), [look, pack]);
  const total = budgetTotal(pack, look.id);
  const base = budgetBase(pack);
  const addOns = budgetAddOns(pack, look.id);
  const rows = budgetRows(pack, look.id);
  const drift = total - approved;
  const baseSubtotal = rows.filter((r) => r.active && !r.line.optional).reduce((n, r) => n + r.amount, 0);
  const addOnTotal = addOns.reduce((n, l) => n + l.qty * l.unitCost, 0);

  const compare = pack.looks
    .filter((l) => l.id !== "look-blackout")
    .map((l) => ({ look: l, stats: lookStats(pack, l), total: budgetForLook(pack, l.id) }))
    .sort((a, b) => b.look.impact - a.look.impact);

  const exportCsv = () => {
    const header = ["category", "line", "qty", "unit", "unit_cost_eur", "amount_eur", "active", "note"];
    const body = rows.map((r) => [CATEGORY_LABEL[r.line.category], r.line.name, r.line.qty, r.line.unit, r.line.unitCost, r.amount, r.active ? "yes" : "optional", r.line.note]);
    body.push(["contingency", `Contingency ${fmtPct(pack.budget.contingencyPct)}`, 1, "show", Math.round(baseSubtotal * pack.budget.contingencyPct), Math.round(baseSubtotal * pack.budget.contingencyPct), "yes", "Applied to the base subtotal only"]);
    body.push(["total", "Show total", 1, "show", total, total, "yes", `Approved ${approved}`]);
    downloadText(`budget-${pack.project.version}.csv`, toCsv([header, ...body]), "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHead
        kicker={`${pack.project.artist} · ${pack.project.tour}`}
        title={ui.t("budget.title")}
        sub={ui.t("budget.sub")}
        actions={
          <>
            <button className="btn" onClick={exportCsv}><Icon name="download" size={13} /> CSV</button>
            <Link to="/readiness?risk=R-007" className="btn">Budget risk</Link>
            <Link to="/show?tab=looks" className="btn primary"><Icon name="look" size={13} /> Change the look</Link>
          </>
        }
      />

      <div className="budget-hero">
        <div>
          <div className="xsmall cap soft">Current cost · {look.name}</div>
          <div className={`amount ${drift > 0 ? "over" : "under"}`}>{fmtMoney(total)}</div>
          <div className="row gap8 mt8 wrap">
            <Chip tone={drift > 0 ? "bad" : "ok"}>{drift > 0 ? `${fmtMoney(drift)} over` : `${fmtMoney(Math.abs(drift))} under`}</Chip>
            <Chip>{ui.t("budget.approved")} {fmtMoney(approved)}</Chip>
            <Chip tone={look.createdBy === "agent" ? "info" : "neutral"}>{look.createdBy === "agent" ? "agent proposal" : "designer look"}</Chip>
          </div>
        </div>
        <div className="row gap8 wrap">
          <div className="field" style={{ minWidth: 160 }}>
            <label htmlFor="budget-approved">Approved budget</label>
            <div className="row gap4">
              <input id="budget-approved" className="input mono" value={draftApproved} onChange={(e) => setDraftApproved(e.target.value)} />
              <button
                className="btn sm"
                onClick={() => {
                  const n = Number(draftApproved);
                  if (Number.isFinite(n) && n > 0) {
                    setApproved(n);
                    store.setBudgetApproved(n);
                  }
                }}
              >Set</button>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-rail mb24">
        <Stat label="Base show" value={fmtMoney(base)} foot="rig, crew, power, screen, content, transport" />
        <Stat label="Look add-ons" value={fmtMoney(addOnTotal)} foot={addOns.length ? addOns.map((l) => l.name).join(" · ") : "no add-ons"} />
        <Stat label="Power draw" value={stats.powerKw.toFixed(1)} unit="kW" foot={`${fmtPct(stats.supplyPct)} of ${pack.rig.power.kw} kW supply`} tone={stats.supplyPct > 1 ? "bad" : ""} />
        <Stat label="Front truss" value={stats.frontKg} unit="kg" foot={`${fmtPct(stats.weightPct)} of ${stats.frontCapacityKg} kg`} tone={stats.weightPct > 1 ? "bad" : ""} />
      </div>

      <div className="budget-grid">
        <div>
          <Panel
            title="Cost by look"
            sub="The same show, six creative answers. The alternative is not free."
            actions={<Chip tone={drift > 0 ? "warn" : "ok"}>{drift > 0 ? "over approved" : "inside approved"}</Chip>}
          >
            <div className="look-compare">
              {compare.map(({ look: l, total: t, stats: s }) => {
                const rejected = rejectedLooks.includes(l.id);
                const diff = t - approved;
                return (
                  <button
                    key={l.id}
                    className={`compare-card${l.id === look.id ? " best" : ""}${rejected ? " rejected" : ""}`}
                    onClick={() => setLookId(l.id)}
                    style={{ textAlign: "left", font: "inherit" }}
                  >
                    <div className="row between">
                      <h4>{l.name}</h4>
                      {l.id === look.id && <Chip tone="accent">viewing</Chip>}
                    </div>
                    <div className={`money ${diff > 0 ? "neg" : "pos"}`}>{fmtMoney(t)}</div>
                    <div className="row gap6 wrap">
                      <span className={`xsmall ${diff > 0 ? "bad" : "ok"}`}>{diff > 0 ? "+" : ""}{fmtMoney(diff)}</span>
                      <span className="xsmall soft">impact {l.impact}</span>
                      <span className="xsmall soft">{s.powerKw.toFixed(1)} kW</span>
                    </div>
                    {rejected && <div className="xsmall bad mt8">rejected by the designer</div>}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Budget lines" sub={`Contingency ${fmtPct(pack.budget.contingencyPct)} applies to the base subtotal only. Optional lines are priced only when the look is active.`} className="mt16" flush>
            <div style={{ padding: 14 }}>
              <div className="budget-lines">
                {rows.map(({ line, amount, active }) => (
                  <div key={line.id} className={`budget-line${line.optional ? " optional" : ""}${active ? " active" : ""}`}>
                    <span className="name">
                      {line.name}
                      <small>{CATEGORY_LABEL[line.category]} · {line.qty} × {line.unit} · {line.unitCost.toLocaleString("en-IE")} {pack.budget.currency} · {line.note}</small>
                    </span>
                    <span className="xsmall soft">{line.optional ? (active ? "active" : "optional") : "base"}</span>
                    <span className="amount">{fmtMoney(amount)}</span>
                  </div>
                ))}
                <div className="budget-line">
                  <span className="name">Contingency <small>{fmtPct(pack.budget.contingencyPct)} of base subtotal</small></span>
                  <span className="xsmall soft">base</span>
                  <span className="amount">{fmtMoney(Math.round(baseSubtotal * pack.budget.contingencyPct))}</span>
                </div>
                <div className="budget-line total">
                  <span className="name">Show total</span>
                  <span className="xsmall soft">{look.name}</span>
                  <span className="amount">{fmtMoney(total)}</span>
                </div>
              </div>
              <p className="xsmall soft mt12">{pack.budget.note}</p>
            </div>
          </Panel>
        </div>

        <aside className="col gap16">
          <Panel title="Rig, crew and power" sub={`${look.name} · as designed`}>
            <div className="col gap12">
              <Meter value={total} max={Math.max(total, approved)} tone={drift > 0 ? "bad" : "ok"} label="Against approved" right={fmtMoney(total)} />
              <Meter value={stats.powerKw} max={pack.rig.power.kw} tone={stats.supplyPct > 1 ? "bad" : "ok"} label="Power" right={`${stats.powerKw.toFixed(1)} / ${pack.rig.power.kw} kW`} />
              <Meter value={stats.frontKg} max={stats.frontCapacityKg} tone={stats.weightPct > 1 ? "bad" : "ok"} label="Front truss" right={`${stats.frontKg} / ${stats.frontCapacityKg} kg`} />
              <Meter value={stats.glare} max={0.55} tone={stats.glare > 0.55 ? "bad" : "ok"} label="Glare" right={stats.glare.toFixed(2)} />
            </div>
            <div className="section-label"><span>Cost of the look</span></div>
            <div className="col gap6">
              <div className="row between small"><span className="soft">Base show + contingency</span><span className="mono">{fmtMoney(base)}</span></div>
              {addOns.map((l) => (
                <div className="row between small" key={l.id}><span className="soft">{l.name}</span><span className="mono">{fmtMoney(l.qty * l.unitCost)}</span></div>
              ))}
              {addOns.length === 0 && <div className="row between small"><span className="soft">No optional line</span><span className="mono">—</span></div>}
              <div className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}><b>Total</b><b className="mono">{fmtMoney(total)}</b></div>
            </div>
          </Panel>

          <Panel title="What is an estimate" sub="The pilot marks every number">
            <div className="col gap8">
              <div className="provenance-item"><span>Rig and crew</span><b>Vendor rate card 2026, one show. Not a booked saving until the invoice lands.</b></div>
              <div className="provenance-item"><span>Cost avoided</span><b>{fmtMoney(store.pack.metrics.rigCostAvoided)} from catching the six-beam overspend before load-in.</b></div>
              <div className="provenance-item"><span>Contingency</span><b>Applied to the base subtotal. It is not a slush fund for the hero look.</b></div>
            </div>
          </Panel>

          <Panel title="Decision" sub="A creative decision has a cost line">
            <p className="small muted">The approved budget is set by the producer. The designer can choose a look; the producer can approve the version. CUE shows the consequence but does not move money.</p>
            <div className="row gap6 mt12 wrap">
              <button className="btn sm ok" onClick={() => { setApproved(total); store.setBudgetApproved(total); setDraftApproved(String(total)); }}>Approve {fmtMoney(total)} for this look</button>
              <Link to="/versions" className="btn sm">Version approval</Link>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
