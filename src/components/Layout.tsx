/* Application shell: desktop sidebar, mobile top bar + drawer + bottom nav. */

import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Compass,
  Database,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Waves,
  Workflow,
  X,
} from "lucide-react";
import { cls } from "../lib/utils";
import type { DataMode } from "../services/api";

export const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, path: "#/" },
  { id: "explorer", label: "Ocean Explorer", icon: Compass, path: "#/explorer" },
  { id: "validation", label: "Model Validation", icon: ShieldCheck, path: "#/validation" },
  { id: "sources", label: "Data Sources", icon: Database, path: "#/sources" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "#/analytics" },
  { id: "methodology", label: "Methodology", icon: Workflow, path: "#/methodology" },
] as const;

export type RouteId = (typeof NAV_ITEMS)[number]["id"];

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-teal-400 to-ocean-600 text-white shadow-md shadow-navy-950/40" aria-hidden>
        <Waves className="h-5 w-5" strokeWidth={2} />
      </span>
      <span>
        <span className="block font-display text-[16px] font-semibold leading-none text-white">OceanScope 3D</span>
        <span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-teal-300/90">MoES · SIH26067</span>
      </span>
    </a>
  );
}

function NavList({ current, onNavigate, onGlossary, onSettings, dataMode }: NavProps & { onNavigate?: () => void }) {
  return (
    <>
      <nav className="mt-5 flex-1 space-y-1 px-3" aria-label="Primary">
        <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Platform</p>
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.path}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cls(
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                active ? "bg-white/8 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <span className={cls("absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-teal-400 transition-opacity", active ? "opacity-100" : "opacity-0")} aria-hidden />
              <Icon className={cls("h-[17px] w-[17px]", active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300")} strokeWidth={1.9} aria-hidden />
              {item.label}
            </a>
          );
        })}
      </nav>

      <nav className="space-y-1 border-t border-white/10 px-3 py-3" aria-label="Utilities">
        <button
          onClick={() => {
            onGlossary();
            onNavigate?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <BookOpen className="h-[17px] w-[17px] text-slate-500" strokeWidth={1.9} aria-hidden />
          Help &amp; Glossary
        </button>
        <button
          onClick={() => {
            onSettings();
            onNavigate?.();
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Settings className="h-[17px] w-[17px] text-slate-500" strokeWidth={1.9} aria-hidden />
          Settings
        </button>
      </nav>

      <div className="mx-3 mb-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        {dataMode === "api" ? (
          <p className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-200">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Local API connected
          </p>
        ) : dataMode === "fallback" ? (
          <p className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-200">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            Displaying curated sample data.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-200">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-400" aria-hidden />
            Checking data source…
          </p>
        )}
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
          Prototype v0.9 · {dataMode === "api" ? "API served" : "curated fallback"}
          <br />
          Team Nautilus · SIH 2026
        </p>
      </div>
    </>
  );
}

interface NavProps {
  current: RouteId;
  onGlossary: () => void;
  onSettings: () => void;
  dataMode: DataMode;
  statusNotice?: ReactNode;
}

export default function Layout({
  current,
  onGlossary,
  onSettings,
  dataMode,
  statusNotice,
  children,
}: NavProps & { children: ReactNode; statusNotice?: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
  }, [current]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-navy-900 lg:flex">
        <div className="px-5 pb-2 pt-5">
          <Logo />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NavList current={current} onGlossary={onGlossary} onSettings={onSettings} dataMode={dataMode} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-navy-900 px-4 lg:hidden">
        <Logo />
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawer}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-navy-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <Logo />
              <button
                onClick={() => setDrawer(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
              <NavList current={current} onGlossary={onGlossary} onSettings={onSettings} dataMode={dataMode} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex min-h-screen min-w-0 flex-col pt-14 lg:pl-[248px] lg:pt-0">
        <main className="mx-auto min-w-0 w-full max-w-[1440px] flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-7 lg:pb-10">
          {statusNotice}
          {children}
        </main>

        <footer className="min-w-0 border-t border-slate-200 bg-white/60 py-4 pb-24 lg:pb-4">
          <p className="px-6 text-center text-[11.5px] font-medium tracking-wide text-slate-500">
            Smart India Hackathon 2026 <span className="text-slate-300">|</span> Ministry of Earth Sciences{" "}
            <span className="text-slate-300">|</span> Problem Statement SIH26067
          </p>
        </footer>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid min-w-0 grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {[
          NAV_ITEMS[0],
          NAV_ITEMS[1],
          NAV_ITEMS[2],
          NAV_ITEMS[4],
        ].map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <a
              key={item.id}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={cls(
                "flex min-w-0 flex-col items-center gap-1 py-2.5 text-center text-[10px] font-semibold",
                active ? "text-ocean-700" : "text-slate-500"
              )}
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
              {item.id === "overview" ? "Home" : item.id === "validation" ? "Validate" : item.label.split(" ")[1] ?? item.label}
            </a>
          );
        })}
        <button
          onClick={() => setDrawer(true)}
          className="flex min-w-0 flex-col items-center gap-1 py-2.5 text-center text-[10px] font-semibold text-slate-500"
          aria-label="Open full menu"
        >
          <Menu className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
          More
        </button>
      </nav>
    </div>
  );
}
