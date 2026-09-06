/* Generic data table with search, sorting, pagination and CSV export. */

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, Table2 } from "lucide-react";
import EmptyState from "./EmptyState";
import { cls } from "../lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  value: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  searchKeys?: ((row: T) => string)[];
  searchPlaceholder?: string;
  pageSize?: number;
  exportName?: string;
  caption?: string;
  dense?: boolean;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchKeys,
  searchPlaceholder = "Search…",
  pageSize = 10,
  exportName,
  caption,
  dense = false,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q && searchKeys) {
      out = rows.filter((r) => searchKeys.some((key) => key(r).toLowerCase().includes(q)));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        out = [...out].sort((a, b) => {
          const av = col.value(a);
          const bv = col.value(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, sortKey, sortDir, columns, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            aria-label="Search table rows"
            className="w-full max-w-xs rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-[12.5px] text-navy-900 placeholder:text-slate-400 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/30"
          />
        </div>
        <span className="text-[12px] tabular-nums text-slate-500" aria-live="polite">
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
        </span>
        {exportName && (
          <button
            onClick={() => exportRows(exportName, columns, filtered)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-slate-50 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cls(
                    "whitespace-nowrap border-b border-slate-200 font-semibold text-slate-600",
                    dense ? "px-2.5 py-2" : "px-3.5 py-2.5",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className={cls(
                        "inline-flex items-center gap-1 rounded hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500",
                        sortKey === col.key && "text-navy-900"
                      )}
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    compact
                    icon={Table2}
                    title="No data available for current filters"
                    body="Try widening the date range, switching region, or clearing the search."
                  />
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={rowKey(row, i)} className="border-b border-slate-100 last:border-0 even:bg-slate-50/50 hover:bg-ocean-50/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cls(
                        "whitespace-nowrap",
                        dense ? "px-2.5 py-1.5" : "px-3.5 py-2",
                        col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : "text-left",
                        typeof col.value(row) === "number" && "tabular-nums"
                      )}
                    >
                      {col.render ? col.render(row) : col.value(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Table pagination" className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11.5px] tabular-nums text-slate-500">
            Page {safePage} of {pages}
          </p>
          <div className="flex items-center gap-1">
            <PageBtn label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </PageBtn>
            {paginationRange(safePage, pages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  aria-current={p === safePage ? "page" : undefined}
                  className={cls(
                    "h-8 min-w-8 rounded-md px-2 text-[12px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500",
                    p === safePage ? "bg-navy-800 text-white" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <PageBtn label="Next page" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </PageBtn>
          </div>
        </nav>
      )}
    </div>
  );
}

function PageBtn({ children, label, disabled, onClick }: { children: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
    >
      {children}
    </button>
  );
}

function paginationRange(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
  const arr = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of arr) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function exportRows<T>(name: string, columns: Column<T>[], rows: T[]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => c.value(r)))]
    .map((line) => line.map(escape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
