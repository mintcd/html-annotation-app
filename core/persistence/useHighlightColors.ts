"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  INITIAL_HIGHLIGHT_COLORS,
  normalizeHighlightColorRow,
  upsertHighlightColorRow,
} from "./syncData";
import { useSyncRows, useSyncRuntime } from "./syncRuntime";

export function useHighlightColors(): {
  readonly data: HighlightColor[];
  readonly loading: boolean;
  readonly error: string | undefined;
} {
  const runtime = useSyncRuntime();
  const rows = useSyncRows('highlight_colors');
  const seedingRef = useRef(false);

  const colors = useMemo(
    () => (rows.data ?? []).map((row) =>
      normalizeHighlightColorRow(row as unknown as Record<string, unknown>),
    ),
    [rows.data],
  );

  useEffect(() => {
    if (
      !runtime.ready
      || runtime.phase === 'opening'
      || runtime.phase === 'syncing'
      || rows.loading
      || rows.data === undefined
      || rows.data.length > 0
      || seedingRef.current
    ) return;

    seedingRef.current = true;
    void (async () => {
      try {
        for (const color of INITIAL_HIGHLIGHT_COLORS) {
          await upsertHighlightColorRow(color, runtime, { flush: 'none' });
        }
        await runtime.sync();
      } catch (error) {
        console.warn('Failed to seed highlight colors', error);
      } finally {
        seedingRef.current = false;
      }
    })();
  }, [runtime, rows.data, rows.loading]);

  return {
    data: colors,
    loading: rows.loading,
    error: rows.error,
  };
}
