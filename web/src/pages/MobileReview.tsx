import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { daysUntil, fmtDate, fmtShortDate } from "../lib/engine";
import { Chip, PageHead, Panel } from "../components/UI";
import { Icon } from "../components/Icon";

export default function MobileReview() {
  const store = useStore();
  const ui = useUI();
  const { pack, openRisks, cues, signedCues, settings, nextDateId } = store;
  const next = pack.dates.find((d) => d.id === nextDateId) ?? pack.dates[0];
  const venue = pack.venues.find((v) => v.id === next.venueId);
  const lead = [...openRisks].sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1))[0];
  const [done, setDone] = useState<string[]>([]);
  const mark = (id: string) => setDone((d) => d.includes(id) ? d : [...d, id]);
  const days = daysUntil(next.show, pack.project.anchor);
  const safety = cues.filter((c) => c.safety);

  return (
    <div>
      <PageHead
        kicker="Mobile review · producers and tour managers"
        title={ui.t("mobile.title")}
        sub={ui.t("mobile.sub")}
        actions={<Link to="/readiness" className="btn"><Icon name="readiness" size={13} /> Full readiness board</Link>}
      />

      <div className="mobile-wrap">
        <div className="phone">
          <div className="phone-screen">
            <div className="phone-bar">
              <span>20:14</span>
              <span>● {store.live ? "on-site" : "offline"}</span>
              <span>5G ▮▮▮</span>
            </div>
            <div className="mobile-content">
              <div className="row between">
                <div>
                  <div className="xsmall mono accent">NOVA VALE · {pack.project.version}</div>
                  <h2 style={{ fontSize: 18, letterSpacing: "-.03em" }}>Night Signal</h2>
                  <div className="xsmall soft">{next.city} · {fmtDate(next.date)} · in {days} days</div>
                </div>
                <span className="avatar" style={{ width: 32, height: 32 }}>MV</span>
              </div>

              <div className="mobile-card">
                <div className="row between">
                  <span className="xsmall cap soft">Next show</span>
                  <Chip tone={next.status === "at_risk" ? "warn" : "ok"}>{next.status.replace("_", " ")}</Chip>
                </div>
                <h3>{venue?.name}</h3>
                <p>{venue?.stage.width} × {venue?.stage.depth} m · {venue?.power.kw} kW · load-in {venue?.loadInHours} h · curfew {next.curfew}</p>
                <div className="mobile-actions">
                  <Link to="/venues" className="btn"><Icon name="venue" size={12} /> Venue</Link>
                  <Link to="/cues" className="btn"><Icon name="cue" size={12} /> Cue sheet</Link>
                </div>
              </div>

              {lead && (
                <div className="mobile-card" style={{ borderColor: "var(--bad)" }}>
                  <div className="row between">
                    <span className="xsmall cap" style={{ color: "var(--bad)" }}>Stop-work · {lead.id}</span>
                    <Chip tone="bad">{lead.severity}</Chip>
                  </div>
                  <h3>{lead.title}</h3>
                  <p>{lead.detail}</p>
                  <div className="row gap6 mt8 wrap">
                    <Chip>{lead.owner}</Chip>
                    <Chip>due {fmtShortDate(lead.due)}</Chip>
                    <Chip>{lead.fix.label}</Chip>
                  </div>
                  <div className="mobile-actions">
                    <button className="btn" onClick={() => { store.acknowledgeRisk(lead.id); mark(lead.id); }}>
                      <Icon name={done.includes(lead.id) ? "check" : "eye"} size={12} /> {done.includes(lead.id) ? "Acknowledged" : "Acknowledge"}
                    </button>
                    <Link to={`/readiness?risk=${lead.id}`} className="btn primary">Why this risk?</Link>
                  </div>
                </div>
              )}

              <div className="mobile-card">
                <div className="row between">
                  <span className="xsmall cap soft">Open risks</span>
                  <span className="mono xsmall">{openRisks.length}</span>
                </div>
                {openRisks.slice(0, 3).map((r) => (
                  <div key={r.id} className="mobile-cue" style={{ gridTemplateColumns: "52px 1fr auto" }}>
                    <span className="id">{r.id}</span>
                    <span>{r.title}<span className="xsmall soft" style={{ display: "block" }}>{r.owner} · {r.state}</span></span>
                    <Chip tone={r.severity === "critical" ? "bad" : r.severity === "high" ? "warn" : "info"}>{r.severity}</Chip>
                  </div>
                ))}
                <div className="mobile-actions"><Link to="/readiness" className="btn">Open the board</Link></div>
              </div>

              <div className="mobile-card">
                <div className="row between">
                  <span className="xsmall cap soft">Safety cues</span>
                  <span className="mono xsmall">{safety.filter((c) => signedCues[c.id]).length} / {safety.length}</span>
                </div>
                {safety.slice(0, 4).map((c) => (
                  <div key={c.id} className="mobile-cue">
                    <span className="id">{c.id}</span>
                    <span>{c.title}<span className="time" style={{ display: "block" }}>{fmtShortDate(next.date)} · {c.fade}s</span></span>
                    {signedCues[c.id] ? (
                      <span className="sign-badge"><Icon name="check" size={11} /> signed</span>
                    ) : (
                      <button className="btn sm danger" onClick={() => store.signCue(c.id)}>Sign</button>
                    )}
                  </div>
                ))}
                <div className="mobile-actions">
                  <button className="btn ok" onClick={store.signSafetyCues}><Icon name="shield" size={12} /> Sign all</button>
                  <Link to="/cues" className="btn">Review</Link>
                </div>
              </div>

              <div className="mobile-card">
                <div className="row between">
                  <span className="xsmall cap soft">Approval due</span>
                  <Chip tone="warn">show v5</Chip>
                </div>
                <h3>Producer sign-off</h3>
                <p>The designer signed the cue sheet. The producer has not approved the show version. Safety remains with the venue crew.</p>
                <div className="mobile-actions">
                  <Link to="/versions" className="btn primary">Review version</Link>
                  <Link to="/readiness?brief=1" className="btn">Brief</Link>
                </div>
              </div>

              <div className="mobile-card">
                <div className="row between">
                  <span className="xsmall cap soft">Quiet hours</span>
                  <Chip>{settings.quietHours}</Chip>
                </div>
                <p className="xsmall">Critical show-week risks break quiet hours. Everything else waits for the {settings.digest} digest.</p>
                <div className="mobile-fab">
                  <Link to="/readiness?brief=1" className="btn sm"><Icon name="file" size={11} /> Show-week brief</Link>
                  <Link to="/readiness" className="btn sm"><Icon name="readiness" size={11} /> All risks</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Panel title="Why this is a phone surface, not a squeezed desktop" sub="Designed at 390 px and 768 px">
        <div className="g3">
          <div className="provenance-item"><span>Targets</span><b>44 px minimum. One decision per card; sticky actions at the bottom of the thumb.</b></div>
          <div className="provenance-item"><span>Content</span><b>The producer needs budget, approvals and the show-week brief. The crew needs the cue sheet, rig check and sign-off. Not the 3D canvas.</b></div>
          <div className="provenance-item"><span>Offline</span><b>PWA shell and cached show pack. The phone works in a venue basement with no bars.</b></div>
        </div>
      </Panel>

      <p className="xsmall soft mt16">The mobile card is an acknowledge surface. It never changes a cue or releases a show.</p>
    </div>
  );
}
