/* Data Sources — catalogue, status, metadata and quality legend. */

import { useEffect, useState } from "react";
import { BookMarked, CloudOff, ShieldCheck } from "lucide-react";
import type { DataSource } from "../types";
import { QUALITY_LEVELS } from "../data/content";
import { getDataSources } from "../services/api";
import SourceCard from "../components/SourceCard";
import { CardSkeleton, Modal, PageHeader } from "../components/ui";
import { cls } from "../lib/utils";

export default function DataSources() {
  const [sources, setSources] = useState<DataSource[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaSource, setMetaSource] = useState<DataSource | null>(null);

  useEffect(() => {
    let active = true;
    getDataSources().then((d) => {
      if (active) {
        setSources(d);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Provenance"
        title="Data Sources"
        subtitle="Understand the origin, reliability, and status of the datasets used in this analysis."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600">
            <BookMarked className="h-3.5 w-3.5 text-teal-600" aria-hidden />
            4 registered datasets · sample mode
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading || !sources
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
                <CardSkeleton lines={7} />
              </div>
            ))
          : sources.map((s) => <SourceCard key={s.id} source={s} onViewMetadata={setMetaSource} />)}
      </div>

      {/* Data quality explanation */}
      <section aria-label="Data quality levels" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-700" aria-hidden>
            <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-semibold text-navy-950">Reading the data-quality labels</h2>
            <p className="text-[12px] text-slate-500">Every value in OceanScope 3D falls into one of four categories.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUALITY_LEVELS.map((q) => (
            <div key={q.key} className="rounded-lg border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-navy-950">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: q.color }} aria-hidden />
                {q.key}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{q.text}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-500">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        Sample mode: record counts and statuses are illustrative. In production, this page is served by the FastAPI catalogue
        endpoint (<code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-navy-800">GET /api/sources</code>) with
        near-real-time dataset health.
      </p>

      {/* Metadata modal */}
      <Modal
        open={!!metaSource}
        onClose={() => setMetaSource(null)}
        title={metaSource ? `${metaSource.name} — Metadata` : "Metadata"}
        subtitle={metaSource?.platform}
      >
        {metaSource && (
          <div>
            <p className="mb-4 text-[12.5px] leading-relaxed text-slate-600">{metaSource.description}</p>
            <dl className="overflow-hidden rounded-lg border border-slate-200">
              {metaSource.metadata.map((m, i) => (
                <div key={m.label} className={cls("grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-[12px]", i % 2 === 0 ? "bg-slate-50/70" : "bg-white")}>
                  <dt className="font-semibold text-slate-500">{m.label}</dt>
                  <dd className="text-navy-900">{m.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">Last update: {metaSource.lastUpdate} · {metaSource.records.toLocaleString("en-IN")} records indexed.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
