/* ------------------------------------------------------------------ */
/* OceanMap — interactive SVG map of the North Indian Ocean.           */
/*                                                                     */
/* Renders a stylised coastline, lat/lon graticule, a simulated model  */
/* heat field, in-situ station markers (circle = buoy, diamond = Argo, */
/* triangle = ship, square = moored array) and current-flow arrows.    */
/* No external / paid map provider is used.                            */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Layers, Maximize2, Minus, Plus } from "lucide-react";
import type { Depth, SourceMode, Station, VariableKey, RegionKey } from "../types";
import {
  ANDAMANS,
  ATOLLS,
  MAINLAND,
  MAP_EXTENT,
  PLATFORM_STYLE,
  SRI_LANKA,
  STATUS_META,
  SUMATRA,
  currentDirection,
  fieldValue,
  isLand,
  modelValue,
  noise,
  observedValue,
  paletteColor,
  regionByKey,
  stationsInRegion,
  statusFor,
  valueColor,
  variableByKey,
  STATIONS,
} from "../data/ocean";
import { LegendScale } from "./ui";
import { cls, fmtLat, fmtLon } from "../lib/utils";

const W = 1000;
const H = 560;
const PX = 20; // svg units per degree

function project(lon: number, lat: number): [number, number] {
  return [(lon - MAP_EXTENT.lonMin) * PX, (MAP_EXTENT.latMax - lat) * PX];
}
function polyPath(pts: [number, number][]): string {
  return pts.map(([lon, lat], i) => `${i === 0 ? "M" : "L"}${project(lon, lat).join(" ")}`).join(" ") + " Z";
}

interface OceanMapProps {
  region: RegionKey;
  variable: VariableKey;
  depth: Depth;
  day: number;
  source: SourceMode;
  dateLabel: string;
  selectedId: string | null;
  onSelect: (station: Station | null) => void;
  reducedMotion?: boolean;
}

