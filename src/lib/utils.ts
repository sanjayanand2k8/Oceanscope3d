/* Small shared helpers for OceanScope 3D */

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Fixed decimals formatting used across scientific readouts. */
export function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

/** Signed formatting, e.g. +0.42 / −0.18 (uses true minus sign). */
export function signed(value: number, decimals = 2): string {
  const v = Math.abs(value) < 0.5 * Math.pow(10, -decimals) ? 0 : value;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(decimals)}`;
}

/** Format longitude/latitude into hemispheric notation. */
export function fmtLon(lon: number): string {
  return `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}
export function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
}

/** Trigger a client-side CSV download (works offline, no backend needed). */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Scroll a child of a scroll container into view smoothly if present. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
