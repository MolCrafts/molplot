import type {
  ApplyResult,
  Command,
  RenderResult,
} from "@molcrafts/molplot/semantic";

export type ExportFormat = "pdf" | "svg" | "png";

export const EXPORT_FORMATS: readonly ExportFormat[] = ["pdf", "svg", "png"];

export interface PathPoint {
  x: number;
  y: number;
}

export interface DatasetColumn {
  name: string;
  values: number[];
}

export interface Dataset {
  nodeId: string;
  label: string;
  columns: DatasetColumn[];
}

export interface StyleItem {
  id: string;
  label: string;
}

export interface StyleSource {
  id: string;
  label: string;
  available: boolean;
  hint: string | null;
  styles: StyleItem[];
}

export interface CustomRc {
  figureWidth: number;
  figureHeight: number;
  dpi: number;
  figureFace: string;
  axesFace: string;
  axesEdge: string;
  axesLineWidth: number;
  grid: boolean;
  titleSize: number;
  labelSize: number;
  labelColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  textColor: string;
  usetex: boolean;
  lineWidth: number;
  lineStyle: string;
  markerSize: number;
  tickSize: number;
  tickDirection: string;
  tickColor: string;
  gridColor: string;
  gridStyle: string;
  gridWidth: number;
  gridAlpha: number;
  legendSize: number;
  legendFrame: boolean;
  cmap: string;
  savefigBbox: string;
  palette: string[];
}

export interface StyleState {
  current: { source: string; name: string };
  sources: StyleSource[];
  rc: CustomRc;
  latex?: { available: boolean; hint: string | null };
}

export interface StyleCommand {
  type: "style";
  source: string;
  name: string;
  rc?: CustomRc;
}

export interface HostResult extends RenderResult {
  script?: string;
  figureCount?: number;
  paths?: Record<string, PathPoint[]>;
  datasets?: Dataset[];
  style?: StyleState;
}

export interface HostApplyResult extends Omit<ApplyResult, "result"> {
  script?: string;
  result?: HostResult;
}

export function resultUrl(requestId = "result"): string {
  const query = new URLSearchParams({ requestId });
  return `/api/result?${query}`;
}

export function commandsUrl(): string {
  return "/api/commands";
}

export function exportUrl(
  fmt: ExportFormat,
  revision: number,
  download = false,
): string {
  const query = new URLSearchParams({ r: String(revision) });
  if (download) query.set("download", "true");
  return `/api/export/${fmt}?${query}`;
}

export async function fetchResult(requestId = "result"): Promise<HostResult> {
  const response = await fetch(resultUrl(requestId));
  if (!response.ok) {
    throw new Error(`result ${response.status}`);
  }
  return (await response.json()) as HostResult;
}

async function postHostCommand(
  command: Command | StyleCommand,
  requestId: string,
): Promise<HostApplyResult> {
  const response = await fetch(commandsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, command }),
  });
  if (!response.ok) {
    throw new Error(`commands ${response.status}`);
  }
  return (await response.json()) as HostApplyResult;
}

export async function postCommand(
  command: Command,
  requestId: string,
): Promise<HostApplyResult> {
  return postHostCommand(command, requestId);
}

export async function postStyle(
  command: StyleCommand,
  requestId: string,
): Promise<HostApplyResult> {
  return postHostCommand(command, requestId);
}

export function downloadExport(
  fmt: ExportFormat,
  revision: number,
  stem: string,
): void {
  const link = document.createElement("a");
  link.href = exportUrl(fmt, revision, true);
  link.download = `${stem}.${fmt}`;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
