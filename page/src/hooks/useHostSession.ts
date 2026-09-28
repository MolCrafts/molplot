import type { Command } from "@molcrafts/molplot/semantic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchResult,
  type HostResult,
  postCommand,
  postStyle,
  type StyleCommand,
} from "@/lib/host";

export type HostStatus = "loading" | "live" | "applying" | "error";

export interface HostSession {
  status: HostStatus;
  error: string | null;
  result: HostResult | null;
  reload: () => Promise<void>;
  apply: (command: Omit<Command, "baseRevision">) => Promise<boolean>;
  applyStyle: (command: StyleCommand) => Promise<boolean>;
}

export function useHostSession(): HostSession {
  const [status, setStatus] = useState<HostStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HostResult | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const next = await fetchResult("result");
      setResult(next);
      setStatus("live");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const apply = useCallback(
    async (command: Omit<Command, "baseRevision">) => {
      if (!result) return false;
      seq.current += 1;
      const requestId = `ui-${seq.current}`;
      setStatus("applying");
      try {
        const payload = await postCommand(
          { ...command, baseRevision: result.revision },
          requestId,
        );
        if (!payload.ok || !payload.result) {
          setStatus("error");
          setError(
            payload.error?.message || payload.error?.code || "apply failed",
          );
          return false;
        }
        setResult({
          ...payload.result,
          script: payload.result.script ?? payload.script ?? result.script,
        });
        setStatus("live");
        setError(null);
        return true;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [result],
  );

  const applyStyle = useCallback(async (command: StyleCommand) => {
    seq.current += 1;
    const requestId = `ui-${seq.current}`;
    setStatus("applying");
    try {
      const payload = await postStyle(command, requestId);
      if (!payload.ok || !payload.result) {
        setStatus("live");
        setError(
          payload.error?.message || payload.error?.code || "style failed",
        );
        return false;
      }
      setResult({
        ...payload.result,
        script: payload.result.script ?? payload.script,
      });
      setStatus("live");
      setError(null);
      return true;
    } catch (err) {
      setStatus("live");
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, error, result, reload, apply, applyStyle };
}
