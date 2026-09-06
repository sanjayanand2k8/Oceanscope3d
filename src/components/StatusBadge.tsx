import type { StatusLevel } from "../types";
import { STATUS_META } from "../data/ocean";
import { cls } from "../lib/utils";

/** Agreement / quality badge used across the app. */
export default function StatusBadge({
  level,
  size = "md",
  dot = true,
}: {
  level: StatusLevel;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  const meta = STATUS_META[level];
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        meta.bg,
        meta.text,
        meta.border,
        size === "sm" ? "px-2 py-[3px] text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />}
      {size === "sm" ? meta.short : meta.label}
    </span>
  );
}
