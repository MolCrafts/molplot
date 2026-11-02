import type { Engine } from "./engine";
import {
  checkSetCommand,
  fail,
  notImplemented,
  ok,
  renderResult,
} from "./engine";
import type {
  Command,
  Diagnostics,
  Node,
  Scene,
  Stroke,
  View,
} from "./generated";
import { normalizeHex } from "./hex";

function series(
  id: string,
  label: string,
  stroke: Stroke,
  colorState: "editable" | "readonly",
): Node {
  return {
    id,
    role: "series",
    label,
    children: [],
    components: {
      stroke,
      geometry: { bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.4 } },
    },
    editability: {
      stroke: { color: colorState, width: colorState, opacity: "readonly" },
    },
  };
}

function titleNode(content: string): Node {
  return {
    id: "title-0",
    role: "title",
    label: "Title",
    children: [],
    components: {
      text: { content },
      geometry: { bbox: { x: 0.2, y: 0.02, w: 0.6, h: 0.08 } },
    },
    editability: { text: { content: "editable" } },
  };
}

/** In-memory Engine used to prove the contract without a backend. */
export class FakeEngine implements Engine {
  readonly engineId = "vega" as const;
  private rev = 1;
  private strokeColor = "#0c5da5";
  private strokeWidth = 1.5;
  private title = "Energy";
  private readonly readonlyColor = "#888888";

  revision(): number {
    return this.rev;
  }

  reflect(): Scene {
    return {
      engineId: this.engineId,
      root: {
        id: "figure-0",
        role: "figure",
        label: "Figure",
        children: [
          {
            id: "panel-0",
            role: "panel",
            label: "Panel",
            children: [
              series(
                "series-0",
                "Series: energy",
                { color: this.strokeColor, width: this.strokeWidth },
                "editable",
              ),
              series(
                "series-1",
                "Series: mapped",
                { color: this.readonlyColor, width: 1 },
                "readonly",
              ),
              titleNode(this.title),
            ],
            components: {},
            editability: {},
          },
        ],
        components: { geometry: { bbox: { x: 0, y: 0, w: 1, h: 1 } } },
        editability: {},
      },
    };
  }

  async render(): Promise<View> {
    return { kind: "svg", svg: `<svg data-revision="${this.rev}"/>` };
  }

  diagnostics(): Diagnostics {
    return {
      traversal: [
        { ref: "fake:figure", status: "represented", nodeId: "figure-0" },
        { ref: "fake:series-0", status: "represented", nodeId: "series-0" },
        { ref: "fake:series-1", status: "represented", nodeId: "series-1" },
        { ref: "fake:title", status: "represented", nodeId: "title-0" },
        { ref: "fake:spine", status: "consumed", nodeId: "panel-0" },
        { ref: "fake:patch", status: "internal" },
      ],
    };
  }

  async apply(command: Command, requestId: string) {
    if (command.type !== "set") {
      return notImplemented(requestId, command.type);
    }
    const err = checkSetCommand(this.reflect(), command, this.rev);
    if (err) return fail(requestId, err.code, err.message);
    try {
      if (command.nodeId === "series-0" && command.component === "stroke") {
        if (command.property === "color") {
          const hex = normalizeHex(command.value);
          if (!hex) return fail(requestId, "invalid_value", "color");
          this.strokeColor = hex;
        } else if (command.property === "width") {
          this.strokeWidth = command.value as number;
        }
      } else if (
        command.nodeId === "title-0" &&
        command.component === "text" &&
        command.property === "content"
      ) {
        this.title = command.value as string;
      } else {
        return fail(requestId, "apply_failed", "unhandled set");
      }
    } catch (e) {
      return fail(
        requestId,
        "apply_failed",
        e instanceof Error ? e.message : String(e),
      );
    }
    this.rev += 1;
    return ok(requestId, await renderResult(this, requestId));
  }
}
