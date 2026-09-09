/* Landing / Overview page */

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CloudRainWind,
  Compass,
  Fish,
  Globe2,
  Landmark,
  Layers,
  LifeBuoy,
  LineChart,
  Pause,
  Play,
  ShieldCheck,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { IMPACT_METRICS, WHY_IT_MATTERS } from "../data/content";

const WHY_ICONS: Record<string, LucideIcon> = { Fish, CloudRainWind, LifeBuoy, Landmark, Globe2, Siren };

const FEATURES: { icon: LucideIcon; title: string; text: string; href: string; tone: string }[] = [
  {
    icon: Compass,
    title: "Interactive Ocean Explorer",
    text: "Pan and zoom a depth-aware map of the North Indian Ocean, scrub through time, and click any station to inspect modelled vs measured conditions.",
    href: "#/explorer",
    tone: "bg-ocean-50 text-ocean-700",
  },
  {
    icon: ShieldCheck,
    title: "Model vs Observation Validation",
    text: "MAE, RMSE and bias computed for every matched pair, with plain-language interpretation of where the model can be trusted.",
    href: "#/validation",
    tone: "bg-teal-50 text-teal-700",
  },
  {
    icon: Layers,
    title: "Depth & Time Analysis",
    text: "Move from the surface to 200 m, compare vertical profiles, and see how the ocean's layered structure evolves across January 2026.",
    href: "#/analytics",
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    icon: LineChart,
    title: "Research-ready Analytics",
    text: "Cross-sections, anomaly detection, seasonal context and CSV exports — structured for reports, publications and classroom teaching.",
    href: "#/analytics",
    tone: "bg-navy-50 text-navy-800",
  },
];

const WORKFLOW = [
  { title: "Data Sources", text: "Model NetCDF + buoy, Argo & ship records" },
  { title: "Processing & Alignment", text: "Standardise units, depth & timestamps" },
  { title: "Visualization", text: "Maps, profiles, charts and tables" },
  { title: "Validation & Insights", text: "Scores, agreement status, anomalies" },
];

