import type { Citation, Pack } from "../types";
import { budgetBase, budgetForLook, daysUntil, fmtMoney, lookById, venueById } from "./engine";

export interface Answer {
  question: string;
  title: string;
  body: string;
  citations: Citation[];
  links: { label: string; to: string }[];
  tool: string;
}

/**
 * Deterministic local answers over the show pack. The on-site server exposes the
 * same questions through the DeepAgent adapter; the public demo answers without
 * a network call so the booth runs offline.
 */
export function answerQuestion(
  pack: Pack,
  question: string,
  context: { activeLookId: string; rejectedLooks: string[] },
): Answer {
  const q = question.toLowerCase().trim();
  const link = (label: string, to: string) => ({ label, to });
  const active = lookById(pack, context.activeLookId);

  if (!q) {
    return {
      question,
      title: "Ask the show",
      body: "Try a question about power, weight, rights, a venue, the missing clip, the budget or the drop. Answers cite the source record and never change a cue.",
      citations: [],
      links: [link("Open the show", "/show"), link("Readiness board", "/readiness")],
      tool: "agent.hint",
    };
  }

  if (/(power|supply|amp|kw|electric|breaker)/.test(q)) {
    return {
      question,
      title: "Power: the hero look is over the house supply",
      body: active
        ? `${active.name} draws 44.1 kW against the 43.5 kW three-phase supply at Halcyon Hall. The six-beam landing look draws 34.5 kW, 79% of supply. The house breaker is not a safety margin; the show must stay under the rated supply.`
        : "The show has a 43.5 kW three-phase supply at Halcyon Hall.",
      citations: [
        { id: "cit-power", label: "Supply 43.5 kW · AERIAL 12 44.1 kW", source: "Venue profile — Halcyon Hall", kind: "venue" },
        { id: "cit-look", label: "AERIAL 12 add-on: six beams", source: "Look sheet AI 01", kind: "rig" },
      ],
      links: [link("Open the risk", "/readiness?risk=R-001"), link("See the checks", "/show?tab=stage")],
      tool: "rig.power_check",
    };
  }

  if (/(weight|truss|rig|load|kg|rigging)/.test(q)) {
    return {
      question,
      title: "Weight: 44 kg over the front truss rating",
      body: "AERIAL 12 puts 564 kg on the front truss. The truss is rated 520 kg. The load test certificate covers the base rig, not the six add-on beams. This is a stop-work item until the rigger re-weighs and signs.",
      citations: [
        { id: "cit-rig", label: "Front truss rated 520 kg; look 564 kg", source: "Rig schedule v3", kind: "rig" },
        { id: "cit-load", label: "Load test certificate 2026-10-12", source: "Rigging pack", kind: "rig" },
      ],
      links: [link("Open R-002", "/readiness?risk=R-002"), link("Rig and budget", "/budget")],
      tool: "rig.weight_check",
    };
  }

  if (/(glare|blind|eye|front row|sight)/.test(q)) {
    return {
      question,
      title: "Glare: the audience is never the target",
      body: "Six fixtures in AERIAL 12 are focused at 18° elevation, below the 1.15 m eyeline 2.2 m from the stage. The glare index is 0.92 against a 0.55 limit. The six-beam landing look has no audience-aimed fixture.",
      citations: [
        { id: "cit-eye", label: "Front row eye 1.15 m at 2.2 m", source: "Venue profile — Halcyon Hall", kind: "venue" },
        { id: "cit-glare", label: "Glare index 0.92 vs 0.55", source: "Sightline model v2", kind: "venue" },
      ],
      links: [link("Open R-003", "/readiness?risk=R-003"), link("Previz", "/show?tab=stage")],
      tool: "sightline.glare_check",
    };
  }

  if (/(right|licen|expire|territor|legal|contract)/.test(q)) {
    return {
      question,
      title: "Rights: the video licence expires before Paris",
      body: "MONOLITH, SIGNAL BARS and HORIZON are cleared to 2026-11-10 in the EU, UK and US. Paris (17 Nov), London (20 Nov) and Copenhagen (23 Nov) fall outside the window. The fallback is RAIN, which is cleared worldwide.",
      citations: [
        { id: "right-monolith", label: "Licence expires 2026-11-10", source: "Content licence v2", kind: "rights" },
        { id: "right-rain", label: "RAIN cleared worldwide", source: "Provenance sheet v1", kind: "rights" },
      ],
      links: [link("Open R-004", "/readiness?risk=R-004"), link("Rights register", "/provenance")],
      tool: "rights.window_check",
    };
  }

  if (/(asset|missing|clip|signal bars|deliver|video)/.test(q)) {
    return {
      question,
      title: "Asset: SIGNAL BARS v4 is not delivered",
      body: "Cue VID 14 references signal_bars_v4.mp4, which is not in the asset register. The content studio has confirmed 2026-11-01 in writing. Until it lands, the video drop is not playable; MONOLITH is the fallback.",
      citations: [
        { id: "cit-asset", label: "signal_bars_v4.mp4 missing", source: "Asset register", kind: "asset" },
        { id: "cit-cue14", label: "Cue VID 14 references SIGNAL BARS", source: "Cue sheet v4", kind: "cue" },
      ],
      links: [link("Open R-005", "/readiness?risk=R-005"), link("Cue sheet", "/cues")],
      tool: "asset.drift_check",
    };
  }

  if (/(budget|cost|money|euro|expensive|price)/.test(q)) {
    const base = budgetBase(pack);
    const aerial = budgetForLook(pack, "look-aerial-12");
    const landing = budgetForLook(pack, "look-six-beam");
    return {
      question,
      title: "Budget: the hero look is €577 over, the landing look is €1,373 under",
      body: `The base show and contingency is ${fmtMoney(base)}. AERIAL 12 adds €3,900 and lands at ${fmtMoney(aerial)} against the ${fmtMoney(pack.budget.approved)} approved. SIX BEAM + MONOLITH lands at ${fmtMoney(landing)}.`,
      citations: [
        { id: "cit-budget", label: "Budget model v2", source: "Rate card 2026", kind: "budget" },
        { id: "cit-addon", label: "AERIAL add-on €3,900", source: "Rate card 2026", kind: "budget" },
      ],
      links: [link("Rig and budget", "/budget"), link("Open R-007", "/readiness?risk=R-007")],
      tool: "budget.incremental",
    };
  }

  if (/(warm|warmer|colour|color|afterglow|mood)/.test(q)) {
    return {
      question,
      title: "Warmer: one step to amber, no new fixture",
      body: "The design rule is one accent and one horizon. Warm the drop by moving the wash palette from 3fa7a0 to ffb454 at 25% and keeping the six beams white. That reads warmer without adding a fixture or a cue; the afterglow already owns the amber, so hold it until 5:05.",
      citations: [
        { id: "cit-concept", label: "Concept rule: one silhouette, one horizon, one hit", source: "Concept note v3", kind: "asset" },
        { id: "look-afterglow", label: "AFTERGLOW palette ffb454", source: "Look sheet LX 20", kind: "asset" },
      ],
      links: [link("Open the looks", "/show?tab=looks"), link("Ask the agent", "/agent")],
      tool: "design.command",
    };
  }

  if (/(drop|look|hero|aerial|six|beam)/.test(q)) {
    return {
      question,
      title: "The drop: the safe look is the better look",
      body: "AERIAL 12 scores 97 on impact but fails power, weight and glare. SIX BEAM + MONOLITH scores 89, lands €1,373 under budget and keeps the front row. The designer rejected the spectacular answer; the ranking was recomputed.",
      citations: [
        { id: "cit-human", label: "Designer rejected AERIAL 12", source: "Human decision, 2026-10-30", kind: "human" },
        { id: "cit-eye-ok", label: "No fixture below the eyeline", source: "Sightline model v2", kind: "venue" },
      ],
      links: [link("Open the show", "/show"), link("Why this look?", "/agent")],
      tool: "look.rank",
    };
  }

  if (/(next|date|tour|travel|load-in|load in|schedule)/.test(q)) {
    const next = pack.dates[0];
    const venue = venueById(pack, next.venueId);
    const days = daysUntil(next.show, pack.project.anchor);
    return {
      question,
      title: `Next: ${next.city} in ${days} days`,
      body: `${venue?.name ?? next.city} on ${next.date}. Load-in ${venue?.loadInHours ?? "?"} h, changeover ${venue?.changeoverHours ?? "?"} h, curfew ${next.curfew}. The show is at risk on power, weight and glare until the drop is changed.`,
      citations: [
        { id: next.id, label: `${next.city} · ${next.date}`, source: "Tour calendar", kind: "schedule" },
        { id: venue?.id ?? "venue", label: `${venue?.name ?? "Venue"} · ${venue?.stage.width ?? "?"} × ${venue?.stage.depth ?? "?"} m`, source: "Venue profile", kind: "venue" },
      ],
      links: [link("Readiness board", "/readiness"), link("Tour dates", "/venues")],
      tool: "tour.next_show",
    };
  }

  if (/(who|approve|sign|owner|responsible)/.test(q)) {
    return {
      question,
      title: "Who signs what",
      body: "Mara Voss owns the looks and the safety sign-off on the cue sheet. Jonas Reed approves the show version and the budget. Priya Nair owns the venue advances, crew and travel. The venue crew signs the rig and power at load-in. CUE never signs for them.",
      citations: [
        { id: "u-mara", label: "Mara Voss · designer", source: "Project team", kind: "human" },
        { id: "u-jonas", label: "Jonas Reed · producer", source: "Project team", kind: "human" },
        { id: "u-priya", label: "Priya Nair · tour manager", source: "Project team", kind: "human" },
      ],
      links: [link("Versions and approvals", "/versions"), link("Cue sheet", "/cues")],
      tool: "org.roles",
    };
  }

  if (/(risk|conflict|problem|wrong|ready)/.test(q)) {
    return {
      question,
      title: "Four risks would stop the load-in",
      body: "Power, weight and glare all sit on the AERIAL 12 drop; the video rights expire before Paris. The missing SIGNAL BARS clip blocks the video drop. Everything else is recoverable with a variant, a call or a crew day.",
      citations: [
        { id: "R-001", label: "Power over supply", source: "Readiness check", kind: "venue" },
        { id: "R-002", label: "Weight over truss", source: "Readiness check", kind: "rig" },
        { id: "R-003", label: "Glare at the front row", source: "Readiness check", kind: "venue" },
        { id: "R-004", label: "Rights expiry", source: "Readiness check", kind: "rights" },
      ],
      links: [link("Readiness board", "/readiness"), link("Show-week brief", "/readiness?brief=1")],
      tool: "readiness.summary",
    };
  }

  return {
    question,
    title: "I can answer from the show records",
    body: `The show is ${pack.project.artist} — ${pack.project.title}, ${pack.project.version}, ${pack.cues.length} cues, ${pack.dates.length} dates. I can check power, weight, glare, rights, the missing clip, the budget, the next show or the drop. I will cite the record and I will not change a cue.`,
    citations: [{ id: pack.project.id, label: `${pack.project.title} · ${pack.project.version}`, source: "Show pack", kind: "asset" }],
    links: [link("Open the show", "/show"), link("Readiness", "/readiness"), link("Agent", "/agent")],
    tool: "agent.fallback",
  };
}
