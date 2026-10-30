import { useMemo, useRef } from "react";
import type { Cue, Pack } from "../types";
import { clamp, energyAt, fmtClock } from "../lib/engine";

const KIND_COLOR: Record<string, string> = {
  LX: "#d7ff4f",
  VID: "#51e0d2",
  STG: "#aab6c4",
  SFX: "#ffb454",
  AUD: "#b18cff",
  CAM: "#7fb3ff",
};

interface Props {
  pack: Pack;
  cues: Cue[];
  time: number;
  onScrub: (time: number) => void;
  height?: number;
  compact?: boolean;
  selectedCue?: string | null;
  onSelectCue?: (id: string) => void;
  onDropLook?: (lookId: string, at: number) => void;
  activeLookId?: string;
}

const W = 1000;

export function Timeline({
  pack,
  cues,
  time,
  onScrub,
  height = 168,
  compact = false,
  selectedCue = null,
  onSelectCue,
  onDropLook,
  activeLookId,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const duration = pack.setlist[pack.setlist.length - 1]?.end ?? 440;
  const H = height;

  const energy = useMemo(() => {
    const samples = 140;
    const pts: [number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * duration;
      const x = (i / samples) * W;
      const y = H - 26 - energyAt(pack, t) * (H * 0.35);
      pts.push([x, y]);
    }
    return pts;
  }, [duration, H, pack]);

  const energyLine = energy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const energyArea = `${energyLine} L${W} ${H - 26} L0 ${H - 26} Z`;

  const toTime = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
  };

  const scrub = (clientX: number) => onScrub(toTime(clientX));

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    scrub(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1) return;
    scrub(e.clientX);
  };
  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onScrub(clamp(time + (e.shiftKey ? 5 : 1), 0, duration));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onScrub(clamp(time - (e.shiftKey ? 5 : 1), 0, duration));
    }
    if (e.key === "Home") {
      e.preventDefault();
      onScrub(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      onScrub(duration);
    }
  };

  const playX = (time / duration) * W;
  const ticks = Array.from({ length: Math.floor(duration / 60) + 1 }).map((_, i) => i * 60);

  const lanes = compact ? [] : ["LX", "VID", "STG", "SFX", "CAM"];
  const laneY = (lane: string) => {
    const base = H * 0.46;
    const gap = (H * 0.4) / Math.max(1, lanes.length);
    return base + lanes.indexOf(lane) * gap + gap / 2;
  };

  return (
    <div className={`timeline${compact ? " compact" : ""}`}>
      <svg
        ref={ref}
        className="timeline-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        tabIndex={0}
        role="slider"
        aria-label="Show timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKey}
        onDragOver={(e) => {
          if (onDropLook) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!onDropLook) return;
          e.preventDefault();
          const lookId = e.dataTransfer.getData("text/plain");
          if (lookId) onDropLook(lookId, toTime(e.clientX));
        }}
      >
        <defs>
          <linearGradient id="energyfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7ff4f" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#d7ff4f" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="#080a09" />

        {/* setlist */}
        {pack.setlist.map((song, i) => {
          const x = (song.start / duration) * W;
          const w = ((song.end - song.start) / duration) * W;
          return (
            <g key={song.id}>
              <rect x={x} y="0" width={w} height={compact ? 18 : 24} fill={i % 2 === 0 ? "#0d100e" : "#0b0e0c"} stroke="#1b201a" strokeWidth="0.6" />
              <text x={x + 6} y={compact ? 12 : 16} fill="#7e8a78" fontSize={compact ? 7 : 9} fontFamily="var(--font-mono)" letterSpacing="0.8">
                {song.title.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* ruler */}
        {!compact && (
          <g>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={(t / duration) * W} y1="24" x2={(t / duration) * W} y2={H - 20} stroke="rgba(255,255,255,.05)" strokeWidth="0.6" />
                <text x={(t / duration) * W + 3} y={H - 8} fill="#566050" fontSize="7.5" fontFamily="var(--font-mono)">{fmtClock(t)}</text>
              </g>
            ))}
            {pack.setlist.slice(1).map((s) => (
              <line key={s.id} x1={(s.start / duration) * W} y1="24" x2={(s.start / duration) * W} y2={H - 20} stroke="rgba(215,255,79,.22)" strokeWidth="0.8" strokeDasharray="3 3" />
            ))}
          </g>
        )}

        {/* energy */}
        <path d={energyArea} fill="url(#energyfill)" />
        <path d={energyLine} fill="none" stroke="#d7ff4f" strokeWidth={compact ? 1.2 : 1.4} opacity="0.65" />

        {/* lanes */}
        {lanes.map((lane) => (
          <g key={lane}>
            <line x1="0" y1={laneY(lane)} x2={W} y2={laneY(lane)} stroke="rgba(255,255,255,.045)" strokeWidth="0.6" />
            <text x="4" y={laneY(lane) - 4} fill="#4e584b" fontSize="7" fontFamily="var(--font-mono)">{lane}</text>
            {cues
              .filter((c) => c.kind === lane)
              .map((c) => {
                const x = (c.at / duration) * W;
                const selected = selectedCue === c.id;
                const color = KIND_COLOR[c.kind] ?? "#d7ff4f";
                return (
                  <g key={c.id} className="cue-mark" onClick={(e) => { e.stopPropagation(); onSelectCue?.(c.id); }} role="button" tabIndex={0}>
                    <title>{`${c.id} · ${fmtClock(c.at)} · ${c.title}`}</title>
                    <line x1={x} y1={laneY(lane) - 8} x2={x} y2={laneY(lane) + 8} stroke={color} strokeWidth={selected ? 2.4 : 1.2} opacity={selected ? 1 : 0.75} />
                    <circle cx={x} cy={laneY(lane)} r={selected ? 3.6 : 2.3} fill={color} />
                    {selected && <circle cx={x} cy={laneY(lane)} r="7" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />}
                  </g>
                );
              })}
          </g>
        ))}

        {/* drop markers */}
        {!compact && (
          <g>
            {pack.cues
              .filter((c) => c.safety)
              .map((c) => (
                <g key={`s-${c.id}`}>
                  <line x1={(c.at / duration) * W} y1="24" x2={(c.at / duration) * W} y2={H - 20} stroke="rgba(255,92,92,.22)" strokeWidth="0.8" strokeDasharray="2 4" />
                  <text x={(c.at / duration) * W + 4} y="38" fill="#ff7a6f" fontSize="7" fontFamily="var(--font-mono)">SAFETY</text>
                </g>
              ))}
            {activeLookId && (
              <text x={playX > W - 160 ? playX - 6 : playX + 6} y={H * 0.42} textAnchor={playX > W - 160 ? "end" : "start"} fill="#8d9a85" fontSize="7.5" fontFamily="var(--font-mono)">
                {pack.looks.find((l) => l.id === activeLookId)?.name ?? ""}
              </text>
            )}
          </g>
        )}

        {/* playhead */}
        <line x1={playX} y1="0" x2={playX} y2={H} stroke="#f5f1e8" strokeWidth="1" opacity="0.9" />
        <path d={`M${playX - 5} 0 L${playX + 5} 0 L${playX} 7 Z`} fill="#f5f1e8" />
      </svg>
      {!compact && (
        <div className="timeline-foot">
          <span className="mono">{fmtClock(time)} / {fmtClock(duration)}</span>
          <span className="timeline-kinds">
            {Object.entries(KIND_COLOR).map(([kind, color]) => (
              <span key={kind}><i style={{ background: color }} /> {kind}</span>
            ))}
          </span>
          <span className="soft">Click or drag to scrub. Drag a look from the rail onto the build.</span>
        </div>
      )}
    </div>
  );
}
