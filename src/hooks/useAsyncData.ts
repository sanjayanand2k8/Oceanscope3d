/* Generic async data-loading hook with loading / error / retry states. */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Runs `fetcher` whenever `deps` change. Keeps stale responses from
 * overwriting newer ones and exposes a retry.  Errors are logged in the
 * console for developers while the UI stays calm (skeletons / empty states).
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (id === seq.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (id === seq.current) {
          console.warn("[OceanScope] data load failed:", err);
          setError("Data could not be loaded for the selected filters.");
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run };
}
