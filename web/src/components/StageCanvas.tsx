import { useMemo, useRef, useState } from "react";
import type { Look, Pack, SetPiece, VideoLook } from "../types";
import { fmtClock, performersAt, lookStats, videoAt } from "../lib/engine";
import { Icon } from "./Icon";

type Layer = "all" | "set" | "light" | "video" | "blocking";

interface Props {
  pack: Pack;
  look: Look;
  time: number;
  layer?: Layer;
  showGlare?: boolean;
  showLabels?: boolean;
  selectedFixture?: string | null;
  onSelectFixture?: (id: string | null) => void;
  presenter?: boolean;
}

interface P {
  x: number;
  y: number;
  d: number;
}

interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
}

const PRESETS: Record<string, { label: string; cam: Camera }> = {
  threeQuarter: { label: "Three-quarter", cam: { yaw: -18, pitch: 34, zoom: 1 } },
  audience: { label: "Audience", cam: { yaw: 0, pitch: 10, zoom: 1.02 } },
  plan: { label: "Plan", cam: { yaw: 0, pitch: 78, zoom: 1.08 } },
  side: { label: "Stage left", cam: { yaw: -62, pitch: 24, zoom: 1 } },
};

function projector(cam: Camera) {
  const yaw = (cam.yaw * Math.PI) / 180;
  const pitch = (cam.pitch * Math.PI) / 180;
  const scale = 27.5 * cam.zoom;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  return (x: number, y: number, z: number): P => {
    const dx = x;
    const dy = y - 3.6;
    const dz = z - 2.2;
    const rx = dx * cosY - dy * sinY;
    const ry = dx * sinY + dy * cosY;
    return {
      x: 450 + rx * scale,
      y: 380 - dz * cosP * scale - ry * sinP * scale,
      d: ry,
    };
  };
}

function polygon(points: P[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

interface BoxShape {
  id: string;
  faces: { points: string; fill: string; stroke: string; depth: number }[];
  top: P;
}

function boxFaces(project: (x: number, y: number, z: number) => P, piece: SetPiece): BoxShape {
  const x0 = piece.x - piece.w / 2;
  const x1 = piece.x + piece.w / 2;
  const y0 = piece.y - piece.d / 2;
  const y1 = piece.y + piece.d / 2;
  const z0 = piece.z;
  const z1 = piece.z + piece.h;
  const v = {
    a: project(x0, y0, z0),
    b: project(x1, y0, z0),
    c: project(x1, y1, z0),
    d: project(x0, y1, z0),
    e: project(x0, y0, z1),
    f: project(x1, y0, z1),
    g: project(x1, y1, z1),
    h: project(x0, y1, z1),
  };
  const faces = [
    { points: polygon([v.e, v.f, v.g, v.h]), fill: piece.color, stroke: "rgba(215,255,79,.20)", depth: (v.e.d + v.f.d + v.g.d + v.h.d) / 4 },
    { points: polygon([v.a, v.b, v.f, v.e]), fill: shade(piece.color, 1.16), stroke: "rgba(215,255,79,.13)", depth: (v.a.d + v.b.d + v.f.d + v.e.d) / 4 },
    { points: polygon([v.b, v.c, v.g, v.f]), fill: shade(piece.color, 0.82), stroke: "rgba(255,255,255,.06)", depth: (v.b.d + v.c.d + v.g.d + v.f.d) / 4 },
    { points: polygon([v.d, v.c, v.g, v.h]), fill: shade(piece.color, 0.9), stroke: "rgba(255,255,255,.05)", depth: (v.d.d + v.c.d + v.g.d + v.h.d) / 4 },
  ];
  return { id: piece.id, faces: faces.sort((a, b) => b.depth - a.depth), top: project(piece.x, piece.y, z1) };
}

function shade(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor));
  return `rgb(${r},${g},${b})`;
}

