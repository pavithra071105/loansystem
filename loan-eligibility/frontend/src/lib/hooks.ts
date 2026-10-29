import { useEffect, useRef, useState, type DependencyList } from "react";
import { ApiError } from "./api";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");

/** Load data whenever the dependencies change, with loading and error state. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn()
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (live) setError(message(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

/** Calls `fn` once `value` settles and ignores out-of-order responses. */
export function useLatest<T, R>(value: T, fn: (v: T) => Promise<R>, delay = 250) {
  const debounced = useDebounced(value, delay);
  const [out, setOut] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    fn(debounced)
      .then((r) => { if (id === seq.current) { setOut(r); setError(null); } })
      .catch((e: unknown) => { if (id === seq.current) setError(message(e)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return { out, error };
}
