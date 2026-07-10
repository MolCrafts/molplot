import type { VegaEmbed } from "../src/vega_loader";

/** A container element carrying a live count of its bound listeners. */
export type FakeContainer = HTMLElement & { listenerCount(): number };

/**
 * A container stub honouring the slice of the element contract `VegaChart`
 * relies on: it binds a wheel listener for axis-hover zoom and queries the
 * rendered `<svg>`. Headless runs never render, so `querySelector` returns null
 * and the handler bails. `dims()` supplies its own fallback size, so there is
 * no `getBoundingClientRect` to stub.
 *
 * The pointer classification itself is pure — see `axisChannelAt` — and is
 * tested directly rather than through this double.
 */
export function makeFakeContainer(): FakeContainer {
  const listeners = new Set<EventListener>();
  return {
    addEventListener: (_type: string, fn: EventListener) => {
      listeners.add(fn);
    },
    removeEventListener: (_type: string, fn: EventListener) => {
      listeners.delete(fn);
    },
    querySelector: () => null,
    listenerCount: () => listeners.size,
  } as unknown as FakeContainer;
}

/**
 * A stub vega-embed that records the spec it would render and the data pushed
 * into the view, and lets tests fire a synthetic click. Mirrors the old
 * `_fake_plotly.ts` — keeps chart-class lifecycle tests headless (no browser,
 * no real Vega runtime).
 */
export interface FakeVega {
  embed: VegaEmbed;
  specs: Record<string, unknown>[];
  data: Record<string, unknown[]>;
  click(datum: Record<string, unknown>): void;
  finalized: number;
}

export function makeFakeVega(): FakeVega {
  const state: FakeVega = {
    specs: [],
    data: {},
    finalized: 0,
    click: () => {},
    embed: async (_el, spec) => {
      state.specs.push(spec as Record<string, unknown>);
      const handlers: ((e: unknown, item: unknown) => void)[] = [];
      const view = {
        data(name: string, values?: unknown[]) {
          if (values !== undefined) state.data[name] = values;
          return view;
        },
        resize() {
          return { run: () => view };
        },
        run() {
          return view;
        },
        addEventListener(type: string, h: (e: unknown, item: unknown) => void) {
          if (type === "click") handlers.push(h);
        },
        finalize() {
          state.finalized += 1;
        },
      };
      state.click = (datum) => {
        for (const h of handlers) h({}, { datum });
      };
      // biome-ignore lint/suspicious/noExplicitAny: minimal fake of the embed Result
      return { view } as any;
    },
  };
  return state;
}
