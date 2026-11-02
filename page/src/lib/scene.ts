import type {
  BBox,
  ComponentName,
  EditState,
  Node,
  Role,
} from "@molcrafts/molplot/semantic";

export interface WalkedNode {
  node: Node;
  depth: number;
}

export function walk(node: Node, depth = 0): WalkedNode[] {
  const out: WalkedNode[] = [{ node, depth }];
  for (const child of node.children) {
    out.push(...walk(child, depth + 1));
  }
  return out;
}

export function findNode(root: Node, id: string): Node | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Root-to-leaf path that includes `id`. Empty if the id is missing. */
export function nodePath(root: Node, id: string): Node[] {
  const path: Node[] = [];
  const visit = (node: Node): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children) {
      if (visit(child)) return true;
    }
    path.pop();
    return false;
  };
  return visit(root) ? path : [];
}

export function findByRole(root: Node, role: Role): Node[] {
  return walk(root)
    .filter((item) => item.node.role === role)
    .map((item) => item.node);
}

export function bboxOf(node: Node): BBox | undefined {
  return node.components.geometry?.bbox;
}

export function canMove(node: Node): boolean {
  return editState(node, "geometry", "bbox") === "editable";
}

export function editState(
  node: Node,
  component: ComponentName,
  property: string,
): EditState | undefined {
  return node.editability[component]?.[property];
}

export function nodeTitle(node: Node): string {
  return node.label || node.components.text?.content || node.id;
}

export function defaultSelection(root: Node): string {
  const series = findByRole(root, "series");
  if (series[0]) return series[0].id;
  const legend = findByRole(root, "legend");
  if (legend[0]) return legend[0].id;
  return root.id;
}

export function scriptStem(script: string | undefined): string {
  if (!script) return "figure";
  const name = script.split(/[/\\]/).pop() || "figure";
  return name.replace(/\.py$/i, "") || "figure";
}
