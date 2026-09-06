/* ------------------------------------------------------------------ */
/* OceanScope 3D — application root                                    */
/* Hash-based routing keeps the prototype deployable anywhere with no  */
/* server configuration. See src/services/api.ts for the data layer.   */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import type { RegionKey } from "./types";
import { REGIONS } from "./data/ocean";
import Layout, { NAV_ITEMS, type RouteId } from "./components/Layout";
import GlossaryModal from "./components/GlossaryModal";
import { Modal, SelectField, SegmentedControl } from "./components/ui";
import Overview from "./pages/Overview";
import Explorer from "./pages/Explorer";
import Validation from "./pages/Validation";
import DataSources from "./pages/DataSources";
import Analytics from "./pages/Analytics";
import Methodology from "./pages/Methodology";
import Project from "./pages/Project";

export interface AppSettings {
  defaultRegion: RegionKey;
  reducedMotion: boolean;
}

const SETTINGS_KEY = "oceanscope3d-settings-v1";
const DEFAULT_SETTINGS: AppSettings = { defaultRegion: "bob", reducedMotion: false };

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return DEFAULT_SETTINGS;
}

const HASH_TO_ROUTE: Record<string, RouteId> = {
  "": "overview",
  "/": "overview",
  "/explorer": "explorer",
  "/validation": "validation",
  "/sources": "sources",
  "/analytics": "analytics",
  "/methodology": "methodology",
  "/project": "project",
};

function routeFromHash(): RouteId {
  const hash = window.location.hash.replace(/^#/, "");
  return HASH_TO_ROUTE[hash] ?? "overview";
}

export default function App() {
  const [route, setRoute] = useState<RouteId>(routeFromHash);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const saveSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* non-persistent environment — settings live for the session */
    }
  }, []);

  const openGlossary = useCallback(() => setGlossaryOpen(true), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const page = (() => {
    switch (route) {
      case "overview":
        return <Overview />;
      case "explorer":
        return <Explorer settings={settings} />;
      case "validation":
        return <Validation settings={settings} />;
      case "sources":
        return <DataSources />;
      case "analytics":
        return <Analytics settings={settings} />;
      case "methodology":
        return <Methodology />;
      case "project":
        return <Project />;
      default:
        return <Overview />;
    }
  })();

  const activeNav = NAV_ITEMS.find((n) => n.id === route);

  return (
    <>
      {/* skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <Layout current={route} onGlossary={openGlossary} onSettings={openSettings}>
        <div id="main-content" key={route} aria-label={activeNav?.label} className="page-enter">
          {page}
        </div>
      </Layout>

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" subtitle="Prototype preferences — stored locally in your browser.">
        <div className="space-y-5">
          <SelectField
            label="Default region"
            value={settings.defaultRegion}
            onChange={(v) => saveSettings({ ...settings, defaultRegion: v })}
            options={REGIONS.map((r) => ({ value: r.key, label: r.label }))}
          />
          <SegmentedControl
            label="Interface motion"
            value={settings.reducedMotion ? "reduced" : "full"}
            onChange={(v) => saveSettings({ ...settings, reducedMotion: v === "reduced" })}
            options={[
              { value: "full", label: "Full motion" },
              { value: "reduced", label: "Reduced motion" },
            ]}
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-navy-900">
              <BookOpen className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              About this build
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
              OceanScope 3D prototype v0.9 · Smart India Hackathon 2026 · SIH26067. Units are fixed to °C, PSU and m/s until the
              production unit service is connected.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