export default function Overview() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <LivingOceanHero />

      {/* --------------------------- Impact metrics ------------------------- */}
      <section id="overview-content" aria-label="Platform impact" className="scroll-mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {IMPACT_METRICS.map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
            <p className="font-display text-[26px] font-semibold tabular-nums text-navy-950 sm:text-[30px]">{m.value}</p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-slate-700">{m.label}</p>
            <p className="text-[11px] text-slate-400">{m.sub}</p>
          </div>
        ))}
      </section>

      {/* ------------------------------ Features ---------------------------- */}
      <section aria-label="Platform features">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Capabilities</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold text-navy-950 sm:text-[24px]">One platform, four ways to interrogate the ocean</h2>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <a
                key={f.title}
                href={f.href}
                className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,40,80,0.05)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
              >
                <span className={`mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg ${f.tone}`} aria-hidden>
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="text-[14.5px] font-bold text-navy-950">{f.title}</h3>
                <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-slate-600">{f.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-ocean-700">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ------------------------------ Workflow ---------------------------- */}
      <section aria-label="Processing workflow" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)] sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700" aria-hidden>
            <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-[19px] font-semibold text-navy-950">How observations become insight</h2>
            <p className="text-[12px] text-slate-500">A transparent pipeline from raw measurements to validated evidence.</p>
          </div>
        </div>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {WORKFLOW.map((w, i) => (
            <li key={w.title} className="relative rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <span className="mb-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-800 px-1.5 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <p className="text-[13.5px] font-bold text-navy-950">{w.title}</p>
              <p className="mt-1 text-[12px] leading-snug text-slate-500">{w.text}</p>
              {i < WORKFLOW.length - 1 && (
                <ArrowRight className="absolute -right-[13px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-400 xl:block" aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------- Why it matters ------------------------ */}
      <section aria-label="Why it matters">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Why it matters</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold text-navy-950 sm:text-[24px]">
            The ocean decides monsoons, catch sizes and coastal risk
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            Reliable, validated ocean data underpins decisions across India’s blue economy. OceanScope 3D makes that data
            explorable for the people who need it.
          </p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_IT_MATTERS.map((w) => {
            const Icon = WHY_ICONS[w.icon] ?? Globe2;
            return (
              <div key={w.title} className="flex gap-3.5 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ocean-50 text-ocean-700" aria-hidden>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="text-[13.5px] font-bold text-navy-950">{w.title}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{w.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LivingOceanHero() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener?.("change", syncPreference);
    return () => media.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setIsPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const motionActive = isPlaying && !prefersReducedMotion;

  return (
    <section
      aria-label="Living Ocean introduction"
      className="relative isolate flex min-h-[calc(100svh-3.5rem)] overflow-hidden rounded-[1.5rem] bg-[#041827] text-[#F4F9FC] shadow-[0_24px_80px_rgba(4,24,39,0.28)] lg:min-h-[calc(100vh-3.5rem)] lg:rounded-[2rem]"
    >
      <style>{`
        @keyframes living-ocean-stream {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -140; }
        }
        @keyframes living-ocean-node {
          0%, 100% { opacity: .25; transform: scale(.78); }
          50% { opacity: .9; transform: scale(1.18); }
        }
        .living-ocean-stream { animation: living-ocean-stream 28s linear infinite; }
        .living-ocean-node { transform-box: fill-box; transform-origin: center; animation: living-ocean-node 3.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .living-ocean-stream, .living-ocean-node { animation: none !important; }
        }
      `}</style>
      <HeroArt motion={motionActive} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(22,119,200,0.2),transparent_34%),linear-gradient(90deg,rgba(4,24,39,0.98)_0%,rgba(4,24,39,0.88)_42%,rgba(4,24,39,0.5)_78%,rgba(4,24,39,0.72)_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#041827]/45 via-transparent to-[#041827]/80" aria-hidden />

      <div className="relative z-10 flex w-full flex-col justify-between gap-12 px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16 xl:px-20 xl:py-20">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#79DCE8] sm:text-[11px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#79DCE8]/30 bg-[#062B4F]/70 px-3 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#79DCE8] shadow-[0_0_14px_#79DCE8]" aria-hidden />
              Indian Ocean Intelligence
            </span>
            <span className="text-[#F4F9FC]/55">Ocean observation console</span>
          </div>

          <h1 className="mt-8 max-w-3xl font-display text-[clamp(3.25rem,11vw,8.5rem)] font-semibold leading-[0.88] tracking-[-0.055em] text-[#F4F9FC]">
            OceanScope <span className="text-[#79DCE8]">3D</span>
          </h1>

          <div className="mt-8 max-w-2xl border-l border-[#79DCE8]/55 pl-4 sm:pl-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#79DCE8]">Temperature</p>
            <p className="mt-3 max-w-xl text-[16px] leading-[1.7] text-[#F4F9FC]/82 sm:text-[18px]">
              Explore how numerical ocean-model temperature estimates compare with curated in-situ observations across location, depth, and time.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#/explorer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#79DCE8] px-6 py-3 text-[14px] font-bold text-[#041827] shadow-[0_12px_30px_rgba(121,220,232,0.2)] transition-transform hover:-translate-y-0.5 hover:bg-[#F4F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79DCE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#041827] sm:w-auto"
            >
              Explore Ocean Data
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#/validation"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#F4F9FC]/30 bg-[#062B4F]/55 px-6 py-3 text-[14px] font-semibold text-[#F4F9FC] backdrop-blur-sm transition-colors hover:border-[#79DCE8]/70 hover:bg-[#1677C8]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79DCE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#041827] sm:w-auto"
            >
              View Validation Metrics
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F4F9FC]/65">
            SIH26067 · Ministry of Earth Sciences · Curated Sample Data
          </p>
          <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-[#F4F9FC]/55">
            Prototype for interactive model–observation comparison in Indian waters.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <a
            href="#overview-content"
            className="group inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F4F9FC]/65 transition-colors hover:text-[#79DCE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79DCE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#041827]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F4F9FC]/25 transition-colors group-hover:border-[#79DCE8]/70">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </span>
            Discover the platform
          </a>
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            disabled={prefersReducedMotion}
            aria-pressed={motionActive}
            title={prefersReducedMotion ? "Motion disabled by your reduced-motion preference" : undefined}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#F4F9FC]/20 bg-[#062B4F]/55 px-3.5 py-2 text-[11px] font-semibold text-[#F4F9FC]/70 backdrop-blur-sm transition-colors hover:border-[#79DCE8]/60 hover:text-[#F4F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79DCE8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#041827] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {motionActive ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {prefersReducedMotion ? "Motion disabled" : motionActive ? "Pause motion" : "Play motion"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* Hand-crafted decorative hero artwork: bathymetric contours, grid lines,
   current streamlines and observation nodes — no external assets used. */
function HeroArt({ motion }: { motion: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1000 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hero-glow" cx="72%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#0E3A5F" />
          <stop offset="100%" stopColor="#0A2540" />
        </radialGradient>
      </defs>
      <rect width="1000" height="420" fill="url(#hero-glow)" />

      {/* lat/lon grid */}
      <g stroke="rgba(148,190,230,0.10)" strokeWidth="1">
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 84} y1={0} x2={i * 84} y2={420} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 84} x2={1000} y2={i * 84} />
        ))}
      </g>

      {/* temperature contours (warm core) */}
      <g fill="none" stroke="#2DD4BF" strokeOpacity="0.5" strokeWidth="1.4">
        <ellipse cx="720" cy="230" rx="60" ry="42" strokeDasharray="5 4" />
        <ellipse cx="735" cy="238" rx="120" ry="80" strokeOpacity="0.38" />
        <ellipse cx="748" cy="246" rx="190" ry="126" strokeOpacity="0.26" strokeDasharray="5 4" />
        <ellipse cx="760" cy="255" rx="265" ry="175" strokeOpacity="0.16" />
        <ellipse cx="770" cy="262" rx="345" ry="225" strokeOpacity="0.10" strokeDasharray="5 4" />
      </g>

      {/* second (cool) contour group */}
      <g fill="none" stroke="#60A5FA" strokeOpacity="0.32" strokeWidth="1.2">
        <ellipse cx="180" cy="90" rx="52" ry="36" strokeDasharray="4 4" />
        <ellipse cx="192" cy="98" rx="110" ry="70" strokeOpacity="0.22" />
        <ellipse cx="204" cy="106" rx="172" ry="108" strokeOpacity="0.13" strokeDasharray="4 4" />
      </g>

      {/* contour labels */}
      <g className="hidden sm:block" fontFamily="Inter, system-ui, sans-serif" fontSize="10.5" fontWeight="600" letterSpacing="0.05em">
        <text x="777" y="232" fill="#5EEAD4">30.2°C</text>
        <text x="838" y="255" fill="#2DD4BF" fillOpacity="0.8">29.5°C</text>
        <text x="892" y="286" fill="#14B8A6" fillOpacity="0.55">28.8°C</text>
        <text x="232" y="92" fill="#93C5FD" fillOpacity="0.8">26.4°C</text>
      </g>

      {/* current flow lines */}
      <g className={motion ? "living-ocean-stream" : undefined} style={{ animationPlayState: motion ? "running" : "paused" }} fill="none" strokeWidth="1.6" strokeLinecap="round">
        <path d="M-20 320 C 180 260, 340 380, 520 330 S 820 250, 1030 300" stroke="rgba(94,234,212,0.35)" strokeDasharray="1 0" />
        <path d="M-20 350 C 200 300, 380 400, 560 352 S 840 300, 1030 335" stroke="rgba(94,234,212,0.22)" />
        <path d="M-20 160 C 160 120, 320 200, 480 170 S 760 110, 1030 150" stroke="rgba(125,211,252,0.28)" />
        <path d="M-20 120 C 180 90, 360 160, 540 132 S 800 80, 1030 118" stroke="rgba(125,211,252,0.16)" />
      </g>

      {/* flow direction chevrons */}
      <g fill="rgba(94,234,212,0.55)">
        <path d="M318 321 l10 -6 l-2 10 z" />
        <path d="M676 279 l10 -6 l-2 10 z" />
        <path d="M168 322 l10 -5 l-3 10 z" />
      </g>

      {/* observation stations */}
      <g>
        {[
          { x: 628, y: 205, shape: "circle" },
          { x: 705, y: 285, shape: "diamond" },
          { x: 812, y: 218, shape: "circle" },
          { x: 566, y: 320, shape: "triangle" },
          { x: 858, y: 300, shape: "diamond" },
          { x: 400, y: 148, shape: "circle" },
          { x: 260, y: 348, shape: "diamond" },
        ].map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <circle
              className={motion ? "living-ocean-node" : undefined}
              style={{ animationDelay: `${i * 0.4}s`, animationPlayState: motion ? "running" : "paused" }}
              r="12"
              fill="none"
              stroke="rgba(121,220,232,0.5)"
              strokeWidth="1.4"
            />
            {s.shape === "circle" && <circle r="4.5" fill="#2DD4BF" stroke="#0A2540" strokeWidth="1.6" />}
            {s.shape === "diamond" && <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill="#5EEAD4" stroke="#0A2540" strokeWidth="1.6" />}
            {s.shape === "triangle" && <path d="M0 -5 L4.8 4 L-4.8 4 Z" fill="#38BDF8" stroke="#0A2540" strokeWidth="1.6" />}
          </g>
        ))}
      </g>

      {/* callsign chips */}
      <g className="hidden sm:block" fontFamily="Inter, system-ui, sans-serif" fontSize="10" fontWeight="600">
        <g transform="translate(596 178)">
          <rect width="86" height="20" rx="4" fill="rgba(10,37,64,0.85)" stroke="rgba(94,234,212,0.35)" />
          <text x="10" y="13.5" fill="#99F6E4">ARGO-IN-1024</text>
        </g>
        <g transform="translate(826 274)">
          <rect width="82" height="20" rx="4" fill="rgba(10,37,64,0.85)" stroke="rgba(94,234,212,0.35)" />
          <text x="10" y="13.5" fill="#99F6E4">BUOY-BOB-07</text>
        </g>
      </g>
    </svg>
  );
}
