"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { type NivelPresupuesto } from "@/services/gestionPresupuesto";
import { actualizarContextoCodigoPresupuesto } from "@/services/presupuesto";

const LEVEL_BG = [
  "bg-white/85 hover:bg-white",
  "bg-[#f3fbf8] hover:bg-[#edf8f4]",
  "bg-[#edf8f4] hover:bg-[#e6f5ef]",
  "bg-[#e6f5ef] hover:bg-[#def1ea]",
  "bg-[#def1ea] hover:bg-[#d6ece4]",
  "bg-[#d6ece4] hover:bg-[#cee7de]",
];

const FINANCIAL_PANEL_WIDTH = "min-w-[640px]";
const KPI_CARD_WIDTH = "w-[118px]";

type BudgetNodeData = {
  id: string;
  name: string;
  level: string;
  meta?: {
    codigo_presupuestario?: string | null;
    programa_id?: string | number | null;
    sub_programa_id?: string | number | null;
    proyecto_id?: string | number | null;
    actividad_id?: string | number | null;
    obra_id?: string | number | null;
    contexto_cxp?: string | null;
  };
  kpis?: {
    vigente?: number;
    ejecutado?: number;
    comprometido?: number;
  };
  children?: Map<string, BudgetNodeData>;
  expandedBySearch?: boolean;
  matchedBySearch?: boolean;
  expandedByEmergency?: boolean;
};

type TreeLevel =
  | "programa"
  | "subprograma"
  | "proyecto"
  | "actividad"
  | "obra"
  | "codigo";

type CreateRequest = {
  nivel: NivelPresupuesto;
};

type TreeOpenState = Record<string, boolean | undefined>;

type EditorContextoCodigo = {
  codigo: string;
  nombre: string;
  contexto: string;
};

export type SolicitudModificacionPresupuesto = {
  codigo: string;
  nombre: string;
  tipo: "ampliacion" | "disminucion";
};

const NEXT_LEVEL_BY_NODE_LEVEL: Partial<Record<TreeLevel, NivelPresupuesto>> = {
  programa: "SubPrograma",
  subprograma: "Proyecto",
  proyecto: "Actividad",
  actividad: "Obra",
  obra: "Codigo",
};

const LABELS: Record<NivelPresupuesto, string> = {
  Programa: "Programa",
  SubPrograma: "Subprograma",
  Proyecto: "Proyecto",
  Actividad: "Actividad",
  Obra: "Obra",
  Codigo: "Codigo presupuestario",
};

const EXPORT_LEVELS: TreeLevel[] = [
  "programa",
  "subprograma",
  "proyecto",
  "actividad",
  "obra",
  "codigo",
];

