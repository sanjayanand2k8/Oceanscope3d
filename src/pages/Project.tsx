/* Project Overview — SIH identity, stack, innovation, team, contact. */

import { Award, Building2, CheckCircle2, Code2, Compass, Cpu, Database, Lightbulb, Mail, Server, Target, Wind } from "lucide-react";
import { INNOVATION_POINTS } from "../data/content";
import { PageHeader } from "../components/ui";

const IDENTITY = [
  { icon: Target, label: "Problem Statement", value: "SIH26067" },
  { icon: Building2, label: "Organization", value: "Ministry of Earth Sciences" },
  { icon: Award, label: "Theme", value: "Smart Automation" },
];

const STACK = [
  { icon: Code2, name: "React 19", role: "Frontend framework", tag: "Current" },
  { icon: Wind, name: "TypeScript", role: "Type-safe domain model", tag: "Current" },
  { icon: Compass, name: "Tailwind CSS 4", role: "Design system & layout", tag: "Current" },
  { icon: Database, name: "Recharts", role: "Scientific charts", tag: "Current" },
  { icon: Server, name: "FastAPI + Python", role: "API backend on Replit", tag: "Planned" },
  { icon: Cpu, name: "xarray · pandas · NumPy", role: "NetCDF processing & scoring", tag: "Planned" },
  { icon: Database, name: "PostgreSQL / PostGIS", role: "Spatial observation store", tag: "Planned" },
];

const TEAM = [
  { initials: "AR", name: "Ananya Rao", role: "Team Lead · Frontend", focus: "Map visualization & design system" },
  { initials: "VK", name: "Vikram Krishnan", role: "Data Engineering", focus: "Mock datasets & validation engine" },
  { initials: "SP", name: "Sara Pillai", role: "Ocean Science", focus: "Domain accuracy & interpretation rules" },
  { initials: "AM", name: "Arjun Menon", role: "Backend (planned)", focus: "FastAPI & NetCDF processing" },
  { initials: "DI", name: "Diya Iyer", role: "UX & Accessibility", focus: "Glossary, states & testing" },
  { initials: "RS", name: "Rahul Sharma", role: "DevOps & Docs", focus: "Deployment & documentation" },
];

export default function Project() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="SIH 2026 submission"
        title="Project Overview"
        subtitle="OceanScope 3D — problem statement, objectives, technology stack, and the team behind the prototype."
      />

      {/* Identity */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {IDENTITY.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-800" aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="text-[14px] font-bold text-navy-950">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Objective */}
      <section aria-label="Project objective" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <h2 className="font-display text-[19px] font-semibold text-navy-950">Objective</h2>
        <blockquote className="mt-3 border-l-[3px] border-teal-500 bg-teal-50/60 px-4 py-3 text-[13.5px] leading-relaxed text-navy-900">
          “Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ
          observations.”
        </blockquote>
        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-slate-600">
          OceanScope 3D answers this by giving researchers, marine agencies, students and decision-makers a single screen where a
          numerical ocean model is continuously confronted with real measurements. The prototype demonstrates the complete
          workflow — mapping, depth and time navigation, model–observation matching, validation scoring, anomaly reporting and
          explainable interpretation — using realistic sample data for Indian waters.
        </p>
      </section>

      {/* Stack */}
      <section aria-label="Technology stack" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <h2 className="font-display text-[19px] font-semibold text-navy-950">Technology stack</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {STACK.map((s) => {
            const Icon = s.icon;
            const planned = s.tag === "Planned";
            return (
              <div key={s.name} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-md ${planned ? "bg-slate-100 text-slate-500" : "bg-ocean-50 text-ocean-700"}`} aria-hidden>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-navy-950">{s.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{s.role}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    planned ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {s.tag}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Innovation */}
      <section aria-label="Innovation points" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-600" aria-hidden>
            <Lightbulb className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-[19px] font-semibold text-navy-950">What makes it different</h2>
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {INNOVATION_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-3 text-[12.5px] font-medium text-navy-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Team */}
      <section aria-label="Team members">
        <div className="mb-4">
          <h2 className="font-display text-[19px] font-semibold text-navy-950">Team Nautilus</h2>
          <p className="text-[12px] text-slate-500">Placeholder profiles — replace with final team details before submission.</p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((member) => (
            <div key={member.initials} className="flex items-center gap-3.5 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-800 font-display text-[15px] font-semibold text-teal-300" aria-hidden>
                {member.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-navy-950">{member.name}</p>
                <p className="text-[11.5px] font-semibold text-ocean-700">{member.role}</p>
                <p className="truncate text-[11px] text-slate-500">{member.focus}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact + disclaimer */}
      <section aria-label="Contact and disclaimer" className="grid gap-3.5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-navy-900 p-6 text-white">
          <h2 className="font-display text-[18px] font-semibold">Contact</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">
            For demonstration, dataset access requests or collaboration around SIH26067:
          </p>
          <ul className="mt-4 space-y-2 text-[12.5px]">
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-teal-300" aria-hidden />
              <span className="text-slate-200">team.nautilus@sih2026.example.in</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-teal-300" aria-hidden />
              <span className="text-slate-200">Mentored under the Ministry of Earth Sciences track</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Code2 className="h-4 w-4 text-teal-300" aria-hidden />
              <span className="text-slate-200">Repository handover follows SIH 2026 guidelines</span>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-[18px] font-semibold text-navy-950">Project disclaimer</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
            OceanScope 3D is a hackathon prototype. All data shown is synthetic sample material generated for demonstration and is
            <span className="font-semibold text-navy-900"> not suitable for navigation, fisheries operations, or safety-critical
            decisions</span>. Coastlines are simplified for illustration. No live feeds from INCOIS, Argo or NIOT are connected at
            this stage; production deployment requires agency data agreements and operational quality control.
          </p>
        </div>
      </section>
    </div>
  );
}
