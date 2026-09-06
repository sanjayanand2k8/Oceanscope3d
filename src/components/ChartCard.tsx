import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { InfoTip } from "./ui";
import { cls } from "../lib/utils";

/** Consistent card frame for charts and dense data visualisations. */
export default function ChartCard({
  icon: Icon,
  title,
  subtitle,
  tooltip,
  actions,
  children,
  className,
  bodyClassName,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  tooltip?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cls(
        "flex flex-col rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,40,80,0.05)]",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-50 text-navy-700" aria-hidden>
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
          )}
          <div>
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-900">
              {title}
              {tooltip && <InfoTip text={tooltip} wide />}
            </h3>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cls("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
