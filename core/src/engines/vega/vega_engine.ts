import * as vega from "vega";
import { compile } from "vega-lite";
import {
  checkSetCommand,
  type Engine,
  fail,
  findNode,
  notImplemented,
  ok,
  renderResult,
} from "../../semantic/engine";
import type {
  ApplyResult,
  Command,
  ComponentName,
  Diagnostics,
  EditState,
  EngineId,
  Node,
  Scene,
  TraversalEntry,
  View,
} from "../../semantic/generated";
import { normalizeHex } from "../../semantic/hex";

type Spec = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function markDict(spec: Spec): {
  type?: string;
  color?: unknown;
  strokeWidth?: unknown;
} {
  const mark = spec.mark;
  if (typeof mark === "string") return { type: mark };
  if (mark && typeof mark === "object")
    return mark as { type?: string; color?: unknown; strokeWidth?: unknown };
  return {};
}

function encoding(spec: Spec): Record<string, Record<string, unknown>> {
  const enc = spec.encoding;
  if (enc && typeof enc === "object")
    return enc as Record<string, Record<string, unknown>>;
  return {};
}

function isFieldChannel(channel: Record<string, unknown> | undefined): boolean {
  return Boolean(channel && typeof channel.field === "string");
}

function titleText(spec: Spec): string | undefined {
  const title = spec.title;
  if (typeof title === "string") return title;
  if (title && typeof title === "object" && "text" in title) {
    const text = (title as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return undefined;
}

function layersOf(spec: Spec): Spec[] {
  const layers = spec.layer;
  if (Array.isArray(layers) && layers.length > 0) {
    return layers.map((layer) => {
      const unit = { ...spec, ...(layer as Spec) };
      delete unit.layer;
      return unit;
    });
  }
  return [spec];
}

/**
 * VegaEngine: the Vega-Lite spec is execution authority.
 * The Vega scenegraph is the render tree, never the Scene.
 */
export class VegaEngine implements Engine {
  readonly engineId: EngineId = "vega";
  private spec: Spec;
  private rev = 1;
  private view: vega.View | null = null;
  private diag: { traversal: TraversalEntry[] } = { traversal: [] };

  constructor(spec: Spec) {
    this.spec = clone(spec);
  }

  revision(): number {
    return this.rev;
  }

  reflect(): Scene {
    this.diag = { traversal: [] };
    const root = this.buildFigure(this.spec);
    return { engineId: "vega", root };
  }

  diagnostics(): Diagnostics {
    return this.diag;
  }

  async render(): Promise<View> {
    const view = await this.ensureView();
    const svg = await view.toSVG();
    return { kind: "svg", svg };
  }

  async apply(command: Command, requestId: string): Promise<ApplyResult> {
    if (command.type !== "set") return notImplemented(requestId, command.type);
    const err = checkSetCommand(this.reflect(), command, this.rev);
    if (err) return fail(requestId, err.code, err.message);
    const node = findNode(this.reflect().root, command.nodeId);
    if (!node) return fail(requestId, "unknown_node", command.nodeId);
    try {
      this.mutate(node.id, command.component, command.property, command.value);
    } catch (e) {
      return fail(
        requestId,
        "apply_failed",
        e instanceof Error ? e.message : String(e),
      );
    }
    this.view = null;
    this.rev += 1;
    return ok(requestId, await renderResult(this, requestId));
  }

  private note(
    ref: string,
    status: TraversalEntry["status"],
    nodeId?: string,
    detail?: string,
  ) {
    this.diag.traversal.push({ ref, status, nodeId, detail });
  }

  private buildFigure(spec: Spec): Node {
    this.note("spec:root", "represented", "figure/0");
    if (
      spec.facet ||
      spec.concat ||
      spec.hconcat ||
      spec.vconcat ||
      spec.repeat
    ) {
      this.note("spec:facet", "unsupported", undefined, "facet/concat/repeat");
    }
    const panel = this.buildPanel(spec, "figure/0/panel/0");
    const children: Node[] = [panel];
    const title = titleText(spec);
    if (title !== undefined) {
      children.push(this.buildTitle("figure/0/title", title));
    }
    return {
      id: "figure/0",
      role: "figure",
      label: "Figure",
      children,
      components: { geometry: { bbox: { x: 0, y: 0, w: 1, h: 1 } } },
      editability: {},
    };
  }

  private buildPanel(spec: Spec, id: string): Node {
    this.note("spec:unit", "represented", id);
    const children: Node[] = [];
    const enc = encoding(spec);
    if (enc.x) {
      children.push(this.buildAxis(id, "x"));
      this.note("spec:encoding.x", "represented", `${id}/axis/x`);
    }
    if (enc.y) {
      children.push(this.buildAxis(id, "y"));
      this.note("spec:encoding.y", "represented", `${id}/axis/y`);
    }
    const units = layersOf(spec);
    units.forEach((unit, i) => {
      children.push(this.buildSeries(unit, `${id}/series/${i}`, i));
    });
    if (isFieldChannel(enc.color) && enc.color.legend !== null) {
      const legendId = `${id}/legend`;
      this.note("spec:legend", "represented", legendId);
      children.push({
        id: legendId,
        role: "legend",
        label: "Legend",
        children: [],
        components: {},
        editability: {},
      });
    }
    return {
      id,
      role: "panel",
      label: "Panel",
      children,
      components: { geometry: { bbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } } },
      editability: {},
    };
  }

  private buildAxis(panelId: string, which: "x" | "y"): Node {
    return {
      id: `${panelId}/axis/${which}`,
      role: "axis",
      label: `${which} axis`,
      children: [],
      components: {},
      editability: {},
    };
  }

  private buildTitle(id: string, content: string): Node {
    this.note("spec:title", "represented", id);
    return {
      id,
      role: "title",
      label: "Title",
      children: [],
      components: { text: { content } },
      editability: { text: { content: "editable" } },
    };
  }

  private buildSeries(unit: Spec, id: string, index: number): Node {
    this.note(`spec:layer:${index}`, "represented", id, markDict(unit).type);
    const enc = encoding(unit);
    const mark = markDict(unit);
    const colorField = isFieldChannel(enc.color);
    const colorValue =
      typeof mark.color === "string"
        ? normalizeHex(mark.color)
        : typeof enc.color?.value === "string"
          ? normalizeHex(enc.color.value)
          : "#4c78a8";
    const width =
      typeof mark.strokeWidth === "number" ? mark.strokeWidth : undefined;
    const colorState: EditState = colorField ? "readonly" : "editable";
    const widthState: EditState =
      typeof mark.strokeWidth === "number" || !isFieldChannel(enc.strokeWidth)
        ? colorField
          ? "readonly"
          : "editable"
        : "readonly";
    const editability: Node["editability"] = {
      stroke: {
        color: colorState,
        width: widthState,
        opacity: "readonly",
        dash: "readonly",
      },
    };
    return {
      id,
      role: "series",
      label: `Series ${index}`,
      children: [],
      components: {
        stroke: { color: colorValue ?? undefined, width },
      },
      editability,
    };
  }

  private mutate(
    nodeId: string,
    component: ComponentName,
    property: string,
    value: unknown,
  ) {
    if (
      nodeId.endsWith("/title") &&
      component === "text" &&
      property === "content"
    ) {
      if (typeof this.spec.title === "object" && this.spec.title) {
        this.spec.title = { ...(this.spec.title as object), text: value };
      } else {
        this.spec.title = value;
      }
      return;
    }
    const match = nodeId.match(/series\/(\d+)$/);
    if (!match || component !== "stroke") {
      throw new Error(`no setter for ${nodeId} ${component}.${property}`);
    }
    const index = Number(match[1]);
    const units = layersOf(this.spec);
    const target = units[index] ?? this.spec;
    if (property === "color") {
      const hex = normalizeHex(value);
      if (!hex) throw new Error("color");
      const mark = target.mark;
      if (typeof mark === "string") target.mark = { type: mark, color: hex };
      else if (mark && typeof mark === "object") {
        target.mark = { ...(mark as object), color: hex };
      } else {
        target.mark = { color: hex };
      }
      const enc = encoding(target);
      if (enc.color && enc.color.value !== undefined) enc.color.value = hex;
      if (units.length > 1 && Array.isArray(this.spec.layer)) {
        this.spec.layer = units.map((unit, i) => (i === index ? target : unit));
      } else {
        Object.assign(this.spec, target);
      }
      return;
    }
    if (property === "width") {
      const width = value as number;
      const mark = target.mark;
      if (typeof mark === "string")
        target.mark = { type: mark, strokeWidth: width };
      else if (mark && typeof mark === "object") {
        target.mark = { ...(mark as object), strokeWidth: width };
      } else {
        target.mark = { strokeWidth: width };
      }
      if (units.length > 1 && Array.isArray(this.spec.layer)) {
        this.spec.layer = units.map((unit, i) => (i === index ? target : unit));
      } else {
        Object.assign(this.spec, target);
      }
      return;
    }
    throw new Error(`no setter for stroke.${property}`);
  }

  private async ensureView(): Promise<vega.View> {
    if (this.view) return this.view;
    // biome-ignore lint/suspicious/noExplicitAny: vega-lite compile accepts a TopLevelSpec
    const vg = compile(this.spec as any).spec;
    const runtime = vega.parse(vg);
    const view = new vega.View(runtime, { renderer: "none" });
    await view.runAsync();
    this.view = view;
    return view;
  }
}