const EXPORT_HEADERS = [
  "Programa",
  "Subprograma",
  "Proyecto",
  "Actividad",
  "Obra",
  "Codigo presupuestario",
  "Nivel",
  "Nombre",
  "Vigente",
  "Ejecutado",
  "Comprometido",
  "Saldo",
  "Disponible %",
];

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactMoney(value: number) {
  return `L ${Number(value ?? 0).toLocaleString("es-HN", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;
}

function formatPercent(value: number | null) {
  if (value === null) return "N/D";

  return `${value.toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function getDepthBackground(depth: number) {
  return LEVEL_BG[Math.min(depth, LEVEL_BG.length - 1)];
}

function getHierarchyBackgroundClass(node: BudgetNodeData) {
  if (node.matchedBySearch) return "bg-[#2dd4bf]";
  if (node.expandedBySearch) return "bg-[#e8f8f2]";
  return "";
}

function getSaldoClass(value: number) {
  if (value < 0) return "text-rose-700 font-semibold";
  if (value > 0) return "text-slate-900 font-semibold";
  return "text-slate-500";
}

function getNivelLabel(depth: number) {
  return depth === 0 ? "Nivel raíz" : `Nivel ${depth + 1}`;
}

function getNodeSortKey(node: BudgetNodeData) {
  return String(node.meta?.codigo_presupuestario ?? node.id ?? node.name ?? "");
}

function sortBudgetNodes(nodes: BudgetNodeData[]) {
  return [...nodes].sort((a, b) =>
    getNodeSortKey(a).localeCompare(getNodeSortKey(b), "es-HN", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function sanitizeCell(value: unknown) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

function formatNumberForExcel(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function getNodePathKey(node: BudgetNodeData, parentPathKey = "") {
  const part = `${node.level}:${node.id}`;
  return parentPathKey ? `${parentPathKey}/${part}` : part;
}

function isNodeVisibleOpen({
  node,
  pathKey,
  expandAll,
  openState,
}: {
  node: BudgetNodeData;
  pathKey: string;
  expandAll: boolean;
  openState: TreeOpenState;
}) {
  const forcedOpen =
    expandAll || Boolean(node.expandedBySearch || node.expandedByEmergency);

  return openState[pathKey] ?? forcedOpen;
}

function buildTreeClipboardText({
  tree,
  expandAll,
  openState,
}: {
  tree: Map<string, BudgetNodeData>;
  expandAll: boolean;
  openState: TreeOpenState;
}) {
  const rows = [EXPORT_HEADERS.join("\t")];

  function visit(
    node: BudgetNodeData,
    path: Partial<Record<TreeLevel, string>>,
    parentPathKey = ""
  ) {
    const pathKey = getNodePathKey(node, parentPathKey);
    const nextPath = {
      ...path,
      [node.level as TreeLevel]: node.name,
    };
    const { vigente, ejecutado, comprometido, saldo } = getFinancials(node);
    const disponible = getPorcentajeDisponible({ saldo, vigente });

    rows.push(
      [
        ...EXPORT_LEVELS.map((level) => sanitizeCell(nextPath[level] ?? "")),
        sanitizeCell(node.level),
        sanitizeCell(node.name),
        formatNumberForExcel(vigente),
        formatNumberForExcel(ejecutado),
        formatNumberForExcel(comprometido),
        formatNumberForExcel(saldo),
        disponible === null ? "" : formatNumberForExcel(disponible),
      ].join("\t")
    );

    if (
      !isNodeVisibleOpen({
        node,
        pathKey,
        expandAll,
        openState,
      })
    ) {
      return;
    }

    for (const child of sortBudgetNodes(
      Array.from(node.children?.values?.() ?? [])
    )) {
      visit(child, nextPath, pathKey);
    }
  }

  for (const node of sortBudgetNodes(Array.from(tree.values()))) {
    visit(node, {});
  }

  return rows.join("\n");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function getFinancials(node: BudgetNodeData) {
  const vigente = Number(node.kpis?.vigente ?? 0);
  const ejecutado = Number(node.kpis?.ejecutado ?? 0);
  const comprometido = Number(node.kpis?.comprometido ?? 0);
  const saldo = vigente - ejecutado - comprometido;

  return {
    vigente,
    ejecutado,
    comprometido,
    saldo,
  };
}

function getPorcentajeDisponible({
  saldo,
  vigente,
}: {
  saldo: number;
  vigente: number;
}) {
  if (!vigente || vigente <= 0) return null;

  return (saldo / vigente) * 100;
}

function isEmergencyNode(node: BudgetNodeData) {
  const { saldo } = getFinancials(node);
  const isCodigo = node.level === "codigo";

  if (!isCodigo) return false;

  return saldo < 0;
}

function filterEmergencyTree(tree: Map<string, BudgetNodeData>) {
  const result = new Map<string, BudgetNodeData>();

  for (const [key, node] of tree.entries()) {
    const filteredChildren = filterEmergencyTree(node.children ?? new Map());
    const emergency = isEmergencyNode(node);

    if (emergency || filteredChildren.size > 0) {
      result.set(key, {
        ...node,
        expandedByEmergency: true,
        children: filteredChildren,
      });
    }
  }

  return result;
}

function countEmergencyNodes(tree: Map<string, BudgetNodeData>) {
  let total = 0;

  for (const node of tree.values()) {
    if (isEmergencyNode(node)) {
      total += 1;
    }

    total += countEmergencyNodes(node.children ?? new Map());
  }

  return total;
}

function countExpandableNodes(tree: Map<string, BudgetNodeData>) {
  let total = 0;

  for (const node of tree.values()) {
    const children = node.children ?? new Map();

    if (children.size > 0) {
      total += 1;
    }

    total += countExpandableNodes(children);
  }

  return total;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mixColor(
  colorA: [number, number, number],
  colorB: [number, number, number],
  weight: number
) {
  const w = clamp(weight, 0, 1);

  const r = Math.round(colorA[0] + (colorB[0] - colorA[0]) * w);
  const g = Math.round(colorA[1] + (colorB[1] - colorA[1]) * w);
  const b = Math.round(colorA[2] + (colorB[2] - colorA[2]) * w);

  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToRgba(rgb: string, alpha: number) {
  return rgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
}

function getDisponibleStyle(porcentaje: number | null): CSSProperties {
  if (porcentaje === null) {
    return {
      backgroundColor: "rgba(148, 163, 184, 0.14)",
      borderColor: "rgba(148, 163, 184, 0.45)",
      color: "rgb(71, 85, 105)",
    };
  }

  if (porcentaje < 0) {
    return {
      backgroundColor: "rgba(225, 29, 72, 0.14)",
      borderColor: "rgba(225, 29, 72, 0.55)",
      color: "rgb(159, 18, 57)",
    };
  }

  const normalized = clamp(porcentaje, 0, 100) / 100;

  const red: [number, number, number] = [225, 29, 72];
  const green: [number, number, number] = [0, 190, 135];

  const color = mixColor(red, green, normalized);

  return {
    backgroundColor: rgbToRgba(color, 0.14),
    borderColor: rgbToRgba(color, 0.55),
    color,
  };
}

function BudgetNode({
  node,
  pathKey,
  depth = 0,
  expandAll,
  openState,
  onToggleNode,
  onExitExpandAll,
  onSolicitarModificacion,
  onSolicitarCreacion,
  onEditarContexto,
}: {
  node: BudgetNodeData;
  pathKey: string;
  depth?: number;
  expandAll: boolean;
  openState: TreeOpenState;
  onToggleNode: (pathKey: string, open: boolean) => void;
  onExitExpandAll: () => void;
  onSolicitarModificacion?: (solicitud: SolicitudModificacionPresupuesto) => void;
  onSolicitarCreacion?: (request: CreateRequest) => void;
  onEditarContexto: (editor: EditorContextoCodigo) => void;
}) {
  const children = sortBudgetNodes(Array.from(node.children?.values?.() ?? []));
  const hasChildren = children.length > 0;

  const { vigente, ejecutado, comprometido, saldo } = getFinancials(node);

  const porcentajeDisponible = getPorcentajeDisponible({
    saldo,
    vigente,
  });

  const emergency = isEmergencyNode(node);
  const visibleOpen = isNodeVisibleOpen({
    node,
    pathKey,
    expandAll,
    openState,
  });
  const isCodigo = node.level === "codigo";
  const siguienteNivel = NEXT_LEVEL_BY_NODE_LEVEL[node.level as TreeLevel];
  const codigoPresupuestario = String(
    node.meta?.codigo_presupuestario ?? node.id ?? ""
  ).trim();

  function toggle() {
    if (!hasChildren) return;
    if (expandAll) onExitExpandAll();
    onToggleNode(pathKey, !visibleOpen);
  }

  function solicitarAmpliacion() {
    onSolicitarModificacion?.({
      codigo: codigoPresupuestario,
      nombre: node.name,
      tipo: "ampliacion",
    });
  }

  function solicitarDisminucion() {
    onSolicitarModificacion?.({
      codigo: codigoPresupuestario,
      nombre: node.name,
      tipo: "disminucion",
    });
  }

  function solicitarCreacion() {
    if (!siguienteNivel) return;
    onSolicitarCreacion?.({ nivel: siguienteNivel });
  }

  function editarContexto() {
    onEditarContexto({
      codigo: codigoPresupuestario,
      nombre: node.name,
      contexto: String(node.meta?.contexto_cxp ?? ""),
    });
  }

  return (
    <div className="relative">
      {depth > 0 && (
        <span className="absolute -left-1.5 top-5 h-px w-1.5 bg-emerald-300 xl:hidden" />
      )}

      {/* TARJETA MÓVIL */}
      <div
        onClick={toggle}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(event) => {
          if (!hasChildren) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        className={[
          "overflow-hidden rounded-lg border bg-white shadow-sm transition xl:hidden",
          hasChildren ? "cursor-pointer" : "cursor-default",
          node.matchedBySearch
            ? "border-teal-600 ring-2 ring-teal-600/20"
            : node.expandedByEmergency || emergency
            ? "border-rose-300"
            : visibleOpen
            ? "border-emerald-300"
            : "border-slate-200",
        ].join(" ")}
      >
        <div
          className={[
            "border-l-[3px] px-2.5 py-2",
            depth === 0
              ? "border-l-teal-700"
              : isCodigo
              ? "border-l-amber-500"
              : "border-l-emerald-400",
            getHierarchyBackgroundClass(node),
          ].join(" ")}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
                  {node.level}
                </span>

                {hasChildren && (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">
                    {children.length} {children.length === 1 ? "hijo" : "hijos"}
                  </span>
                )}

                {node.matchedBySearch && (
                  <span className="rounded-full bg-teal-700 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-white">
                    Coincidencia
                  </span>
                )}

                {emergency && (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-rose-700">
                    Emergencia
                  </span>
                )}

                {isCodigo && (
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em]",
                      node.meta?.contexto_cxp
                        ? "bg-teal-50 text-teal-700"
                        : "bg-amber-50 text-amber-700",
                    ].join(" ")}
                  >
                    {node.meta?.contexto_cxp ? "IA lista" : "IA pendiente"}
                  </span>
                )}
              </div>

              <h3 className="mt-1 break-words text-[12px] font-bold leading-snug text-slate-950">
                {node.name}
              </h3>

              {isCodigo && codigoPresupuestario && (
                <div className="mt-0.5 break-all font-mono text-[9px] font-semibold text-slate-500">
                  {codigoPresupuestario}
                </div>
              )}
            </div>

            {hasChildren && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle();
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-lg font-medium text-emerald-800 active:bg-emerald-100"
                aria-label={visibleOpen ? "Contraer grupo" : "Expandir grupo"}
                aria-expanded={visibleOpen}
              >
                {visibleOpen ? "−" : "+"}
              </button>
            )}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
            <MobileMetric
              label="Vigente"
              value={formatCompactMoney(vigente)}
              fullValue={formatMoney(vigente)}
            />
            <MobileMetric
              label="Ejecutado"
              value={formatCompactMoney(ejecutado)}
              fullValue={formatMoney(ejecutado)}
            />
            <MobileMetric
              label="Comprom."
              value={formatCompactMoney(comprometido)}
              fullValue={formatMoney(comprometido)}
            />
            <MobileMetric
              label="Saldo"
              value={formatCompactMoney(saldo)}
              fullValue={formatMoney(saldo)}
              valueClass={getSaldoClass(saldo)}
            />
          </div>

          <div
            style={getDisponibleStyle(porcentajeDisponible)}
            className="mt-1.5 flex items-center justify-between rounded-md border px-2 py-1"
          >
            <span className="text-[8px] font-bold uppercase tracking-[0.12em]">
              Disponible
            </span>
            <span className="text-[12px] font-black tabular-nums">
              {formatPercent(porcentajeDisponible)}
            </span>
          </div>

          <MobileRowActions
            isCodigo={isCodigo}
            codigoVisible={Boolean(codigoPresupuestario)}
            siguienteNivel={siguienteNivel}
            tieneContexto={Boolean(node.meta?.contexto_cxp)}
            onAmpliar={solicitarAmpliacion}
            onDisminuir={solicitarDisminucion}
            onCrear={solicitarCreacion}
            onEditarContexto={editarContexto}
          />
        </div>
      </div>

      {/* FILA DE ESCRITORIO */}
      <div
        onClick={toggle}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(e) => {
          if (!hasChildren) return;

          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={[
          "relative hidden border-b border-slate-200 transition-colors xl:block",
          getDepthBackground(depth),
          hasChildren ? "cursor-pointer" : "cursor-default",
          node.matchedBySearch
            ? "border-l-4 border-l-[#0f766e] ring-1 ring-inset ring-[#0f766e]/45"
            : node.expandedBySearch
            ? "border-l-2 border-l-[#00be87]"
            : node.expandedByEmergency
            ? "border-l-2 border-l-rose-500"
            : visibleOpen
            ? "border-l-2 border-l-[#00be87]/70"
            : "border-l-2 border-l-transparent",
        ].join(" ")}
      >
        <div className="grid min-h-[50px] grid-cols-[1fr_auto]">
          {/* INFORMACIÓN DEL GRUPO */}
          <div
            className={[
              "flex min-w-0 items-center transition-colors",
              getHierarchyBackgroundClass(node),
            ].join(" ")}
          >
            {/* CONTROL */}
            <div className="flex h-full w-[42px] shrink-0 items-center justify-center border-r border-slate-200">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="h-6 w-6 border border-slate-300 bg-white/80 text-[14px] leading-none text-slate-700 transition hover:border-[#00be87] hover:bg-white"
                  title={visibleOpen ? "Contraer grupo" : "Expandir grupo"}
                >
                  {visibleOpen ? "-" : "+"}
                </button>
              ) : (
                <span className="h-1.5 w-1.5 bg-slate-400" />
              )}
            </div>

            {/* CONTENIDO JERÁRQUICO */}
            <div
              className="relative flex min-w-0 flex-1 items-center px-3 py-2"
              style={{ paddingLeft: `${14 + depth * 30}px` }}
            >
              {depth > 0 && (
                <span
                  className="absolute top-1/2 h-px bg-[#00be87]/30"
                  style={{
                    left: `${depth * 30 - 12}px`,
                    width: "22px",
                  }}
                />
              )}

              {depth > 0 && (
                <span
                  className="absolute bottom-0 top-0 w-px bg-[#00be87]/20"
                  style={{
                    left: `${depth * 30 - 12}px`,
                  }}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div
                    className="min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-snug text-slate-950"
                    title={node.name}
                  >
                    {node.name}
                  </div>

                  {hasChildren && (
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {children.length} subniveles
                    </span>
                  )}

                  {node.matchedBySearch && (
                    <span className="shrink-0 border border-[#0f766e] bg-[#0f766e] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                      Coincidencia
                    </span>
                  )}

                  {emergency && (
                    <span className="shrink-0 border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                      Emergencia
                    </span>
                  )}

                  {isCodigo && (
                    <span
                      className={[
                        "shrink-0 border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]",
                        node.meta?.contexto_cxp
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700",
                      ].join(" ")}
                    >
                      {node.meta?.contexto_cxp
                        ? "Contexto IA"
                        : "Sin contexto IA"}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <span>{node.level}</span>
                  <span className="text-slate-400">/</span>
                  <span>{getNivelLabel(depth)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div
            className={[
              "flex items-stretch justify-end border-l border-slate-200 text-[11px]",
              FINANCIAL_PANEL_WIDTH,
            ].join(" ")}
          >
            <div className="flex flex-1 items-center justify-end gap-5 px-3 py-2">
              <InlineMetric label="Vigente" value={formatMoney(vigente)} />

              <InlineMetric
                label="Ejecutado"
                value={formatMoney(ejecutado)}
              />

              <InlineMetric
                label="Comprometido"
                value={formatMoney(comprometido)}
              />

              <InlineMetric
                label="Saldo"
                value={formatMoney(saldo)}
                valueClass={getSaldoClass(saldo)}
              />
            </div>

            <DisponibleCard
              value={formatPercent(porcentajeDisponible)}
              porcentaje={porcentajeDisponible}
            />

            <RowActions
              isCodigo={isCodigo}
              codigoVisible={Boolean(codigoPresupuestario)}
              siguienteNivel={siguienteNivel}
              onAmpliar={solicitarAmpliacion}
              onDisminuir={solicitarDisminucion}
              onCrear={solicitarCreacion}
              tieneContexto={Boolean(node.meta?.contexto_cxp)}
              onEditarContexto={editarContexto}
            />
          </div>
        </div>
      </div>

      {/* HIJOS */}
      {visibleOpen && hasChildren && (
        <div className="relative ml-1.5 mt-1.5 space-y-1.5 border-l border-emerald-200 pl-1.5 xl:ml-0 xl:mt-0 xl:space-y-0 xl:border-l-0 xl:pl-0">
          {children.map((child) => (
            <BudgetNode
              key={child.id}
              node={child}
              pathKey={getNodePathKey(child, pathKey)}
              depth={depth + 1}
              expandAll={expandAll}
              openState={openState}
              onToggleNode={onToggleNode}
              onExitExpandAll={onExitExpandAll}
              onSolicitarModificacion={onSolicitarModificacion}
              onSolicitarCreacion={onSolicitarCreacion}
              onEditarContexto={onEditarContexto}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PresupuestoTree({
  tree,
  onSolicitarModificacion,
  onSolicitarCreacion,
  onContextoActualizado,
}: {
  tree: Map<string, BudgetNodeData>;
  onSolicitarModificacion?: (solicitud: SolicitudModificacionPresupuesto) => void;
  onSolicitarCreacion?: (request: CreateRequest) => void;
  onContextoActualizado?: () => void | Promise<void>;
}) {
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [treeRenderVersion, setTreeRenderVersion] = useState(0);
  const [openState, setOpenState] = useState<TreeOpenState>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [editorContexto, setEditorContexto] =
    useState<EditorContextoCodigo | null>(null);
  const [guardandoContexto, setGuardandoContexto] = useState(false);
  const [errorContexto, setErrorContexto] = useState("");

  const emergencyCount = useMemo(() => countEmergencyNodes(tree), [tree]);

  const visibleTree = useMemo(() => {
    if (!emergencyMode) return tree;
    return filterEmergencyTree(tree);
  }, [tree, emergencyMode]);

  const nodes = sortBudgetNodes(Array.from(visibleTree.values()));
  const expandableCount = useMemo(
    () => countExpandableNodes(visibleTree),
    [visibleTree]
  );
  function contraerTodo() {
    setExpandAll(false);
    setOpenState({});
    setTreeRenderVersion((version) => version + 1);
  }

  function handleToggleNode(pathKey: string, open: boolean) {
    setOpenState((current) => ({
      ...current,
      [pathKey]: open,
    }));
  }

  async function copiarArbol() {
    try {
      await copyTextToClipboard(
        buildTreeClipboardText({
          tree: visibleTree,
          expandAll,
          openState,
        })
      );
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2200);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  }

  async function guardarContexto() {
    if (!editorContexto) return;

    setGuardandoContexto(true);
    setErrorContexto("");

    try {
      await actualizarContextoCodigoPresupuesto({
        codigo: editorContexto.codigo,
        contexto: editorContexto.contexto,
      });
      await onContextoActualizado?.();
      setEditorContexto(null);
    } catch (error) {
      setErrorContexto(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el contexto presupuestario."
      );
    } finally {
      setGuardandoContexto(false);
    }
  }

  return (
    <div className="flex h-auto touch-pan-y flex-col overflow-visible bg-slate-100/75 text-slate-800 backdrop-blur-xl xl:h-full xl:overflow-hidden xl:border xl:border-slate-300 xl:bg-white/65">
      {/* HEADER */}
      <div className="operational-header shrink-0">
        <div className="block min-h-[48px] xl:grid xl:grid-cols-[1fr_auto]">
          {/* ENCABEZADO COMPACTO MÓVIL */}
          <div className="xl:hidden">
            <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-slate-950">
                  Estructura programática
                </div>
                <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.1em] text-slate-500">
                  {nodes.length} raíz · {expandableCount} grupos · {emergencyCount} alertas
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileToolsOpen((current) => !current)}
                aria-expanded={mobileToolsOpen}
                className="min-h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700"
              >
                {mobileToolsOpen ? "Minimizar" : "Opciones"}
              </button>
            </div>

            {mobileToolsOpen && (
              <div className="border-t border-slate-200 px-3 pb-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSolicitarCreacion?.({ nivel: "Programa" })}
                    className="col-span-2 min-h-10 rounded-lg border border-emerald-700 bg-emerald-700 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white active:bg-emerald-800"
                  >
                    Crear estructura
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      expandAll ? contraerTodo() : setExpandAll(true)
                    }
                    disabled={expandableCount === 0}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700 disabled:opacity-50"
                  >
                    {expandAll ? "Contraer todo" : "Expandir todo"}
                  </button>

                  <button
                    type="button"
                    onClick={copiarArbol}
                    disabled={nodes.length === 0}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700 disabled:opacity-50"
                  >
                    {copyStatus === "copied"
                      ? "Copiado"
                      : copyStatus === "error"
                      ? "Error"
                      : "Copiar árbol"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEmergencyMode((prev) => !prev)}
                  disabled={emergencyCount === 0}
                  className={[
                    "mt-2 flex min-h-10 w-full items-center justify-between rounded-lg border px-3 text-[10px] font-bold uppercase tracking-[0.1em] disabled:opacity-50",
                    emergencyMode
                      ? "border-rose-600 bg-rose-600 text-white"
                      : "border-rose-200 bg-rose-50 text-rose-700",
                  ].join(" ")}
                >
                  <span>Solo saldos negativos</span>
                  <span>{emergencyMode ? "Activo" : emergencyCount}</span>
                </button>
              </div>
            )}
          </div>

          {/* TÍTULO */}
          <div className="hidden min-w-0 items-center px-3 py-2 xl:flex">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Explorador presupuestario
              </div>

              <div className="mt-0.5">
                <div className="text-[13px] font-semibold text-slate-950">
                  Estructura programática
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 xl:mt-1 xl:flex xl:flex-wrap">
                <button
                  type="button"
                  onClick={() => onSolicitarCreacion?.({ nivel: "Programa" })}
                  className="col-span-2 min-h-10 rounded-lg border border-emerald-700 bg-emerald-700 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition active:bg-emerald-800 xl:col-span-1 xl:h-7 xl:min-h-0 xl:rounded-md xl:border-slate-300 xl:bg-white xl:px-2 xl:text-slate-700 xl:hover:border-[#00be87] xl:hover:text-[#006b55]"
                >
                  Crear estructura
                </button>

                <button
                  type="button"
                  onClick={() =>
                    expandAll ? contraerTodo() : setExpandAll(true)
                  }
                  disabled={expandableCount === 0}
                  className={[
                    "min-h-10 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50 xl:h-7 xl:min-h-0 xl:rounded-md",
                    expandAll
                      ? "border-[#008b70] bg-[#008b70] text-white hover:bg-[#00715d]"
                      : "border-slate-300 bg-white text-slate-700 hover:border-[#00be87] hover:text-[#006b55]",
                  ].join(" ")}
                >
                  {expandAll ? "Contraer todo" : "Expandir todo"}
                </button>

                <button
                  type="button"
                  onClick={copiarArbol}
                  disabled={nodes.length === 0}
                  className={[
                    "min-h-10 rounded-lg border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50 xl:h-7 xl:min-h-0 xl:rounded-md",
                    copyStatus === "copied"
                      ? "border-[#008b70] bg-[#008b70] text-white"
                      : copyStatus === "error"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-[#00be87] hover:text-[#006b55]",
                  ].join(" ")}
                  title="Copiar estructura tabulada para pegar en Excel"
                >
                  {copyStatus === "copied"
                    ? "Copiado"
                    : copyStatus === "error"
                    ? "Error"
                    : "Copiar arbol"}
                </button>
                </div>
              </div>

              {emergencyMode && (
                <div className="mt-1 text-[10px] font-medium text-rose-700">
                  Mostrando únicamente códigos presupuestarios con saldo
                  negativo.
                </div>
              )}
            </div>
          </div>

          {/* BLOQUE DERECHO: MISMA ESTRUCTURA QUE LAS FILAS */}
          <div
            className={[
              "hidden items-stretch justify-end border-l border-slate-200 text-[11px] xl:flex",
              FINANCIAL_PANEL_WIDTH,
            ].join(" ")}
          >
            <div className="flex flex-1 items-center justify-end gap-5 px-3 py-2">
              <InlineMetric label="Raíz" value={`${nodes.length}`} />

              <InlineMetric label="Expandibles" value={`${expandableCount}`} />

              <InlineMetric
                label="Alertas"
                value={`${emergencyCount}`}
                valueClass={
                  emergencyCount > 0
                    ? "text-rose-700 font-semibold"
                    : "text-slate-500"
                }
              />
            </div>

            <EmergencyToggleCard
              active={emergencyMode}
              disabled={emergencyCount === 0}
              count={emergencyCount}
              onClick={() => setEmergencyMode((prev) => !prev)}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 touch-pan-y overflow-visible [-webkit-overflow-scrolling:touch] xl:overflow-auto xl:overscroll-contain">
        <div className="min-w-0 space-y-2 p-2 xl:min-w-[1080px] xl:space-y-0 xl:p-0">
          {nodes.length > 0 ? (
            nodes.map((node) => (
              <BudgetNode
                key={`${treeRenderVersion}-${node.id}`}
                node={node}
                pathKey={getNodePathKey(node)}
                expandAll={expandAll}
                openState={openState}
                onToggleNode={handleToggleNode}
                onExitExpandAll={() => setExpandAll(false)}
                onSolicitarModificacion={onSolicitarModificacion}
                onSolicitarCreacion={onSolicitarCreacion}
                onEditarContexto={(editor) => {
                  setErrorContexto("");
                  setEditorContexto(editor);
                }}
              />
            ))
          ) : (
            <div className="px-3 py-10 text-center text-[12px] text-slate-400">
              {emergencyMode
                ? "No hay códigos presupuestarios con saldo negativo."
                : "No hay estructura presupuestaria disponible."}
            </div>
          )}
        </div>
      </div>

      {editorContexto && (
        <ContextoCodigoModal
          editor={editorContexto}
          guardando={guardandoContexto}
          error={errorContexto}
          onChange={(contexto) =>
            setEditorContexto((current) =>
              current ? { ...current, contexto } : current
            )
          }
          onClose={() => {
            if (guardandoContexto) return;
            setEditorContexto(null);
            setErrorContexto("");
          }}
          onGuardar={guardarContexto}
        />
      )}
    </div>
  );
}

function MobileMetric({
  label,
  value,
  fullValue,
  valueClass = "text-slate-800",
}: InlineMetricProps & { fullValue: string }) {
  return (
    <div className="min-w-0 bg-slate-50 px-1 py-1.5 text-center" title={fullValue}>
      <div className="truncate text-[7px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-[9px] font-semibold leading-tight tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function MobileRowActions({
  isCodigo,
  codigoVisible,
  siguienteNivel,
  tieneContexto,
  onAmpliar,
  onDisminuir,
  onCrear,
  onEditarContexto,
}: {
  isCodigo: boolean;
  codigoVisible: boolean;
  siguienteNivel?: NivelPresupuesto;
  tieneContexto: boolean;
  onAmpliar: () => void;
  onDisminuir: () => void;
  onCrear: () => void;
  onEditarContexto: () => void;
}) {
  if (isCodigo && codigoVisible) {
    return (
      <div className="mt-1.5 grid grid-cols-3 gap-1.5" aria-label="Acciones del código">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAmpliar();
          }}
          className="min-h-9 rounded-md border border-emerald-700 bg-emerald-700 px-1 text-[8px] font-bold uppercase tracking-[0.06em] text-white active:bg-emerald-800"
        >
          + Ampliar
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDisminuir();
          }}
          className="min-h-9 rounded-md border border-rose-300 bg-rose-50 px-1 text-[8px] font-bold uppercase tracking-[0.06em] text-rose-700 active:bg-rose-100"
        >
          − Disminuir
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEditarContexto();
          }}
          className={[
            "min-h-9 rounded-md border px-1 text-[8px] font-bold uppercase tracking-[0.04em]",
            tieneContexto
              ? "border-teal-700 bg-teal-700 text-white active:bg-teal-800"
              : "border-amber-300 bg-amber-50 text-amber-800 active:bg-amber-100",
          ].join(" ")}
        >
          ✦ Contexto IA
        </button>
      </div>
    );
  }

  if (!siguienteNivel) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCrear();
      }}
      className="mt-1.5 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-700 active:border-emerald-400 active:text-emerald-800"
    >
      + Crear {LABELS[siguienteNivel]}
    </button>
  );
}

function RowActions({
  isCodigo,
  codigoVisible,
  siguienteNivel,
  tieneContexto,
  onAmpliar,
  onDisminuir,
  onCrear,
  onEditarContexto,
}: {
  isCodigo: boolean;
  codigoVisible: boolean;
  siguienteNivel?: NivelPresupuesto;
  tieneContexto: boolean;
  onAmpliar: () => void;
  onDisminuir: () => void;
  onCrear: () => void;
  onEditarContexto: () => void;
}) {
  return (
    <div className="flex min-h-full w-[132px] shrink-0 flex-col justify-center gap-1 border-l border-slate-200 px-2 py-2">
      {isCodigo && codigoVisible ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAmpliar();
            }}
            className="h-7 border border-emerald-200 bg-emerald-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800 transition hover:bg-emerald-100"
          >
            Ampliar
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDisminuir();
            }}
            className="h-7 border border-rose-200 bg-rose-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
          >
            Disminuir
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditarContexto();
            }}
            className={[
              "h-7 border text-[10px] font-semibold uppercase tracking-[0.1em] transition",
              tieneContexto
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
            ].join(" ")}
          >
            Contexto IA
          </button>
        </>
      ) : siguienteNivel ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCrear();
          }}
          className="h-7 border border-slate-300 bg-white text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55]"
        >
          Crear {LABELS[siguienteNivel]}
        </button>
      ) : (
        <span className="text-center text-[10px] text-slate-300">-</span>
      )}
    </div>
  );
}

