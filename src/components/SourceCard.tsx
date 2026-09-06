/* Data-source catalogue card for the Data Sources page. */

import { CalendarClock, Database, Download, FileSpreadsheet, FileText, Layers, Map as MapIcon } from "lucide-react";
import type { DataSource } from "../types";
import { cls, downloadCSV } from "../lib/utils";

export default function SourceCard({ source, onViewMetadata }: { source: DataSource; onViewMetadata: (s: DataSource) => void }) {
  const downloadSample = () => {
    downloadCSV(
      `${source.id}_sample_metadata.csv`,
      ["field", "value"],
      [
        ["dataset", source.name],
        ["type", source.type],
        ["format", source.format],
        ["variables", source.variables.join("; ")],
        ["update_frequency", source.updateFrequency],
        ["platform", source.platform],
        ["records", source.records],
        ["last_update", source.lastUpdate],
        ["spatial_coverage", source.coverage],
        ["quality_control", source.qcLabel],
      ]
    );
  };

  return (
    <article className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cls(
              "flex h-9 w-9 items-center justify-center rounded-md",
              source.type === "Model Output" ? "bg-ocean-50 text-ocean-700" : "bg-teal-50 text-teal-700"
            )}
            aria-hidden
          >
            {source.type === "Model Output" ? <Layers className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Database className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-navy-950">{source.name}</h3>
            <p className="text-[11.5px] text-slate-500">{source.platform}</p>
          </div>
        </div>
        <span
          className={cls(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
            source.status === "operational" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          <span className="relative flex h-1.5 w-1.5">
            {source.status === "operational" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" aria-hidden />
            )}
            <span className={cls("relative inline-flex h-1.5 w-1.5 rounded-full", source.status === "operational" ? "bg-emerald-500" : "bg-amber-500")} />
          </span>
          {source.status === "operational" ? "Operational" : "Delayed"}
        </span>
      </div>

      <div className="flex-1 px-4 py-3.5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
          <Field label="Type" value={source.type} />
          <Field label="Format" value={source.format} icon={<FileSpreadsheet className="h-3 w-3" />} />
          <Field label="Records" value={source.records.toLocaleString("en-IN")} />
          <Field label="Update" value={source.updateFrequency} icon={<CalendarClock className="h-3 w-3" />} />
        </dl>
        <div className="mt-3 space-y-2 text-[12px]">
          <p className="flex items-start gap-1.5 text-slate-600">
            <MapIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>{source.coverage}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {source.variables.map((v) => (
              <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {v}
              </span>
            ))}
          </div>
          <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">QC:</span> {source.qcLabel}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <button
          onClick={downloadSample}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Sample data
        </button>
        <button
          onClick={() => onViewMetadata(source)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-navy-800 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-1"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          View metadata
        </button>
      </div>
    </article>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-navy-900">{value}</dd>
    </div>
  );
}
