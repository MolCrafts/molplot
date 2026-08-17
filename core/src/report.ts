/**
 * Shared error-boundary helper. Docs `<molplot-chart>` and imperative chart
 * classes both render asynchronously; a rejected promise with no listener is
 * an empty host and no console line. Always go through here.
 */
export function reportMolplotError(
  scope: string,
  cause: unknown,
  extra?: unknown,
): Error {
  const error = cause instanceof Error ? cause : new Error(String(cause));
  if (typeof console !== "undefined" && typeof console.error === "function") {
    if (extra === undefined) console.error(`[molplot] ${scope}`, error);
    else console.error(`[molplot] ${scope}`, error, extra);
  }
  return error;
}

/** Fire-and-forget a render so a rejection is logged instead of swallowed. */
export function trackRender(scope: string, run: Promise<void>): void {
  void run.catch((cause: unknown) => {
    reportMolplotError(scope, cause);
  });
}
