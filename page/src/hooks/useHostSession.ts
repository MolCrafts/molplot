import type { Command } from "@molcrafts/molplot/semantic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type FigureItem,
  fetchFigures,
  fetchResult,
  type HostResult,
  postCommand,
  postStyle,
  type StyleCommand,
} from "@/lib/host";

export type HostStatus = "loading" | "live" | "applying" | "error";

export function useHostSession() {
  const [status, setStatus] = useState<HostStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HostResult | null>(null);
  const [figures, setFigures] = useState<FigureItem[]>([]);
  const [figureId, setFigureId] = useState<string | null>(null);
  const generation = useRef(0);
  const seq = useRef(0);
  const serial = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(result);
  latest.current = result;

  // Catalog refreshes never replace an in-progress edit or change the active figure.
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const catalog = await fetchFigures();
        if (disposed) return;
        setFigures((current) =>
          JSON.stringify(current) === JSON.stringify(catalog.figures)
            ? current
            : catalog.figures,
        );
        setFigureId((current) =>
          catalog.figures.some((item) => item.id === current)
            ? current
            : (catalog.figures[0]?.id ?? null),
        );
        if (!catalog.figures.length) setStatus("live");
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          if (!latest.current) setStatus("error");
        }
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    serial.current = Promise.resolve();
    latest.current = null;
    setResult(null);
    setError(null);
    if (!figureId) return;
    setStatus("loading");
    try {
      const next = await fetchResult("result", figureId);
      if (ticket !== generation.current) return;
      setResult(next);
      setStatus("live");
    } catch (err) {
      if (ticket !== generation.current) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [figureId]);

  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);

  const submit = useCallback(
    (
      command: Omit<Command, "baseRevision"> | StyleCommand,
    ): Promise<boolean> => {
      if (!latest.current || !figureId) return Promise.resolve(false);
      const ticket = generation.current;
      const operation = serial.current.then(async () => {
        const current = latest.current;
        if (ticket !== generation.current || !current) return false;
        const requestId = `ui-${++seq.current}`;
        setStatus("applying");
        try {
          const payload =
            command.type === "style"
              ? await postStyle(command, requestId, figureId)
              : await postCommand(
                  { ...command, baseRevision: current.revision },
                  requestId,
                  figureId,
                );
          if (ticket !== generation.current) return false;
          if (!payload.ok || !payload.result)
            throw new Error(
              payload.error?.message ||
                payload.error?.code ||
                "Could not apply change",
            );
          const next = {
            ...payload.result,
            script: payload.result.script ?? payload.script ?? current.script,
          };
          latest.current = next;
          setResult(next);
          setStatus("live");
          setError(null);
          return true;
        } catch (err) {
          if (ticket === generation.current) {
            setStatus("error");
            setError(err instanceof Error ? err.message : String(err));
          }
          return false;
        }
      });
      serial.current = operation;
      return operation;
    },
    [figureId],
  );

  const selectFigure = useCallback(
    (id: string) => {
      // Invalidate old responses before React renders the next selected figure.
      if (id !== figureId) {
        generation.current++;
        latest.current = null;
        setResult(null);
        setFigureId(id);
      }
    },
    [figureId],
  );

  return {
    status,
    error,
    result,
    figures,
    figureId,
    selectFigure,
    reload,
    apply: submit,
    applyStyle: submit,
  };
}
