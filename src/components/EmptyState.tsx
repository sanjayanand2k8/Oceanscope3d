import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Friendly empty state used for panels, tables and charts. */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex h-full flex-col items-center justify-center text-center ${compact ? "py-6" : "py-10"}`}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50" aria-hidden>
        <Icon className="h-5 w-5 text-slate-400" strokeWidth={1.6} />
      </span>
      <p className="text-[13.5px] font-semibold text-navy-900">{title}</p>
      <p className="mt-1 max-w-[270px] text-xs leading-relaxed text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