function screenContent(video: VideoLook | undefined, time: number) {
  if (!video) {
    return (
      <g>
        <rect x="286" y="148" width="328" height="136" fill="#0a0d0b" />
        <line x1="286" y1="214" x2="614" y2="214" stroke="#2a3527" strokeWidth="0.8" />
        <text x="450" y="206" textAnchor="middle" fill="#d7ff4f" opacity="0.5" fontSize="12" fontFamily="var(--font-mono)" letterSpacing="8">NIGHT SIGNAL</text>
        <text x="450" y="246" textAnchor="middle" fill="#5f6b58" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="3">NO VIDEO AT THIS CUE</text>
        <circle cx="450" cy="184" r="22" fill="#d7ff4f" opacity="0.06" />
      </g>
    );
  }
  if (video.status === "missing") {
    return (
      <g>
        <rect x="286" y="148" width="328" height="136" fill="#1a0d0d" />
        <text x="450" y="216" textAnchor="middle" fill="#ff7a6f" fontSize="12" fontFamily="var(--font-mono)" letterSpacing="2">MISSING ASSET</text>
        <text x="450" y="234" textAnchor="middle" fill="#7c4a47" fontSize="9" fontFamily="var(--font-mono)">{video.clip}</text>
      </g>
    );
  }
  const pulse = 0.5 + 0.5 * Math.sin(time * (video.id === "vid-bars" ? 8 : 1.4));
  if (video.id === "vid-rain") {
    return (
      <g>
        <rect x="286" y="148" width="328" height="136" fill="#0a1014" />
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={i} x1={292 + i * 18} y1={148 + ((time * 40 + i * 17) % 90)} x2={292 + i * 18} y2={156 + ((time * 40 + i * 17) % 90)} stroke="#6f8ba6" strokeWidth="1" opacity={0.28} />
        ))}
      </g>
    );
  }
  if (video.id === "vid-bars") {
    return (
      <g>
        <rect x="286" y="148" width="328" height="136" fill="#050a09" />
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 20 + ((i * 37) % 90) * (0.5 + pulse * 0.5);
          return <rect key={i} x={292 + i * 13.4} y={276 - h} width="6" height={h} fill={i % 3 === 0 ? "#d7ff4f" : "#51e0d2"} opacity={0.5 + pulse * 0.4} />;
        })}
      </g>
    );
  }
  if (video.id === "vid-afterglow") {
    return (
      <g>
        <rect x="286" y="148" width="328" height="136" fill="#100c07" />
        <circle cx="450" cy="230" r={34 + pulse * 10} fill="#ffb454" opacity={0.4} />
        <circle cx="450" cy="230" r="92" fill="none" stroke="#ffb454" strokeWidth="0.6" opacity={0.25} />
        <line x1="286" y1="248" x2="614" y2="248" stroke="#ffb454" strokeWidth="0.7" opacity={0.4} />
      </g>
    );
  }
  return (
    <g>
      <rect x="286" y="148" width="328" height="136" fill="#f1ede2" />
      <rect x="360" y="172" width="180" height="112" fill="#0a0c0b" />
      <line x1="286" y1="284" x2="614" y2="284" stroke="#0a0c0b" strokeWidth="2" />
      <text x="450" y="294" textAnchor="middle" fill="#0a0c0b" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="3">MONOLITH</text>
    </g>
  );
}

