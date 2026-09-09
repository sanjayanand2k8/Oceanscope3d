import { useEffect, useRef, useState, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

interface StableResponsiveChartProps {
  height: number;
  children: ReactNode;
}

/**
 * Recharts measures its parent with ResizeObserver. During browser zoom and
 * breakpoint changes that measurement can briefly be zero, so keep the host
 * at a stable height and only mount the chart after it has a usable width.
 */
export default function StableResponsiveChart({ height, children }: StableResponsiveChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hasUsableSize, setHasUsableSize] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateSize = () => {
      const { width, height: measuredHeight } = host.getBoundingClientRect();
      setHasUsableSize(width > 0 && measuredHeight > 0);
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="min-w-0 w-full" style={{ height, minHeight: height }}>
      {hasUsableSize && (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
