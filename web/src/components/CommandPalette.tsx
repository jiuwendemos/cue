import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useUI } from "../lib/ui";
import { answerQuestion } from "../lib/ask";
import { Icon } from "./Icon";

interface Item {
  id: string;
  group: string;
  label: string;
  hint: string;
  to: string;
  icon: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { pack, activeLookId, rejectedLooks } = useStore();
  const { t } = useUI();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Item[]>(() => {
    const routes: Item[] = [
      { id: "r-home", group: "Go", label: t("nav.now"), hint: "Project home", to: "/", icon: "target" },
      { id: "r-show", group: "Go", label: t("nav.show"), hint: "Stage, looks, video, blocking", to: "/show", icon: "stage" },
      { id: "r-cues", group: "Go", label: t("nav.cues"), hint: "The technical score", to: "/cues", icon: "cue" },
      { id: "r-budget", group: "Go", label: t("nav.budget"), hint: "Rig, crew, power, content", to: "/budget", icon: "budget" },
      { id: "r-readiness", group: "Go", label: t("nav.readiness"), hint: "Tour risk board", to: "/readiness", icon: "readiness" },
      { id: "r-watch", group: "Go", label: t("nav.watch"), hint: "Live proactive control room", to: "/watch", icon: "activity" },
      { id: "r-manager", group: "Go", label: t("nav.manager"), hint: "The 10-minute manager cut", to: "/manager", icon: "target" },
      { id: "r-agent", group: "Go", label: t("nav.agent"), hint: "Ask the show", to: "/agent", icon: "agent" },
      { id: "r-venues", group: "Go", label: t("nav.venues"), hint: "Venue profiles", to: "/venues", icon: "venue" },
      { id: "r-versions", group: "Go", label: t("nav.versions"), hint: "Diffs and approvals", to: "/versions", icon: "versions" },
      { id: "r-pilot", group: "Go", label: t("nav.pilot"), hint: "Pilot measurement", to: "/pilot", icon: "pilot" },
      { id: "r-mobile", group: "Go", label: t("nav.mobile"), hint: "Phone review", to: "/mobile", icon: "mobile" },
      { id: "r-design", group: "Go", label: t("nav.design"), hint: "Tokens and components", to: "/design", icon: "design" },
      { id: "r-admin", group: "Go", label: t("nav.admin"), hint: "Integrations, roles, billing", to: "/admin", icon: "admin" },
      { id: "r-settings", group: "Go", label: "Studio settings", hint: "Theme, role, language, demo notices", to: "/settings", icon: "settings" },
      { id: "r-glossary", group: "Go", label: "Glossary", hint: "How to read the show", to: "/glossary", icon: "about" },
      { id: "r-provenance", group: "Go", label: t("nav.provenance"), hint: "Rights and data", to: "/provenance", icon: "provenance" },
      { id: "r-about", group: "Go", label: t("nav.about"), hint: "What CUE is and is not", to: "/about", icon: "about" },
      { id: "r-stage", group: "Go", label: t("nav.stage"), hint: "The 90-second piece", to: "/stage", icon: "play" },
      { id: "r-booth", group: "Go", label: t("nav.booth"), hint: "Deterministic run", to: "/booth", icon: "shows" },
    ];
    const looks: Item[] = pack.looks.map((l) => ({
      id: `l-${l.id}`, group: "Looks", label: l.name, hint: `${l.code} · impact ${l.impact} · ${l.fixtureIds.length} fixtures`, to: `/show?tab=looks&look=${l.id}`, icon: "look",
    }));
    const risks: Item[] = pack.risks.map((r) => ({
      id: `k-${r.id}`, group: "Risks", label: `${r.id} — ${r.title}`, hint: `${r.severity} · ${r.state} · ${r.owner}`, to: `/readiness?risk=${r.id}`, icon: "readiness",
    }));
    const cues: Item[] = pack.cues.slice(0, 30).map((c) => ({
      id: `c-${c.id}`, group: "Cues", label: `${c.id} — ${c.title}`, hint: `at ${c.at.toFixed(1)}s · ${c.kind} · ${c.owner}`, to: `/cues?cue=${encodeURIComponent(c.id)}`, icon: "cue",
    }));
    const venues: Item[] = pack.venues.map((v) => ({
      id: `v-${v.id}`, group: "Venues", label: `${v.name} — ${v.city}`, hint: `${v.stage.width} × ${v.stage.depth} m · ${v.power.kw} kW · ${v.capacity} cap`, to: `/venues?venue=${v.id}`, icon: "venue",
    }));
    return [...routes, ...looks, ...risks, ...cues, ...venues];
  }, [pack, t]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items.filter((i) => i.group === "Go").slice(0, 9);
    const words = q.split(/\s+/);
    return items
      .filter((item) => words.every((w) => `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(w)))
      .slice(0, 14);
  }, [items, query]);

  const answer = useMemo(
    () => (query.trim().length > 2 ? answerQuestion(pack, query, { activeLookId, rejectedLooks }) : null),
    [activeLookId, pack, query, rejectedLooks],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[index]) go(filtered[index].to);
      else go(`/agent?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="command-back" onClick={onClose} role="presentation">
      <div className="command-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("common.search")}
            aria-label="Search the show"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="command-list">
          {filtered.length === 0 && <div className="command-empty">No record matches “{query}”. Ask the agent instead.</div>}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              className={`command-item${i === index ? " sel" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(item.to)}
            >
              <Icon name={item.icon} size={15} />
              <span>
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </span>
              <span className="command-group">{item.group}</span>
            </button>
          ))}
          {answer && (
            <div className="command-answer">
              <div className="command-answer-head">
                <span className="tag">ASK · {answer.tool}</span>
                <button className="btn sm ghost" onClick={() => go(`/agent?q=${encodeURIComponent(query)}`)}>
                  Open in agent <Icon name="arrow" size={11} />
                </button>
              </div>
              <h4>{answer.title}</h4>
              <p>{answer.body}</p>
              {answer.citations.length > 0 && (
                <div className="command-cites">
                  {answer.citations.map((c) => (
                    <span className="cite" key={c.id} title={c.source}>{c.id}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="command-foot">
          <span><span className="kbd">↑↓</span> move</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">⌘K</span> toggle</span>
          <span className="soft">Search looks, risks, cues, venues — or ask a question.</span>
        </div>
      </div>
    </div>
  );
}