export function StageCanvas({
  pack,
  look,
  time,
  layer = "all",
  showGlare = false,
  showLabels = true,
  selectedFixture = null,
  onSelectFixture,
  presenter = false,
}: Props) {
  const [cam, setCam] = useState<Camera>(PRESETS.threeQuarter.cam);
  const [preset, setPreset] = useState("threeQuarter");
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const project = useMemo(() => projector(cam), [cam]);
  const stats = useMemo(() => lookStats(pack, look), [pack, look]);
  const video = useMemo(() => {
    const id = videoAt(pack, time);
    return id ? pack.videos.find((v) => v.id === id) : undefined;
  }, [pack, time]);
  const performers = useMemo(() => performersAt(pack, time), [pack, time]);

  const active = new Set(look.fixtureIds);
  const show = (kind: "set" | "light" | "video" | "blocking") => layer === "all" || layer === kind;

  const deck = [
    project(-pack.stage.width / 2, 0, 0),
    project(pack.stage.width / 2, 0, 0),
    project(pack.stage.width / 2, pack.stage.depth, 0),
    project(-pack.stage.width / 2, pack.stage.depth, 0),
  ];
  const frontRow = project(0, pack.stage.seats.firstRowY, 0);
  const screen = pack.stage.screen;
  const screenTopLeft = project(screen.x - screen.w / 2, screen.y, screen.z + screen.h);
  const screenTopRight = project(screen.x + screen.w / 2, screen.y, screen.z + screen.h);
  const screenBottomLeft = project(screen.x - screen.w / 2, screen.y, screen.z);
  const screenBottomRight = project(screen.x + screen.w / 2, screen.y, screen.z);

  const boxes = useMemo(
    () => pack.setPieces.filter((p) => p.kind !== "screen").map((p) => boxFaces(project, p)).sort((a, b) => b.top.d - a.top.d),
    [pack.setPieces, project],
  );

  const fixtures = pack.rig.fixtures;

  const beams = useMemo(() => {
    const lit = fixtures.filter((f) => active.has(f.id));
    const audience = new Set<string>();
    lit.slice(0, look.audienceAim).forEach((f) => audience.add(f.id));
    return lit.map((f, i) => {
      const from = project(f.x, f.y, f.z);
      const aim = audience.has(f.id);
      const tx = aim ? f.x * 0.35 : f.x * 0.42;
      const ty = aim ? pack.stage.seats.firstRowY + 0.2 : 4.2;
      const tz = aim ? 1.15 : 1.3;
      const width = aim ? 0.45 : 0.7;
      const t1 = project(tx - width, ty, tz);
      const t2 = project(tx + width, ty, tz);
      return {
        id: f.id,
        points: polygon([from, t1, t2]),
        color: look.palette[i % look.palette.length] ?? "#d7ff4f",
        aim,
        from,
        d: from.d,
      };
    });
  }, [active, fixtures, look.audienceAim, look.palette, pack.stage.seats.firstRowY, project]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setCam({
      yaw: drag.current.yaw + dx * 0.26,
      pitch: Math.max(6, Math.min(82, drag.current.pitch - dy * 0.22)),
      zoom: cam.zoom,
    });
    setPreset("custom");
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const setView = (key: string) => {
    setCam(PRESETS[key].cam);
    setPreset(key);
  };

  return (
    <div className={`stage-canvas${presenter ? " presenter" : ""}`}>
      <div className="stage-canvas-bar">
        <div className="stage-views" role="group" aria-label="Camera">
          {Object.entries(PRESETS).map(([key, value]) => (
            <button key={key} className={preset === key ? "on" : ""} onClick={() => setView(key)}>{value.label}</button>
          ))}
        </div>
        <div className="stage-hud mono">
          <span>{fmtClock(time)}</span>
          <span>{stats.powerKw.toFixed(1)} kW</span>
          <span className={stats.weightPct > 1 ? "bad" : ""}>{stats.frontKg} kg</span>
          <span className={stats.glare > 0.55 ? "bad" : ""}>glare {stats.glare.toFixed(2)}</span>
        </div>
      </div>

      <svg
        className="stage-svg"
        viewBox="0 0 900 620"
        role="img"
        aria-label={`Previz of ${look.name} at ${fmtClock(time)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b221a" />
            <stop offset="55%" stopColor="#10150f" />
            <stop offset="100%" stopColor="#0a0d09" />
          </linearGradient>
          <linearGradient id="backwall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c1012" />
            <stop offset="100%" stopColor="#070909" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d7ff4f" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#d7ff4f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glare" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff5c5c" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff5c5c" stopOpacity="0" />
          </radialGradient>
          <clipPath id="screenclip">
            <polygon points={polygon([screenBottomLeft, screenBottomRight, screenTopRight, screenTopLeft])} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width="900" height="620" fill="#050607" />
        <ellipse cx="450" cy="392" rx="380" ry="160" fill="#0a0d0b" opacity="0.7" />

        {/* audience */}
        {show("blocking") && (
          <g>
            {Array.from({ length: pack.stage.seats.rows }).map((_, r) => {
              const y = pack.stage.seats.firstRowY - r * pack.stage.seats.gap;
              return (
                <g key={r} opacity={r === 0 ? 0.95 : 0.55 - r * 0.03}>
                  {Array.from({ length: pack.stage.seats.perRow }).map((_, c) => {
                    const x = -pack.stage.width / 2 + 0.5 + (c / (pack.stage.seats.perRow - 1)) * (pack.stage.width - 1);
                    const p = project(x, y, 0);
                    return (
                      <circle
                        key={c}
                        cx={p.x}
                        cy={p.y}
                        r={r === 0 ? 2.2 : 1.6}
                        fill={r === 0 ? (showGlare ? "#ff6b62" : "#8f9a82") : "#394238"}
                      />
                    );
                  })}
                </g>
              );
            })}
            <text x={frontRow.x - 150} y={frontRow.y + 3} fill={showGlare ? "#ff7a6f" : "#5f6b60"} fontSize="9" fontFamily="var(--font-mono)">FRONT ROW →</text>
            <text x={frontRow.x + 118} y={frontRow.y + 3} fill="#4b5548" fontSize="8" fontFamily="var(--font-mono)">HOUSE</text>
          </g>
        )}

        {/* stage deck + grid */}
        <polygon points={polygon(deck)} fill="url(#deck)" stroke="rgba(215,255,79,.28)" strokeWidth="1.2" />
        <line
          x1={project(-pack.stage.width / 2, 0, 0).x}
          y1={project(-pack.stage.width / 2, 0, 0).y}
          x2={project(pack.stage.width / 2, 0, 0).x}
          y2={project(pack.stage.width / 2, 0, 0).y}
          stroke="rgba(215,255,79,.5)"
          strokeWidth="1.6"
        />
        <text
          x={project(-pack.stage.width / 2 + 0.4, 0.2, 0).x + 8}
          y={project(-pack.stage.width / 2 + 0.4, 0.2, 0).y - 4}
          fill="#7f8a75"
          fontSize="8"
          fontFamily="var(--font-mono)"
          letterSpacing="1"
        >
          STAGE {pack.stage.width} × {pack.stage.depth} m · TRIM {pack.stage.trim} m
        </text>
        <g opacity="0.55">
          {Array.from({ length: 7 }).map((_, i) => {
            const y = (i + 1) * 2;
            const a = project(-9, y, 0);
            const b = project(9, y, 0);
            return <line key={`y${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,.07)" strokeWidth="0.7" />;
          })}
          {Array.from({ length: 9 }).map((_, i) => {
            const x = -8 + i * 2;
            const a = project(x, 0, 0);
            const b = project(x, 12, 0);
            return <line key={`x${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,.06)" strokeWidth="0.6" />;
          })}
        </g>

        {/* back wall + screen */}
        <polygon
          points={polygon([project(-9, 12, 0), project(9, 12, 0), project(9, 12, 9.4), project(-9, 12, 9.4)])}
          fill="url(#backwall)"
          stroke="rgba(255,255,255,.06)"
        />
        {show("video") && (
          <g>
            <polygon
              points={polygon([screenBottomLeft, screenBottomRight, screenTopRight, screenTopLeft])}
              fill="#060807"
              stroke="rgba(255,255,255,.14)"
              strokeWidth="1"
            />
            {(() => {
              const a = (screenTopRight.x - screenTopLeft.x) / 328;
              const b = (screenTopRight.y - screenTopLeft.y) / 328;
              const c = (screenBottomLeft.x - screenTopLeft.x) / 136;
              const d = (screenBottomLeft.y - screenTopLeft.y) / 136;
              const e = screenTopLeft.x - a * 286 - c * 148;
              const f = screenTopLeft.y - b * 286 - d * 148;
              return (
                <g clipPath="url(#screenclip)">
                  <g transform={`matrix(${a} ${b} ${c} ${d} ${e} ${f})`}>{screenContent(video, time)}</g>
                </g>
              );
            })()}
          </g>
        )}

        {/* set */}
        {show("set") && (
          <g>
            {boxes.map((box) => (
              <g key={box.id}>
                {box.faces.map((face, i) => (
                  <polygon key={i} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth="0.7" />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* beams */}
        {show("light") && (
          <g>
            {beams
              .sort((a, b) => b.d - a.d)
              .map((b) => (
                <g key={b.id}>
                  <polygon points={b.points} fill={b.color} opacity={b.aim ? 0.3 : 0.22} style={{ mixBlendMode: "screen" }} />
                  <polygon points={b.points} fill="none" stroke={b.color} strokeOpacity={0.22} strokeWidth="0.6" />
                </g>
              ))}
          </g>
        )}

        {/* performers */}
        {show("blocking") && (
          <g>
            {performers.map((p) => {
              const foot = project(p.x, p.y, p.z);
              const head = project(p.x, p.y, p.z + (p.role === "artist" ? 1.72 : 1.62));
              const color = p.role === "artist" ? "#d7ff4f" : "#51e0d2";
              return (
                <g key={p.performer}>
                  <ellipse cx={foot.x} cy={foot.y} rx="9" ry="3" fill="#000" opacity="0.5" />
                  <line x1={foot.x} y1={foot.y} x2={head.x} y2={head.y} stroke={color} strokeWidth={p.role === "artist" ? 8 : 6} strokeLinecap="round" opacity="0.85" />
                  <circle cx={head.x} cy={head.y - 3} r={p.role === "artist" ? 5.5 : 4.5} fill={color} />
                  {showLabels && <text x={foot.x + 10} y={foot.y + 2} fill={color} opacity="0.8" fontSize="8" fontFamily="var(--font-mono)">{p.performer.toUpperCase()}</text>}
                </g>
              );
            })}
          </g>
        )}

        {/* trusses */}
        {show("light") && (
          <g>
            {pack.rig.trusses
              .filter((t) => t.capacityKg > 0)
              .map((t) => {
                const a = project(-t.length / 2, t.y, t.z);
                const b = project(t.length / 2, t.y, t.z);
                return (
                  <g key={t.id}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(230,240,220,.36)" strokeWidth="3" strokeLinecap="round" />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#050607" strokeWidth="0.8" strokeDasharray="1 4" />
                    {showLabels && <text x={(a.x + b.x) / 2} y={a.y - 6} textAnchor="middle" fill="#6f7a6f" fontSize="7.5" fontFamily="var(--font-mono)" letterSpacing="1">{t.name.toUpperCase()} · {t.capacityKg} KG</text>}
                  </g>
                );
              })}
          </g>
        )}

        {/* fixtures */}
        {show("light") && (
          <g>
            {fixtures.map((f) => {
              const p = project(f.x, f.y, f.z);
              const lit = active.has(f.id);
              const selected = selectedFixture === f.id;
              const color = lit ? (look.palette[0] ?? "#d7ff4f") : "#5b6458";
              return (
                <g
                  key={f.id}
                  className="fixture-glyph"
                  onPointerEnter={() => onSelectFixture?.(f.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFixture?.(selected ? null : f.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${f.label} ${f.kind} ${lit ? "lit" : "dark"}`}
                >
                  <title>{`${f.label} · ${f.kind} · ${f.watts} W · ${f.weightKg} kg · u${f.universe}/${f.address}`}</title>
                  <rect x={p.x - 4} y={p.y - 4} width="8" height="8" rx="1.5" fill={lit ? color : "#101410"} stroke={selected ? "#f5f1e8" : lit ? color : "#465046"} strokeWidth={selected ? 1.6 : 0.8} transform={`rotate(45 ${p.x} ${p.y})`} opacity={lit ? 0.95 : 0.6} />
                  {selected && <circle cx={p.x} cy={p.y} r="10" fill="none" stroke="#f5f1e8" strokeWidth="1" strokeDasharray="2 2" />}
                </g>
              );
            })}
          </g>
        )}

        {/* camera + crew marks */}
        {show("blocking") && (
          <g opacity="0.85">
            {pack.blocking
              .filter((b) => b.role === "camera" && b.at <= time)
              .slice(-2)
              .map((b) => {
                const p = project(b.x, b.y, b.z);
                return (
                  <g key={b.id}>
                    <polygon points={`${p.x},${p.y - 7} ${p.x - 5},${p.y + 3} ${p.x + 5},${p.y + 3}`} fill="none" stroke="#aab6c4" strokeWidth="1" />
                    <text x={p.x + 7} y={p.y + 3} fill="#aab6c4" fontSize="7" fontFamily="var(--font-mono)">{b.performer.toUpperCase()}</text>
                  </g>
                );
              })}
          </g>
        )}

        {/* glare */}
        {showGlare && look.audienceAim > 0 && (
          <g>
            <ellipse cx={frontRow.x} cy={frontRow.y - 4} rx="160" ry="34" fill="url(#glare)" opacity="0.8" />
            <path d={`M ${project(-3, -3, 1.15).x} ${project(-3, -3, 1.15).y} Q ${frontRow.x} ${frontRow.y - 40} ${project(3, -3, 1.15).x} ${project(3, -3, 1.15).y}`} fill="none" stroke="#ff5c5c" strokeWidth="1.2" strokeDasharray="4 4" />
            <text x={frontRow.x} y={frontRow.y - 42} textAnchor="middle" fill="#ff7a6f" fontSize="10" fontFamily="var(--font-mono)" letterSpacing="1">GLARE {stats.glare.toFixed(2)} · FRONT ROW BLINDED</text>
          </g>
        )}

        {/* floor marks + scale */}
        <g opacity="0.45">
          <line x1="60" y1="584" x2="140" y2="584" stroke="#d7ff4f" strokeWidth="1" />
          <text x="60" y="578" fill="#8a9584" fontSize="8" fontFamily="var(--font-mono)">2 m</text>
          <text x="792" y="584" fill="#5f6b60" fontSize="8" fontFamily="var(--font-mono)" textAnchor="end">CUE · {look.code}</text>
        </g>
      </svg>

      <div className="stage-legend">
        <span><i className="legend-dot accent" /> {look.name}</span>
        <span className="soft">{stats.fixtureCount} fixtures · {stats.powerKw.toFixed(1)} kW · {stats.frontKg} kg front</span>
        <span className="stage-hint"><Icon name="eye" size={12} /> drag to orbit</span>
      </div>
    </div>
  );
}