function ContextoCodigoModal({
  editor,
  guardando,
  error,
  onChange,
  onClose,
  onGuardar,
}: {
  editor: EditorContextoCodigo;
  guardando: boolean;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onGuardar: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contexto para recomendaciones IA"
    >
      <div className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-xl border border-slate-300 bg-white shadow-2xl sm:max-w-2xl sm:rounded-none">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Contexto para recomendaciones IA
          </div>
          <div className="mt-1 break-all text-[13px] font-semibold text-slate-950">
            {editor.codigo}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{editor.nombre}</div>
        </div>

        <div className="p-3 sm:p-4">
          <label className="block text-[11px] font-semibold text-slate-700">
            ¿Qué tipos de cuentas por pagar corresponden a este código?
          </label>
          <textarea
            value={editor.contexto}
            onChange={(event) => onChange(event.target.value.slice(0, 2000))}
            rows={5}
            placeholder="Ejemplo: Combustible diésel y gasolina para vehículos y maquinaria municipal; facturas de estaciones de servicio autorizadas."
            className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] leading-6 text-slate-800 outline-none focus:border-emerald-500 sm:min-h-40 sm:text-[13px] sm:leading-5"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>Sea concreto: conceptos, proveedores o usos que sí corresponden.</span>
            <span>{editor.contexto.length}/2000</span>
          </div>

          {error && (
            <div className="mt-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 sm:flex sm:justify-end sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-700 disabled:opacity-50 sm:h-9 sm:min-h-0 sm:rounded-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onGuardar}
            disabled={guardando}
            className="min-h-11 rounded-lg border border-emerald-700 bg-emerald-700 px-4 text-[12px] font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:h-9 sm:min-h-0 sm:rounded-none"
          >
            {guardando ? "Guardando..." : "Guardar contexto"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type InlineMetricProps = {
  label: string;
  value: string;
  valueClass?: string;
};

function InlineMetric({
  label,
  value,
  valueClass = "text-slate-800",
}: InlineMetricProps) {
  return (
    <div className="whitespace-nowrap text-right">
      <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      <span className={`tabular-nums text-[12px] ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function DisponibleCard({
  value,
  porcentaje,
}: {
  value: string;
  porcentaje: number | null;
}) {
  return (
    <div
      style={getDisponibleStyle(porcentaje)}
      className={[
        "flex min-h-full shrink-0 flex-col items-center justify-center border-l px-3 py-2 text-center",
        KPI_CARD_WIDTH,
      ].join(" ")}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-75">
        Disponible
      </span>

      <span className="mt-0.5 text-[18px] font-black leading-none tabular-nums tracking-tight">
        {value}
      </span>

      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] opacity-70">
        Saldo
      </span>
    </div>
  );
}

function EmergencyToggleCard({
  active,
  disabled,
  count,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Mostrar únicamente códigos presupuestarios con saldo negativo"
      className={[
        "flex min-h-full shrink-0 flex-col items-center justify-center border-l px-3 py-2 text-center transition",
        KPI_CARD_WIDTH,
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60"
          : active
          ? "cursor-pointer border-rose-500 bg-rose-600 text-white hover:bg-rose-700"
          : "cursor-pointer border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      ].join(" ")}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-80">
        Emergencia
      </span>

      <span className="mt-0.5 text-[18px] font-black leading-none tabular-nums tracking-tight">
        {count}
      </span>

      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] opacity-75">
        {active ? "Activa" : "Alertas"}
      </span>
    </button>
  );
}
