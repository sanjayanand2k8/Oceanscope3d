import { useMemo, useState } from "react";
import { BookOpen, Search, Tag } from "lucide-react";
import { GLOSSARY } from "../data/content";
import { Modal } from "./ui";
import { cls } from "../lib/utils";

const CATEGORIES = ["All", "Observations", "Modelling", "Variables", "Validation", "Analysis", "Data formats"];

/** Searchable glossary of ocean-science terms, written for students. */
export default function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const terms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY.filter(
      (t) =>
        (category === "All" || t.category === category) &&
        (!q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q))
    );
  }, [query, category]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Help & Glossary"
      subtitle="Plain-language definitions of the scientific terms used across OceanScope 3D."
      wide
    >
      <div className="sticky -top-4 z-10 -mx-1 mb-4 bg-white px-1 pb-3 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms, e.g. “RMSE” or “Argo”…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-[13px] text-navy-900 placeholder:text-slate-400 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/30"
            aria-label="Search glossary terms"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Glossary categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={cls(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500",
                category === c
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-navy-900"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {terms.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <BookOpen className="mb-3 h-6 w-6 text-slate-300" aria-hidden />
          <p className="text-sm font-medium text-slate-600">No terms match “{query}”.</p>
          <p className="mt-1 text-xs text-slate-400">Try a different keyword or category.</p>
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {terms.map((t) => (
            <div key={t.term} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
              <dt className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-navy-900">{t.term}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-teal-700 ring-1 ring-inset ring-teal-100">
                  <Tag className="h-2.5 w-2.5" aria-hidden />
                  {t.category}
                </span>
              </dt>
              <dd className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{t.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}
