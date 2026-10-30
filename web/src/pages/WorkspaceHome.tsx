import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { budgetTotal, fmtDate, fmtMoney } from "../lib/engine";
import { Chip, PageHead, Panel, Stat } from "../components/UI";
import { Icon } from "../components/Icon";

/** The home page for a user's own tour: no synthetic poster, just their show. */
export default function WorkspaceHome() {
  const store = useStore();
  const ui = useUI();
  const ws = store.workspace;
  if (!ws) return null;

  const total = budgetTotal(ws, ws.looks[0]?.id);
  const approved = ws.budget.approved;
  const next = ws.dates.find((d) => d.id === store.nextDateId) ?? ws.dates[0];
  const venue = ws.venues.find((v) => v.id === next?.venueId) ?? ws.venues[0];
  const steps = [
    { done: ws.venues.length > 0, label: "Your home venue", detail: venue ? `${venue.name} · ${venue.city}` : "Add the room you load into", to: "/tour" },
    { done: ws.looks.length > 0, label: "A first look", detail: `${ws.looks.length} look(s) in the library`, to: "/show" },
    { done: ws.cues.length > 1, label: "The cue sheet", detail: `${ws.cues.length} cue(s)`, to: "/cues" },
    { done: ws.budget.lines.length > 1 || approved > 0, label: "A budget", detail: approved ? `${fmtMoney(approved)} approved` : "Set the approved total", to: "/budget" },
    { done: Boolean(next), label: "A date to aim at", detail: next ? `${next.city} · ${next.date}` : "Add a show date", to: "/tour" },
  ];

  return (
    <div>
      <PageHead
        kicker={`MY TOUR · ${ws.project.version.toUpperCase()} · ${ws.project.tour.toUpperCase()}`}
        title={ws.project.title}
        sub={`${ws.project.artist} · ${ws.project.productionCompany}. Your data, saved in this browser.`}
        actions={
          <>
            <Link to="/show" className="btn primary"><Icon name="stage" size={14} /> Open the studio</Link>
            <Link to="/tour" className="btn"><Icon name="file" size={13} /> My tour</Link>
            <Link to="/manager" className="btn"><Icon name="target" size={13} /> Manager brief</Link>
          </>
        }
      />

      <div className="banner mb16">
        <Icon name="file" size={14} />
        <span>
          You are working on your own tour. The synthetic <b>Nova Vale — Night Signal</b> is still available from
          <Link to="/settings" className="accent"> Settings → Data source</Link>.
        </span>
      </div>

      <div className="stat-rail mb24">
        <Stat label="Cues" value={ws.cues.length} foot={ws.cues.length === 1 ? "one to start with" : "on the sheet"} tone="accent" />
        <Stat label="Venues" value={ws.venues.length} foot={venue ? venue.name : "add one"} />
        <Stat label="Dates" value={ws.dates.length} foot={next ? fmtDate(next.date) : "no date yet"} />
        <Stat label="Budget" value={fmtMoney(total)} foot={approved ? `${fmtMoney(approved)} approved` : "no approved total"} />
      </div>

      <div className="manager-grid">
        <Panel title="The first show" sub={`${steps.filter((s) => s.done).length} of ${steps.length} in place`}>
          <div className="tour-checklist">
            {steps.map((step) => (
              <Link key={step.label} to={step.to} className={`tour-check${step.done ? " done" : ""}`}>
                <span className="tour-check-mark">{step.done ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}</span>
                <span>
                  <b>{step.label}</b>
                  <span className="soft">{step.detail}</span>
                </span>
                <Icon name="arrow" size={12} />
              </Link>
            ))}
          </div>
          <p className="xsmall soft mt12">
            Start with the room, one look and one cue. The checks, the budget and readiness work as soon as those exist.
          </p>
        </Panel>

        <Panel title="Next show" sub={next ? "From your own calendar" : "No date yet"}>
          {next ? (
            <>
              <div className="tour-next">
                <b>{next.city}</b>
                <span>{fmtDate(next.date)} · {venue?.name ?? "venue to confirm"}</span>
              </div>
              <div className="col gap6 mt12">
                <div className="row between small"><span className="soft">Load-in</span><b className="mono">{next.loadIn.slice(11, 16)}</b></div>
                <div className="row between small"><span className="soft">Show</span><b className="mono">{next.show.slice(11, 16)}</b></div>
                <div className="row between small"><span className="soft">Curfew</span><b className="mono">{next.curfew}</b></div>
                <div className="row between small"><span className="soft">Stage</span><b>{venue ? `${venue.stage.width} × ${venue.stage.depth} m` : "—"}</b></div>
                <div className="row between small"><span className="soft">Power</span><b>{venue ? `${venue.power.kw} kW` : "—"}</b></div>
              </div>
              <div className="row gap6 mt12 wrap">
                <Link to="/cues" className="btn sm"><Icon name="cue" size={11} /> Cue sheet</Link>
                <Link to="/readiness" className="btn sm"><Icon name="readiness" size={11} /> Readiness</Link>
              </div>
            </>
          ) : (
            <div className="prose">
              <p>Add a date in My tour. Readiness and the checks need a show to aim at.</p>
              <Link to="/tour" className="btn sm mt12"><Icon name="plus" size={11} /> Add a date</Link>
            </div>
          )}
        </Panel>

        <Panel title="What is different from the demo" sub="Honest, so nobody is surprised">
          <div className="col gap6">
            {[
              "Your venues, looks and cues are yours; the checks run on your numbers.",
              "The agent reads your show when the on-site runtime is connected. Offline it answers from the pack in this browser.",
              "The 90-second film is the synthetic demo, not your show.",
              "Readiness is yours: risks come from the scanner or an import, never from the demo.",
            ].map((line, index) => (
              <div className="not-row" key={line}><span className="mono xsmall soft">{String(index + 1).padStart(2, "0")}</span><span>{line}</span></div>
            ))}
          </div>
          <div className="row gap6 mt12 wrap">
            <Chip tone="ok">{ui.locale === "zh" ? "本地保存" : "local only"}</Chip>
            <Chip>export as JSON</Chip>
            <Chip>no upload</Chip>
          </div>
        </Panel>
      </div>
    </div>
  );
}
