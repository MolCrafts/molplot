import { parseBBox } from "./bbox";
import {
  APPLY_ERROR_CODES,
  type ApplyError,
  type ApplyResult,
  COMPONENT_NAMES,
  type Command,
  type ComponentName,
  type Diagnostics,
  type EngineId,
  type Node,
  type RenderResult,
  type Scene,
  type View,
} from "./generated";
import { isFiniteNumber, normalizeHex } from "./hex";
import {
  parseBool,
  parseDash,
  parseName,
  parseOpacity,
  parseSize,
  parseTickLabels,
  parseTicks,
} from "./values";

export type {
  ApplyError,
  ApplyResult,
  Command,
  Diagnostics,
  EngineId,
  Node,
  RenderResult,
  Scene,
  View,
};

const COMPONENT_SET = new Set<string>(COMPONENT_NAMES);
const ERROR_SET = new Set<string>(APPLY_ERROR_CODES);

export interface Engine {
  readonly engineId: EngineId;
  revision(): number;
  reflect(): Scene;
  render(): Promise<View>;
  diagnostics(): Diagnostics;
  apply(command: Command, requestId: string): Promise<ApplyResult>;
}

export function findNode(root: Node, id: string): Node | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

export function findByRole(root: Node, role: Node["role"]): Node[] {
  const out: Node[] = [];
  const walk = (n: Node) => {
    if (n.role === role) out.push(n);
    for (const child of n.children) walk(child);
  };
  walk(root);
  return out;
}

export function fail(
  requestId: string,
  code: ApplyError["code"],
  message: string,
): ApplyResult {
  if (!ERROR_SET.has(code)) throw new Error(`unknown apply error ${code}`);
  return { requestId, ok: false, error: { code, message } };
}

export function ok(requestId: string, result: RenderResult): ApplyResult {
  return { requestId, ok: true, result };
}

export async function renderResult(
  engine: Engine,
  requestId: string,
): Promise<RenderResult> {
  const scene = engine.reflect();
  const view = await engine.render();
  return {
    requestId,
    revision: engine.revision(),
    scene,
    view,
    diagnostics: engine.diagnostics(),
  };
}

export function notImplemented(
  requestId: string,
  what = "realize",
): ApplyResult {
  return fail(requestId, "not_implemented", `${what} is not implemented in v0`);
}

/** Shared Set-command gates. Returns an error, or null if the engine may mutate. */
export function checkSetCommand(
  scene: Scene,
  command: Command,
  revision: number,
): ApplyError | null {
  if (command.type !== "set") {
    return {
      code: "unknown_property",
      message: `unsupported command ${command.type}`,
    };
  }
  if (command.baseRevision !== revision) {
    return {
      code: "stale_revision",
      message: `baseRevision ${command.baseRevision} != ${revision}`,
    };
  }
  if (!COMPONENT_SET.has(command.component)) {
    return {
      code: "unknown_component",
      message: `unknown component ${command.component}`,
    };
  }
  const node = findNode(scene.root, command.nodeId);
  if (!node) {
    return { code: "unknown_node", message: `unknown node ${command.nodeId}` };
  }
  const props = node.editability[command.component as ComponentName];
  const state = props?.[command.property];
  if (state === undefined) {
    return {
      code: "unknown_property",
      message: `${command.component}.${command.property} is not on this node`,
    };
  }
  if (state !== "editable") {
    return {
      code: "not_editable",
      message: `${command.component}.${command.property} is ${state}`,
    };
  }
  if (command.property === "color") {
    if (normalizeHex(command.value) === null) {
      return { code: "invalid_value", message: "color must be #rrggbb" };
    }
  }
  if (command.property === "width" && parseSize(command.value) === null) {
    return {
      code: "invalid_value",
      message: "width must be a positive finite number",
    };
  }
  if (command.property === "content" && typeof command.value !== "string") {
    return { code: "invalid_value", message: "text content must be a string" };
  }
  if (command.property === "bbox" && parseBBox(command.value) === null) {
    return {
      code: "invalid_value",
      message: "bbox must be {x,y,w,h} with positive finite sizes",
    };
  }
  if (command.property === "dash" && parseDash(command.value) === null) {
    return {
      code: "invalid_value",
      message: "dash must be a list of non-negative numbers",
    };
  }
  if (command.property === "opacity" && parseOpacity(command.value) === null) {
    return {
      code: "invalid_value",
      message: "opacity must be a number in [0, 1]",
    };
  }
  if (command.property === "size" && parseSize(command.value) === null) {
    return {
      code: "invalid_value",
      message: "size must be a positive finite number",
    };
  }
  if (
    (command.property === "family" ||
      command.property === "weight" ||
      command.property === "style" ||
      command.property === "shape") &&
    parseName(command.value) === null
  ) {
    return {
      code: "invalid_value",
      message: `${command.property} must be a non-empty string`,
    };
  }
  if (command.property === "visible" && parseBool(command.value) === null) {
    return { code: "invalid_value", message: "visible must be a boolean" };
  }
  if (command.property === "zIndex" && !isFiniteNumber(command.value)) {
    return { code: "invalid_value", message: "zIndex must be a finite number" };
  }
  if (command.property === "height" && parseSize(command.value) === null) {
    return {
      code: "invalid_value",
      message: "height must be a positive finite number",
    };
  }
  if (
    (command.property === "xMin" ||
      command.property === "xMax" ||
      command.property === "yMin" ||
      command.property === "yMax") &&
    !isFiniteNumber(command.value)
  ) {
    return {
      code: "invalid_value",
      message: `${command.property} must be a finite number`,
    };
  }
  if (command.component === "axis") {
    if (
      (command.property === "min" || command.property === "max") &&
      !isFiniteNumber(command.value)
    ) {
      return {
        code: "invalid_value",
        message: `${command.property} must be a finite number`,
      };
    }
    if (command.property === "ticks" && parseTicks(command.value) === null) {
      return {
        code: "invalid_value",
        message: "ticks must be a list of finite numbers",
      };
    }
    if (
      command.property === "tickLabels" &&
      parseTickLabels(command.value) === null
    ) {
      return {
        code: "invalid_value",
        message: "tickLabels must be a list of strings",
      };
    }
    if (
      (command.property === "format" || command.property === "scale") &&
      parseName(command.value) === null
    ) {
      return {
        code: "invalid_value",
        message: `${command.property} must be a non-empty string`,
      };
    }
  }
  return null;
}
