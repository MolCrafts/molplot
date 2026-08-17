import { describe, expect, it } from "@rstest/core";
import { reportMolplotError, trackRender } from "../src/report";

function withConsoleError(run: (calls: unknown[][]) => void | Promise<void>) {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  const restore = () => {
    console.error = original;
  };
  try {
    const out = run(calls);
    if (out && typeof (out as Promise<void>).then === "function") {
      return (out as Promise<void>).finally(restore);
    }
    restore();
    return out;
  } catch (cause) {
    restore();
    throw cause;
  }
}

describe("reportMolplotError", () => {
  it("prints a tagged console.error and returns an Error", () => {
    withConsoleError((calls) => {
      const cause = new Error("Duplicate signal name");
      const err = reportMolplotError("failed to render", cause, { tag: "x" });
      expect(err).toBe(cause);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe("[molplot] failed to render");
      expect(calls[0][1]).toBe(cause);
      expect(calls[0][2]).toEqual({ tag: "x" });
    });
  });

  it("wraps a non-Error rejection so the console still gets a stackable Error", () => {
    withConsoleError((calls) => {
      const err = reportMolplotError("failed to render", "chunk 404");
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("chunk 404");
      expect(calls[0][0]).toBe("[molplot] failed to render");
      expect(calls[0][1]).toBe(err);
    });
  });
});

describe("trackRender", () => {
  it("logs a rejected render instead of leaving an unhandled rejection", async () => {
    await withConsoleError(async (calls) => {
      trackRender("failed to resize", Promise.reject(new Error("view gone")));
      await Promise.resolve();
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe("[molplot] failed to resize");
      expect((calls[0][1] as Error).message).toBe("view gone");
    });
  });
});
