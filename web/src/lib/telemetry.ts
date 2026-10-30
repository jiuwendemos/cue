/**
 * Local-only demo instrumentation.
 *
 * The question is "which moments create the manager reaction?", so the events
 * are time-stamped and nothing leaves the browser. No user id, no network, no
 * third party. Delete them from the manager brief at any time.
 */

export interface DemoEvent {
  at: number;
  name: string;
  detail?: string;
}

const KEY = "cue-demo-events-v2";
const CAP = 300;

function read(): DemoEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoEvent[];
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e?.at === "number" && typeof e?.name === "string") : [];
  } catch {
    return [];
  }
}

export function track(name: string, detail?: string): void {
  try {
    const events = read();
    events.push({ at: Date.now(), name, detail });
    localStorage.setItem(KEY, JSON.stringify(events.slice(-CAP)));
  } catch {
    /* private mode: the demo still runs */
  }
}

export function readEvents(): DemoEvent[] {
  return read();
}

export function clearEvents(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export interface DemoSummary {
  events: DemoEvent[];
  count: number;
  firstAt: number | null;
  lastAt: number | null;
  timeToFirstTouchMs: number | null;
  timeToVoteMs: number | null;
  stageSeconds: number | null;
  reached: {
    start: boolean;
    touch: boolean;
    reject: boolean;
    vote: boolean;
    finish: boolean;
    sheet: boolean;
  };
}

function at(events: DemoEvent[], name: string): number | null {
  return events.find((e) => e.name === name)?.at ?? null;
}

export function demoSummary(): DemoSummary {
  const events = read();
  const firstAt = events[0]?.at ?? null;
  const lastAt = events[events.length - 1]?.at ?? null;
  const start = at(events, "stage.start");
  const touch = at(events, "stage.touch");
  const vote = at(events, "stage.vote");
  const finish = at(events, "stage.finish");
  return {
    events,
    count: events.length,
    firstAt,
    lastAt,
    timeToFirstTouchMs: touch && start ? Math.max(0, touch - start) : null,
    timeToVoteMs: vote && start ? Math.max(0, vote - start) : null,
    stageSeconds: finish && start ? Math.round((finish - start) / 100) / 10 : null,
    reached: {
      start: Boolean(start),
      touch: Boolean(touch),
      reject: Boolean(at(events, "stage.reject")),
      vote: Boolean(vote),
      finish: Boolean(finish),
      sheet: Boolean(at(events, "stage.sheet")),
    },
  };
}
