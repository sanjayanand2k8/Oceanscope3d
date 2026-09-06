/* Right-hand contextual panel for the Ocean Explorer map. */

import { BarChart3, Download, Info, MapPin, MousePointerClick, Pin, PinOff, ShieldCheck, X } from "lucide-react";
import type { StationSnapshot } from "../types";
import { snapshotNarrative, variableByKey } from "../data/ocean";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import { CardSkeleton } from "./ui";
import { cls, downloadCSV, fmtLat, fmtLon, signed } from "../lib/utils";

export default function ObservationDetailPanel({
  snapshot,
  loading,
  onClose,
  onViewComparison,
  onTogglePin,
  isPinned,
}: {
  snapshot: StationSnapshot | null;
  loading: boolean;
  onClose: () => void;
  onViewComparison: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
}) {
  return (
    <aside aria-label="Station details" className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
      {loading ? (
        <div className="p-5">
          <CardSkeleton lines={6} />
        </div>
      ) : !snapshot ? (
        <div className="flex-1 p-4">
          <EmptyState
            icon={MousePointerClick}
            title="Explore a data point"
            body="Click any station marker or grid area on the map to inspect model and observed ocean conditions at that location."
          />
          <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Info className="h-3 w-3" aria-hidden /> Marker legend
            </p>
            <ul className="space-y-1.5 text-[12px] text-slate-600">
              <li className="flex items-center gap-2"><MarkerGlyph shape="circle" /> Moored buoy</li>
              <li className="flex items-center gap-2"><MarkerGlyph shape="diamond" /> Argo float</li>
              <li className="flex items-center gap-2"><MarkerGlyph shape="triangle" /> Ship observation</li>
              <li className="flex items-center gap-2"><MarkerGlyph shape="square" /> Moored array</li>
            </ul>
          </div>
        </div>
      ) : (
        <PanelBody
          snapshot={snapshot}
          onClose={onClose}
          onViewComparison={onViewComparison}
          onTogglePin={onTogglePin}
          isPinned={isPinned}
        />
      )}
    </aside>
  );
}

function MarkerGlyph({ shape }: { shape: "circle" | "diamond" | "triangle" | "square" }) {
  const style = { background: "#14B8A6", border: "2px solid #fff", boxShadow: "0 0 0 1px #0F766E" };
  if (shape === "circle") return <span className="h-3 w-3 rounded-full" style={style} aria-hidden />;
  if (shape === "diamond") return <span className="h-3 w-3 rotate-45 rounded-[2px]" style={style} aria-hidden />;
  if (shape === "triangle")
    return <span className="inline-block h-0 w-0 border-x-[6px] border-b-[9px] border-x-transparent border-b-teal-500" aria-hidden />;
  return <span className="h-3 w-3 rounded-[2px]" style={style} aria-hidden />;
}

function PanelBody({
  snapshot,
  onClose,
  onViewComparison,
  onTogglePin,
  isPinned,
}: {
  snapshot: StationSnapshot;
  onClose: () => void;
  onViewComparison: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
}) {
  const def = variableByKey(snapshot.variable);
  const { station } = snapshot;

  const exportPoint = () => {
    downloadCSV(
      `${station.id}_${snapshot.variable}_${snapshot.depth}m_${snapshot.date.replace(" ", "-")}.csv`,
      ["field", "value"],
      [
        ["station_id", station.id],
        ["platform", station.platform],
        ["date", snapshot.date],
        ["time", snapshot.timeUTC],
        ["latitude_deg", station.lat],
        ["longitude_deg", station.lon],
        ["depth_m", snapshot.depth],
        ["variable", def.label],
        ["observed", snapshot.observed],
        ["model", snapshot.model],
        ["difference_model_minus_observed", snapshot.diff],
        ["agreement_status", snapshot.status],
      ]
    );
  };

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div>
          <h3 className="text-[14px] font-bold text-navy-950">{station.id}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{station.name} · {station.platform}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Clear selection"
          title="Clear selection"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge level={snapshot.status} />
          <span
            className={cls(
              "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-semibold",
              station.qc === "passed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            <ShieldCheck className="h-3 w-3" aria-hidden />
            QC {station.qc === "passed" ? "passed" : "flagged"}
          </span>
        </div>

        {snapshot.availabilityNote && (
          <p className="mt-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11.5px] leading-snug text-indigo-800">
            {snapshot.availabilityNote}
          </p>
        )}

        <dl className="mt-4 space-y-0 rounded-lg border border-slate-200 text-[12.5px]">
          <Row label="Date & time" value={`${snapshot.date} 2026 · ${snapshot.timeUTC}`} />
          <Row label="Location" value={`${fmtLat(station.lat)}, ${fmtLon(station.lon)}`} icon />
          <Row label="Depth" value={snapshot.depth === 0 ? "Surface (0 m)" : `${snapshot.depth} m`} />
          <Row label={def.label} value={def.unit} muted />
          <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200">
            <div className="px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Model</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ocean-700">{snapshot.model.toFixed(def.decimals)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Observed</p>
              <p className="mt-0.5 font-semibold tabular-nums text-teal-700">{snapshot.observed.toFixed(def.decimals)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Difference</p>
              <p className="mt-0.5 font-semibold tabular-nums text-navy-900">{signed(snapshot.diff, def.decimals)}</p>
            </div>
          </div>
        </dl>

        <div className="mt-3 rounded-lg border-l-[3px] border-slate-300 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">What this means</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-700">{snapshotNarrative(snapshot.variable, snapshot.diff, snapshot.depth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
        <button
          onClick={onViewComparison}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-navy-800 px-2 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-1"
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Compare
        </button>
        <button
          onClick={onTogglePin}
          className={cls(
            "inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-1",
            isPinned ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
          {isPinned ? "Pinned" : "Pin"}
        </button>
        <button
          onClick={exportPoint}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-1"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export
        </button>
      </div>
    </>
  );
}

function Row({ label, value, muted = false, icon = false }: { label: string; value: string; muted?: boolean; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-100">
      <dt className="flex items-center gap-1.5 text-slate-500">
        {icon && <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
        {label}
      </dt>
      <dd className={`font-medium tabular-nums ${muted ? "text-slate-400" : "text-navy-900"}`}>{value}</dd>
    </div>
  );
}
