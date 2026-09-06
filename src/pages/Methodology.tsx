/* Methodology — how the pipeline aligns, compares and visualises data. */

import {
  ArrowDown,
  Boxes,
  ClipboardList,
  Cpu,
  Database,
  FileCode2,
  FlaskConical,
  GitCompareArrows,
  Scale,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import { METHODOLOGY_STEPS } from "../data/content";
import { PageHeader } from "../components/ui";

const STEP_ICONS: LucideIcon[] = [Database, Scale, GitCompareArrows, Sigma, ClipboardList];

const FORMULAS = [
  {
    name: "Difference",
    formula: "d = Model − Observed",
    plain: "The signed gap at one matched pair. Negative means the model reads low; positive means it reads high.",
  },
  {
    name: "MAE — Mean Absolute Error",
    formula: "MAE = (1/n) · Σ |Model − Observed|",
    plain: "The typical size of the error, ignoring direction. An MAE of 0.6 °C means the model is usually within about half a degree.",
  },
  {
    name: "RMSE — Root Mean Square Error",
    formula: "RMSE = √[ (1/n) · Σ (Model − Observed)² ]",
    plain: "Like MAE, but big mistakes are penalised more. When RMSE is much larger than MAE, a few large errors dominate.",
  },
  {
    name: "Mean Bias",
    formula: "Bias = (1/n) · Σ (Model − Observed)",
    plain: "The average signed error — it exposes a systematic warm/cool or salty/fresh tendency in the model.",
  },
];

const ARCHITECTURE: { icon: LucideIcon; title: string; sub: string; tone: string }[] = [
  { icon: FileCode2, title: "React + TypeScript Frontend", sub: "This application — visualization, filters, export", tone: "border-ocean-200 bg-ocean-50/70 text-ocean-800" },
  { icon: Cpu, title: "FastAPI Backend on Replit", sub: "REST API · request validation · caching · auth ready", tone: "border-teal-200 bg-teal-50/70 text-teal-800" },
  { icon: FlaskConical, title: "Python Processing Layer", sub: "xarray, pandas, NumPy — gridding, matching, scoring", tone: "border-indigo-200 bg-indigo-50/70 text-indigo-800" },
  { icon: Database, title: "Scientific Datasets", sub: "NetCDF model output + CSV / NetCDF in-situ observations", tone: "border-slate-300 bg-slate-100/80 text-slate-700" },
];

export default function Methodology() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Methods"
        title="Methodology"
        subtitle="How OceanScope 3D aligns, compares, and visualizes diverse ocean datasets — transparently, so every number on screen can be traced back to a measurement."
      />

      {/* Steps */}
      <ol className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-5" aria-label="Processing steps">
        {METHODOLOGY_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[i];
          return (
            <li key={s.step} className="relative flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800 text-white" aria-hidden>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <span className="font-display text-[22px] font-semibold text-slate-200">0{s.step}</span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Step {s.step} · {s.title}</p>
              <h3 className="mt-1 text-[13.5px] font-bold leading-snug text-navy-950">{s.headline}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{s.body}</p>
            </li>
          );
        })}
      </ol>

      {/* Formulas */}
      <section aria-label="Validation formulas" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <h2 className="font-display text-[19px] font-semibold text-navy-950">The four numbers behind every score</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Each metric answers a different question about how much the model can be trusted in the selected region, depth and period.
        </p>
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {FORMULAS.map((f) => (
            <div key={f.name} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-[12.5px] font-bold text-navy-950">{f.name}</p>
              <p className="mt-2 rounded-md border border-navy-100 bg-navy-900 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-teal-300">
                {f.formula}
              </p>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600">{f.plain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Future architecture */}
      <section aria-label="Future integration architecture" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[19px] font-semibold text-navy-950">Future integration architecture</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">
              The frontend is structured around a services layer, so swapping mock data for live endpoints is a one-line change
              per service.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            <Boxes className="h-3.5 w-3.5" aria-hidden />
            Planned — production path
          </span>
        </div>

        <div className="mx-auto mt-6 max-w-2xl">
          {ARCHITECTURE.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <div key={layer.title}>
                <div className={`flex items-center gap-3.5 rounded-lg border px-5 py-4 ${layer.tone}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 shadow-sm" aria-hidden>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{layer.title}</p>
                    <p className="text-[11.5px] opacity-80">{layer.sub}</p>
                  </div>
                </div>
                {i < ARCHITECTURE.length - 1 && (
                  <div className="flex justify-center py-1" aria-hidden>
                    <ArrowDown className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
          <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-amber-900">
            <span className="font-bold">Prototype notice.</span> This prototype currently uses curated sample data. The production
            architecture is designed to connect to live and historical scientific datasets through a secure backend — no live data
            is claimed or implied at this stage.
          </p>
        </div>
      </section>
    </div>
  );
}