export default function OceanMap({
  region,
  variable,
  depth,
  day,
  source,
  dateLabel,
  selectedId,
  onSelect,
  reducedMotion = false,
}: OceanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [hoverStation, setHoverStation] = useState<Station | null>(null);
  const [cursorLL, setCursorLL] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState({ field: true, stations: true, graticule: true, currents: true });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const def = variableByKey(variable);
  const [domMin, domMax] = def.domain(depth);
  const regionObj = regionByKey(region);

  /* ----- simulated model raster ----- */
  const cells = useMemo(() => {
    const step = 1.05;
    const out: { x: number; y: number; color: string; key: string }[] = [];
    for (let lon = MAP_EXTENT.lonMin; lon < MAP_EXTENT.lonMax; lon += step) {
      for (let lat = MAP_EXTENT.latMin; lat < MAP_EXTENT.latMax; lat += step) {
        const cLon = lon + step / 2;
        const cLat = lat + step / 2;
        if (isLand(cLon, cLat)) continue;
        const v = fieldValue(variable, cLon, cLat, depth, day) + noise(`cell|${variable}|${depth}|${cLon}|${cLat}`, 0.12);
        const [x, y] = project(lon, lat);
        out.push({ x, y, color: valueColor(variable, v, depth), key: `${lon.toFixed(1)}|${lat.toFixed(1)}` });
      }
    }
    return out;
  }, [variable, depth, day]);

  /* ----- current arrows ----- */
  const arrows = useMemo(() => {
    if (variable !== "current") return [];
    const step = 2.7;
    const out: { x: number; y: number; dir: number; color: string; scale: number; key: string }[] = [];
    for (let lon = MAP_EXTENT.lonMin + 1; lon < MAP_EXTENT.lonMax; lon += step) {
      for (let lat = MAP_EXTENT.latMin + 1; lat < MAP_EXTENT.latMax; lat += step) {
        if (isLand(lon, lat)) continue;
        const speed = fieldValue("current", lon, lat, depth, day);
        const [x, y] = project(lon, lat);
        out.push({
          x,
          y,
          dir: currentDirection(lon, lat, day),
          color: paletteColor(def.palette, 0.35 + (speed / 1.5) * 0.65),
          scale: 0.55 + (speed / 1.5) * 0.8,
          key: `${lon}|${lat}`,
        });
      }
    }
    return out;
  }, [variable, depth, day, def.palette]);

  const regionStations = useMemo(() => stationsInRegion(region), [region]);

  /* ----- viewport transforms ----- */
  const fitToRegion = (r: RegionKey) => {
    const b = regionByKey(r).bbox;
    const [x1, y2] = project(b.lonMin, b.latMin);
    const [x2, y1] = project(b.lonMax, b.latMax);
    const bw = x2 - x1;
    const bh = y2 - y1;
    const k = Math.min(W / bw, H / bh) * 0.88;
    const clampedK = Math.min(Math.max(k, 0.9), 3.4);
    setView({ k: clampedK, tx: W / 2 - (x1 + bw / 2) * clampedK, ty: H / 2 - (y1 + bh / 2) * clampedK });
  };

  useEffect(() => {
    fitToRegion(region);
  }, [region]);

  const zoomBy = (factor: number) => {
    setView((v) => {
      const k2 = Math.min(Math.max(v.k * factor, 0.85), 5.5);
      const ratio = k2 / v.k;
      return { k: k2, tx: W / 2 - (W / 2 - v.tx) * ratio, ty: H / 2 - (H / 2 - v.ty) * ratio };
    });
  };

  /* ----- pan via pointer drag ----- */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && !drag.current) {
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const lon = (x - view.tx) / view.k / PX + MAP_EXTENT.lonMin;
      const lat = MAP_EXTENT.latMax - (y - view.ty) / view.k / PX;
      if (lon >= MAP_EXTENT.lonMin && lon <= MAP_EXTENT.lonMax && lat >= MAP_EXTENT.latMin && lat <= MAP_EXTENT.latMax) {
        setCursorLL([lon, lat]);
      } else setCursorLL(null);
    }
    if (drag.current && rect) {
      const scale = W / rect.width;
      setView((v) => ({
        ...v,
        tx: drag.current!.tx + (e.clientX - drag.current!.x) * scale,
        ty: drag.current!.ty + (e.clientY - drag.current!.y) * scale,
      }));
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* fullscreen unsupported — keep embedded view */
    }
  };
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const lonLines = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const latLines = [0, 5, 10, 15, 20, 25];

  const fieldOpacity = source === "obs" ? 0 : source === "compare" ? 0.45 : 0.66;

  return (
    <div
      ref={containerRef}
      className={cls("relative h-full w-full overflow-hidden bg-navy-850 select-none", isFullscreen && "bg-navy-900")}
      style={{ borderRadius: "inherit" }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cls("absolute inset-0 h-full w-full", drag.current ? "cursor-grabbing" : "cursor-grab")}
        role="application"
        aria-label={`Interactive map of the North Indian Ocean showing ${def.label} at ${depth === 0 ? "the surface" : depth + " m"} on ${dateLabel}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          onPointerUp();
          setCursorLL(null);
          setHoverStation(null);
        }}
        onDoubleClick={() => zoomBy(1.35)}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).tagName === "rect") onSelect(null);
        }}
      >
        <defs>
          <path id="current-arrow" d="M0 -7 L4.6 5.4 L0 2.8 L-4.6 5.4 Z" />
        </defs>

        {/* sea background */}
        <rect x={0} y={0} width={W} height={H} fill="#0C2C4E" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* graticule */}
          {layers.graticule && (
            <g stroke="rgba(159,196,231,0.16)" strokeWidth={1} vectorEffect="non-scaling-stroke">
              {lonLines.map((lon) => {
                const [x] = project(lon, 0);
                return <line key={lon} x1={x} y1={0} x2={x} y2={H} />;
              })}
              {latLines.map((lat) => {
                const [, y] = project(50, lat);
                return <line key={lat} x1={0} y1={y} x2={W} y2={y} />;
              })}
            </g>
          )}

          {/* land */}
          <g>
            <path d={polyPath(MAINLAND)} fill="#DBE2EA" stroke="#9FB0C2" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
            <path d={polyPath(SUMATRA)} fill="#DBE2EA" stroke="#9FB0C2" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={polyPath(SRI_LANKA)} fill="#DFE5EC" stroke="#9FB0C2" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {ANDAMANS.map(([cx, cy, rx, ry], i) => {
              const [x, y] = project(cx, cy);
              return <ellipse key={i} cx={x} cy={y} rx={rx * PX} ry={ry * PX} fill="#DFE5EC" stroke="#9FB0C2" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
            {ATOLLS.map(([ax, ay], i) => {
              const [x, y] = project(ax, ay);
              return <circle key={i} cx={x} cy={y} r={2.1} fill="#DFE5EC" />;
            })}
          </g>

          {/* sea + land labels */}
          <g fontFamily="Inter, system-ui, sans-serif" pointerEvents="none">
            <text x={project(61.5, 14)[0]} y={project(61.5, 14)[1]} fill="rgba(146,187,226,0.55)" fontSize={13} fontWeight={600} letterSpacing="0.38em">ARABIAN SEA</text>
            <text x={project(84.2, 11.2)[0]} y={project(84.2, 11.2)[1]} fill="rgba(146,187,226,0.55)" fontSize={13} fontWeight={600} letterSpacing="0.38em">BAY OF BENGAL</text>
            <text x={project(63.5, 1.6)[0]} y={project(63.5, 1.6)[1]} fill="rgba(146,187,226,0.5)" fontSize={12} fontWeight={600} letterSpacing="0.34em">INDIAN OCEAN</text>
            <text
              x={project(96.6, 11.4)[0]} y={project(96.6, 11.4)[1]}
              fill="rgba(146,187,226,0.5)" fontSize={10.5} fontWeight={600} letterSpacing="0.3em"
              transform={`rotate(-90 ${project(96.6, 11.4)[0]} ${project(96.6, 11.4)[1]})`}
            >ANDAMAN SEA</text>
            <text x={project(76.3, 19.5)[0]} y={project(76.3, 19.5)[1]} fill="#8794A5" fontSize={15} fontWeight={700} letterSpacing="0.42em">INDIA</text>
            <text x={project(81.9, 6.2)[0]} y={project(81.9, 6.2)[1]} fill="#8794A5" fontSize={8.5} fontWeight={600} letterSpacing="0.08em">SRI LANKA</text>
            <text x={project(94.35, 5.2)[0]} y={project(94.35, 5.2)[1]} fill="rgba(146,187,226,0.55)" fontSize={7.5} fontWeight={600} letterSpacing="0.06em">ANDAMAN &amp; NICOBAR ISLANDS</text>
          </g>

          {/* model field raster */}
          {layers.field && fieldOpacity > 0 && (
            <g pointerEvents="none" opacity={fieldOpacity}>
              {cells.map((c) => (
                <rect key={c.key} x={c.x + 0.6} y={c.y + 0.6} width={PX * 1.05 - 1.4} height={PX * 1.05 - 1.4} rx={2.5} fill={c.color} />
              ))}
            </g>
          )}

          {/* current flow arrows */}
          {layers.currents && variable === "current" && (
            <g pointerEvents="none" opacity={0.9}>
              {arrows.map((a) => (
                <use key={a.key} href="#current-arrow" transform={`translate(${a.x} ${a.y}) rotate(${a.dir}) scale(${a.scale})`} fill={a.color} />
              ))}
            </g>
          )}

          {/* active region outline */}
          <RegionOutline region={region} />

          {/* station markers */}
          {layers.stations &&
            STATIONS.map((s) => {
              const inRegion = regionStations.some((r) => r.id === s.id);
              const style = PLATFORM_STYLE[s.platform];
              const [x, y] = project(s.lon, s.lat);
              const obs = observedValue(s, variable, s.depths.includes(depth) ? depth : s.depths[s.depths.length - 1], day);
              const mdl = modelValue(s, variable, s.depths.includes(depth) ? depth : s.depths[s.depths.length - 1], day);
              const status = statusFor(variable, mdl - obs);
              const fill =
                source === "compare"
                  ? STATUS_META[status].color
                  : source === "obs"
                    ? valueColor(variable, obs, depth)
                    : inRegion
                      ? "#122B4A"
                      : "#173A60";
              const selected = selectedId === s.id;
              const dim = !inRegion;
              return (
                <g
                  key={s.id}
                  transform={`translate(${x} ${y}) scale(${selected ? 1.25 / Math.sqrt(view.k) : 1 / Math.sqrt(view.k)})`}
                  opacity={dim ? 0.4 : 1}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(s);
                  }}
                  onMouseEnter={() => !dim && setHoverStation(s)}
                  onMouseLeave={() => setHoverStation(null)}
                  role="button"
                  aria-label={`Station ${s.id}, ${s.platform}`}
                  tabIndex={dim ? -1 : 0}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !dim) {
                      e.preventDefault();
                      onSelect(s);
                    }
                  }}
                >
                  {selected && (
                    <circle
                      r={13}
                      fill="none"
                      stroke="#0A2540"
                      strokeWidth={2.4}
                      strokeDasharray="3 3"
                      className={reducedMotion ? "" : "animate-[spin_9s_linear_infinite]"}
                    />
                  )}
                  <circle r={9.5} fill="transparent" />
                  {style.marker === "circle" && <circle r={6} fill={fill} stroke="#fff" strokeWidth={1.8} />}
                  {style.marker === "diamond" && <path d="M0 -7 L7 0 L0 7 L-7 0 Z" fill={fill} stroke="#fff" strokeWidth={1.8} />}
                  {style.marker === "triangle" && <path d="M0 -7.4 L6.6 5.6 L-6.6 5.6 Z" fill={fill} stroke="#fff" strokeWidth={1.8} />}
                  {style.marker === "square" && <rect x={-5.4} y={-5.4} width={10.8} height={10.8} rx={1.5} fill={fill} stroke="#fff" strokeWidth={1.8} />}
                </g>
              );
            })}
        </g>

        {/* lat/lon edge labels (fixed overlay) */}
        {layers.graticule && (
          <g fontFamily="Inter, system-ui, sans-serif" fontSize={10} fill="rgba(190,214,240,0.8)" pointerEvents="none">
            {[60, 70, 80, 90].map((lon) => {
              const x = (lon - MAP_EXTENT.lonMin) * PX * view.k + view.tx;
              if (x < 10 || x > W - 10) return null;
              return (
                <text key={lon} x={x} y={H - 8} textAnchor="middle">
                  {lon}°E
                </text>
              );
            })}
            {[5, 10, 15, 20].map((lat) => {
              const y = (MAP_EXTENT.latMax - lat) * PX * view.k + view.ty;
              if (y < 12 || y > H - 12) return null;
              return (
                <text key={lat} x={6} y={y + 3}>
                  {lat}°N
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {/* top-left context chip */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-navy-950/70 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
          {def.short} · {depth === 0 ? "Surface (0 m)" : `${depth} m`} · {dateLabel}
        </span>
        <span className="rounded-md bg-navy-950/70 px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-slate-300 backdrop-blur-sm">
          {regionObj.label}
        </span>
      </div>

      {/* map controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <MapButton label="Zoom in" onClick={() => zoomBy(1.35)}>
          <Plus className="h-4 w-4" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.35)}>
          <Minus className="h-4 w-4" />
        </MapButton>
        <MapButton label={isFullscreen ? "Exit fullscreen" : "View fullscreen"} onClick={toggleFullscreen}>
          <Maximize2 className="h-4 w-4" />
        </MapButton>
        <div className="relative">
          <MapButton label="Toggle map layers" onClick={() => setLayersOpen((o) => !o)} active={layersOpen}>
            <Layers className="h-4 w-4" />
          </MapButton>
          {layersOpen && (
            <div className="absolute right-10 top-0 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Map layers</p>
              {(
                [
                  ["field", "Model field"],
                  ["stations", "Stations"],
                  ["graticule", "Lat / lon grid"],
                  ["currents", "Current arrows"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-ocean-600 accent-ocean-600 focus-visible:ring-2 focus-visible:ring-ocean-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        <MapButton label="Locate selected region" onClick={() => fitToRegion(region)}>
          <Crosshair className="h-4 w-4" />
        </MapButton>
      </div>

      {/* hover tooltip */}
      {hoverStation && (
        <StationTooltip station={hoverStation} variable={variable} depth={depth} day={day} view={view} source={source} />
      )}

      {/* bottom overlays */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
        <div className="rounded-md bg-navy-950/70 px-3 py-2 backdrop-blur-sm">
          {source === "compare" ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300/90">Model–obs agreement</p>
              <div className="flex items-center gap-3">
                {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-[10.5px] text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30" style={{ background: STATUS_META[k].color }} />
                    {STATUS_META[k].short}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <LegendScale
              palette={def.palette}
              unit={def.unit}
              minLabel={`${domMin}`}
              maxLabel={`${domMax}`}
              label={source === "obs" ? `${def.short} observed` : `${def.short} modelled`}
            />
          )}
        </div>
        <div className="hidden rounded-md bg-navy-950/70 px-3 py-2 text-[10px] leading-relaxed text-slate-300 backdrop-blur-sm sm:block">
          {cursorLL ? (
            <p className="tabular-nums">
              {fmtLat(cursorLL[1])} · {fmtLon(cursorLL[0])}
            </p>
          ) : (
            <p>Simulated grid · INCOIS-style 1/12°</p>
          )}
          <p className="text-slate-400/90">Illustrative coastline — not for navigation</p>
        </div>
      </div>
    </div>
  );
}

function MapButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cls(
        "flex h-9 w-9 items-center justify-center rounded-md border shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400",
        active ? "border-ocean-300 bg-ocean-50 text-ocean-700" : "border-slate-200/90 bg-white text-navy-800 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function RegionOutline({ region }: { region: RegionKey }) {
  const b = regionByKey(region).bbox;
  const [x1, y2] = project(b.lonMin, b.latMin);
  const [x2, y1] = project(b.lonMax, b.latMax);
  return (
    <rect
      x={x1}
      y={y1}
      width={x2 - x1}
      height={y2 - y1}
      fill="none"
      stroke="#2DD4BF"
      strokeOpacity={0.65}
      strokeWidth={1.6}
      strokeDasharray="7 5"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      rx={4}
    />
  );
}

function StationTooltip({
  station,
  variable,
  depth,
  day,
  view,
  source,
}: {
  station: Station;
  variable: VariableKey;
  depth: Depth;
  day: number;
  view: { k: number; tx: number; ty: number };
  source: SourceMode;
}) {
  const def = variableByKey(variable);
  const effDepth = station.depths.includes(depth) ? depth : station.depths[station.depths.length - 1];
  const obs = observedValue(station, variable, effDepth, day);
  const mdl = modelValue(station, variable, effDepth, day);
  const status = statusFor(variable, mdl - obs);
  const [px, py] = project(station.lon, station.lat);
  const left = ((px * view.k + view.tx) / W) * 100;
  const top = ((py * view.k + view.ty) / H) * 100;
  return (
    <div
      className="pointer-events-none absolute z-30 w-52 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
      style={{ left: `${Math.min(Math.max(left, 14), 86)}%`, top: `max(${top}%, 24%)`, transform: "translate(-50%, -118%)" }}
      role="tooltip"
    >
      <p className="text-[12px] font-bold text-navy-900">{station.id}</p>
      <p className="text-[11px] text-slate-500">{station.platform} · {station.name}</p>
      <div className="mt-2 space-y-1 border-t border-dashed border-slate-200 pt-2 text-[11px] tabular-nums">
        {source !== "obs" && (
          <p className="flex justify-between"><span className="text-slate-500">Model</span><span className="font-semibold text-ocean-700">{mdl.toFixed(def.decimals)} {def.unit}</span></p>
        )}
        <p className="flex justify-between"><span className="text-slate-500">Observed</span><span className="font-semibold text-teal-700">{obs.toFixed(def.decimals)} {def.unit}</span></p>
        {source === "compare" && (
          <p className="flex justify-between">
            <span className="text-slate-500">Difference</span>
            <span className="font-semibold" style={{ color: STATUS_META[status].color }}>
              {(mdl - obs >= 0 ? "+" : "−") + Math.abs(mdl - obs).toFixed(def.decimals)} {def.unit}
            </span>
          </p>
        )}
      </div>
      <p className="mt-2 text-[10.5px] text-slate-400">Click for full details</p>
    </div>
  );
}
