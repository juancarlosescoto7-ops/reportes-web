"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  Expand,
  GripVertical,
  Minus,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  obtenerModificacionesClasificadas,
  type FiltrosModificacionesClasificadas,
  type ModificacionPresupuestariaClasificada,
} from "@/services/modificacionesPresupuesto";

type GroupField =
  | "id"
  | "id_modificacion"
  | "fecha"
  | "descripcion"
  | "tipo_movimiento"
  | "fuente"
  | "tipo_inversion"
  | "estado_clasificacion"
  | "programa"
  | "subprograma"
  | "proyecto"
  | "actividad"
  | "obra"
  | "objeto"
  | "codigo";

type PivotMetrics = {
  registros: number;
  ampliacion: number;
  disminucion: number;
  neto: number;
};

type PivotGroup = {
  id: string;
  label: string;
  field: GroupField | "total";
  depth: number;
  metrics: PivotMetrics;
  children: PivotGroup[];
};

type OpenGroupsState = Record<string, boolean | undefined>;

const FIELD_DEFS: { key: GroupField; label: string }[] = [
  { key: "id", label: "Modificacion" },
  { key: "id_modificacion", label: "Grupo modificacion" },
  { key: "fecha", label: "Fecha" },
  { key: "descripcion", label: "Descripcion" },
  { key: "tipo_movimiento", label: "Tipo movimiento" },
  { key: "fuente", label: "Fuente" },
  { key: "tipo_inversion", label: "Tipo inversion" },
  { key: "estado_clasificacion", label: "Estado" },
  { key: "programa", label: "Programa" },
  { key: "subprograma", label: "Subprograma" },
  { key: "proyecto", label: "Proyecto" },
  { key: "actividad", label: "Actividad" },
  { key: "obra", label: "Obra" },
  { key: "objeto", label: "Objeto" },
  { key: "codigo", label: "Codigo" },
];

const DEFAULT_GROUPS: GroupField[] = [
  "id",
  "fecha",
  "tipo_movimiento",
];

const LEVEL_STYLES = [
  {
    background: "#fbfefd",
    border: "#cdebe2",
    accent: "#00be87",
  },
  {
    background: "#fafdfc",
    border: "#b9e3d7",
    accent: "#16a085",
  },
  {
    background: "#f8fbfa",
    border: "#d5e8e2",
    accent: "#5fbda4",
  },
  {
    background: "#f7faf9",
    border: "#e2ece9",
    accent: "#94cfc0",
  },
  {
    background: "#ffffff",
    border: "#e2e8f0",
    accent: "#cbd5e1",
  },
];

const numberFormatter = new Intl.NumberFormat("es-HN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function sanitizeCell(value: unknown) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

function escapeHtml(value: unknown) {
  return sanitizeCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumberForExcel(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function getFieldLabel(field: GroupField | "total") {
  if (field === "total") return "Total";
  return FIELD_DEFS.find((item) => item.key === field)?.label ?? field;
}

function getLevelStyle(depth: number, maxDepth: number) {
  if (maxDepth > 0 && depth >= maxDepth) {
    return LEVEL_STYLES[LEVEL_STYLES.length - 1];
  }

  return LEVEL_STYLES[
    Math.min(depth, Math.max(0, LEVEL_STYLES.length - 2))
  ];
}

function getLevelTypography(depth: number, maxDepth: number) {
  if (maxDepth > 0 && depth >= maxDepth) {
    return {
      label: "font-normal italic text-slate-600",
      field: "font-normal text-slate-400",
      metric: "font-normal text-slate-600",
      neto: "font-medium text-slate-700",
      htmlWeight: "400",
      htmlStyle: "italic",
      htmlText: "#475569",
      htmlMuted: "#94a3b8",
      htmlMetric: "#475569",
    };
  }

  if (depth === 0) {
    return {
      label: "font-bold text-slate-950",
      field: "font-semibold uppercase tracking-[0.08em] text-slate-500",
      metric: "font-semibold text-slate-800",
      neto: "font-bold text-slate-900",
      htmlWeight: "700",
      htmlStyle: "normal",
      htmlText: "#0f172a",
      htmlMuted: "#475569",
      htmlMetric: "#1e293b",
    };
  }

  if (depth === 1) {
    return {
      label: "font-semibold text-slate-800",
      field: "font-medium text-slate-500",
      metric: "font-medium text-slate-700",
      neto: "font-semibold text-slate-800",
      htmlWeight: "600",
      htmlStyle: "normal",
      htmlText: "#1e293b",
      htmlMuted: "#64748b",
      htmlMetric: "#334155",
    };
  }

  return {
    label: "font-medium text-slate-700",
    field: "font-normal italic text-slate-500",
    metric: "font-normal text-slate-600",
    neto: "font-medium text-slate-700",
    htmlWeight: "500",
    htmlStyle: "normal",
    htmlText: "#334155",
    htmlMuted: "#64748b",
    htmlMetric: "#475569",
  };
}

function getLevelVisual(depth: number, maxDepth: number) {
  const style = getLevelStyle(depth, maxDepth);
  const typography = getLevelTypography(depth, maxDepth);

  return {
    rowStyle: {
      backgroundColor: style.background,
      borderBottomColor: style.border,
    },
    label: typography.label,
    field: typography.field,
    neutralMetric: typography.metric,
    positiveMetric: "text-emerald-800",
    negativeMetric: "text-rose-700",
    netoPositive: typography.neto,
    marker: "bg-slate-400",
    toggle:
      "border-slate-300 bg-white/75 text-slate-700 hover:border-[#00be87]",
    accent: style.accent,
  };
}

function getClipboardLevelStyle(depth: number, maxDepth: number) {
  const style = getLevelStyle(depth, maxDepth);
  const typography = getLevelTypography(depth, maxDepth);

  return {
    background: style.background,
    border: style.border,
    accent: style.accent,
    text: typography.htmlText,
    muted: typography.htmlMuted,
    metric: typography.htmlMetric,
    positive: "#065f46",
    negative: "#be123c",
    neutral: typography.htmlMetric,
    weight: typography.htmlWeight,
    fontStyle: typography.htmlStyle,
  };
}

function getFieldValue(
  row: ModificacionPresupuestariaClasificada,
  field: GroupField
) {
  const value = row[field];

  if (field === "objeto") {
    const objeto = String(row.objeto ?? "").trim();
    const descripcion = String(row.descripcion_objeto ?? "").trim();

    return [objeto, descripcion].filter(Boolean).join(" - ") || "Sin objeto";
  }

  return String(value ?? "").trim() || "Sin clasificar";
}

function getMetrics(rows: ModificacionPresupuestariaClasificada[]) {
  return rows.reduce<PivotMetrics>(
    (acc, row) => {
      const ampliacion = toNumber(row.ampliacion);
      const disminucion = toNumber(row.disminucion);
      const neto = toNumber(row.movimiento_neto) || ampliacion - disminucion;

      acc.registros += 1;
      acc.ampliacion += ampliacion;
      acc.disminucion += disminucion;
      acc.neto += neto;

      return acc;
    },
    {
      registros: 0,
      ampliacion: 0,
      disminucion: 0,
      neto: 0,
    }
  );
}

function groupRows(
  rows: ModificacionPresupuestariaClasificada[],
  fields: GroupField[],
  depth = 0,
  parentId = ""
): PivotGroup[] {
  const field = fields[depth];

  if (!field) return [];

  const grouped = new Map<string, ModificacionPresupuestariaClasificada[]>();

  rows.forEach((row) => {
    const value = getFieldValue(row, field);
    const current = grouped.get(value) ?? [];
    current.push(row);
    grouped.set(value, current);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) =>
      a.localeCompare(b, "es-HN", { numeric: true, sensitivity: "base" })
    )
    .map(([label, groupedRows]) => {
      const id = parentId ? `${parentId}/${field}:${label}` : `${field}:${label}`;

      return {
        id,
        label,
        field,
        depth,
        metrics: getMetrics(groupedRows),
        children: groupRows(groupedRows, fields, depth + 1, id),
      };
    });
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);

  return next;
}

function isGroupOpen(group: PivotGroup, openGroups: OpenGroupsState) {
  return openGroups[group.id] ?? true;
}

function buildPivotClipboardPayload(
  groups: PivotGroup[],
  groupFields: GroupField[],
  openGroups: OpenGroupsState
) {
  const levelHeaders = groupFields.map(
    (field, index) => `Nivel ${index + 1} - ${getFieldLabel(field)}`
  );
  const rows = [
    [
      ...levelHeaders,
      "Campo",
      "Agrupamiento",
      "Registros",
      "Ampliacion",
      "Disminucion",
      "Neto",
    ].join("\t"),
  ];
  const htmlRows: string[] = [
    `<tr>${[
      "Agrupamiento",
      "Campo",
      "Registros",
      "Ampliacion",
      "Disminucion",
      "Neto",
    ]
      .map(
        (header) =>
          `<th style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:8px;text-align:${
            ["Registros", "Ampliacion", "Disminucion", "Neto"].includes(header)
              ? "right"
              : "left"
          };font-size:11px;font-weight:700;">${escapeHtml(header)}</th>`
      )
      .join("")}</tr>`,
  ];

  function visit(group: PivotGroup, path: string[]) {
    const nextPath = [...path, group.label];
    const isLowestLevel = group.children.length === 0;
    const open = isGroupOpen(group, openGroups);
    const showMetrics = isLowestLevel || !open;
    const cells = [
      ...Array.from({ length: groupFields.length }, (_, index) =>
        sanitizeCell(nextPath[index] ?? "")
      ),
      sanitizeCell(getFieldLabel(group.field)),
      sanitizeCell(group.label),
      showMetrics ? String(group.metrics.registros) : "",
      showMetrics ? formatNumberForExcel(group.metrics.ampliacion) : "",
      showMetrics ? formatNumberForExcel(group.metrics.disminucion) : "",
      showMetrics ? formatNumberForExcel(group.metrics.neto) : "",
    ];

    rows.push(cells.join("\t"));
    const style = getClipboardLevelStyle(group.depth, groupFields.length - 1);
    const metricColor =
      showMetrics && group.metrics.neto < 0 ? style.negative : style.neutral;

    htmlRows.push(
      `<tr>` +
        `<td style="background:${style.background};color:${style.text};border:1px solid ${style.border};border-left:4px solid ${style.accent};padding:7px 8px 7px ${
          8 + group.depth * 22
        }px;font-weight:${style.weight};font-style:${style.fontStyle};">${escapeHtml(
          group.label
        )}</td>` +
        `<td style="background:${style.background};color:${style.muted};border:1px solid ${style.border};padding:7px 8px;font-style:${
          style.fontStyle
        };">${escapeHtml(
          getFieldLabel(group.field)
        )}</td>` +
        `<td style="background:${style.background};color:${style.neutral};border:1px solid ${style.border};padding:7px 8px;text-align:right;">${
          showMetrics ? escapeHtml(group.metrics.registros) : ""
        }</td>` +
        `<td style="background:${style.background};color:${style.positive};border:1px solid ${style.border};padding:7px 8px;text-align:right;">${
          showMetrics ? escapeHtml(formatNumberForExcel(group.metrics.ampliacion)) : ""
        }</td>` +
        `<td style="background:${style.background};color:${style.negative};border:1px solid ${style.border};padding:7px 8px;text-align:right;">${
          showMetrics
            ? escapeHtml(formatNumberForExcel(group.metrics.disminucion))
            : ""
        }</td>` +
        `<td style="background:${style.background};color:${metricColor};border:1px solid ${style.border};padding:7px 8px;text-align:right;font-weight:700;">${
          showMetrics ? escapeHtml(formatNumberForExcel(group.metrics.neto)) : ""
        }</td>` +
      `</tr>`
    );

    if (open) {
      group.children.forEach((child) => visit(child, nextPath));
    }
  }

  groups.forEach((group) => visit(group, []));

  return {
    text: rows.join("\r\n"),
    html: `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">${htmlRows.join(
      ""
    )}</table>`,
  };
}

async function copyToClipboard({
  text,
  html,
}: {
  text: string;
  html: string;
}) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
    return;
  }

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

export default function ResumenModificacionesPresupuesto() {
  const [rows, setRows] = useState<ModificacionPresupuestariaClasificada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groupFields, setGroupFields] = useState<GroupField[]>(DEFAULT_GROUPS);
  const [fieldToAdd, setFieldToAdd] = useState<GroupField>("fuente");
  const [draggedField, setDraggedField] = useState<GroupField | null>(null);
  const [openGroups, setOpenGroups] = useState<OpenGroupsState>({});
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [filters, setFilters] = useState<FiltrosModificacionesClasificadas>({
    busqueda: "",
    fechaDesde: "",
    fechaHasta: "",
    fuente: "",
    tipoInversion: "",
    idModificacion: "",
  });

  async function cargar() {
    setLoading(true);
    setError("");

    try {
      const data = await obtenerModificacionesClasificadas(filters);
      setRows(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el resumen de modificaciones."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableFields = useMemo(
    () => FIELD_DEFS.filter((field) => !groupFields.includes(field.key)),
    [groupFields]
  );
  const totalMetrics = useMemo(() => getMetrics(rows), [rows]);
  const pivotGroups = useMemo(
    () => groupRows(rows, groupFields),
    [rows, groupFields]
  );

  function updateFilter(
    key: keyof FiltrosModificacionesClasificadas,
    value: string
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addGroupField() {
    if (groupFields.includes(fieldToAdd)) return;

    setGroupFields((current) => [...current, fieldToAdd]);
    const nextAvailable = availableFields.find(
      (field) => field.key !== fieldToAdd
    );
    if (nextAvailable) setFieldToAdd(nextAvailable.key);
  }

  function removeGroupField(field: GroupField) {
    setGroupFields((current) => current.filter((item) => item !== field));
  }

  function moveGroupField(field: GroupField, direction: -1 | 1) {
    setGroupFields((current) => {
      const index = current.indexOf(field);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      return moveItem(current, index, nextIndex);
    });
  }

  function dropGroupField(target: GroupField) {
    if (!draggedField || draggedField === target) return;

    setGroupFields((current) => {
      const from = current.indexOf(draggedField);
      const to = current.indexOf(target);

      if (from < 0 || to < 0) return current;

      return moveItem(current, from, to);
    });
    setDraggedField(null);
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({
      ...current,
      [id]: !(current[id] ?? true),
    }));
  }

  function expandirTodo() {
    setOpenGroups({});
  }

  function colapsarTodo() {
    const next: OpenGroupsState = {};

    function visit(group: PivotGroup) {
      if (group.children.length > 0) {
        next[group.id] = false;
        group.children.forEach(visit);
      }
    }

    pivotGroups.forEach(visit);
    setOpenGroups(next);
  }

  async function copiarResumen() {
    try {
      await copyToClipboard(
        buildPivotClipboardPayload(pivotGroups, groupFields, openGroups)
      );
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2200);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/70 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white/95 p-3">
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1.2fr_150px_150px_150px_150px_140px_auto]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Busqueda
            </span>
            <input
              value={filters.busqueda ?? ""}
              onChange={(event) => updateFilter("busqueda", event.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#00be87]"
            />
          </label>

          <FilterInput
            label="Desde"
            type="date"
            value={filters.fechaDesde ?? ""}
            onChange={(value) => updateFilter("fechaDesde", value)}
          />
          <FilterInput
            label="Hasta"
            type="date"
            value={filters.fechaHasta ?? ""}
            onChange={(value) => updateFilter("fechaHasta", value)}
          />
          <FilterInput
            label="Fuente"
            value={filters.fuente ?? ""}
            onChange={(value) => updateFilter("fuente", value)}
          />
          <FilterInput
            label="Tipo inversion"
            value={filters.tipoInversion ?? ""}
            onChange={(value) => updateFilter("tipoInversion", value)}
          />
          <FilterInput
            label="Grupo modificacion"
            value={filters.idModificacion ?? ""}
            onChange={(value) => updateFilter("idModificacion", value)}
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={cargar}
              disabled={loading}
              className="inline-flex h-9 w-full items-center justify-center gap-2 border border-[#008b70] bg-[#008b70] px-3 text-[12px] font-semibold text-white transition hover:bg-[#00715d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              Consultar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50/80 p-3 lg:border-b-0 lg:border-r">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Agrupamientos
          </div>

          <div className="mt-2 space-y-2">
            {groupFields.map((field, index) => (
              <div
                key={field}
                draggable
                onDragStart={() => setDraggedField(field)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropGroupField(field)}
                className="flex items-center gap-2 border border-slate-300 bg-white px-2 py-2 text-[12px] text-slate-800"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {index + 1}. {getFieldLabel(field)}
                </span>
                <button
                  type="button"
                  onClick={() => moveGroupField(field, -1)}
                  disabled={index === 0}
                  className="flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGroupField(field, 1)}
                  disabled={index === groupFields.length - 1}
                  className="flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-30"
                  title="Bajar"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeGroupField(field)}
                  className="flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-700"
                  title="Quitar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {availableFields.length > 0 && (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <select
                value={fieldToAdd}
                onChange={(event) => setFieldToAdd(event.target.value as GroupField)}
                className="h-9 border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-[#00be87]"
              >
                {availableFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addGroupField}
                className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-700 hover:border-[#00be87] hover:text-[#006b55]"
                title="Agregar agrupamiento"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={copiarResumen}
            disabled={pivotGroups.length === 0}
            className={[
              "mt-3 inline-flex h-9 w-full items-center justify-center gap-2 border px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              copyStatus === "copied"
                ? "border-[#008b70] bg-[#008b70] text-white"
                : copyStatus === "error"
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-slate-300 bg-white text-slate-700 hover:border-[#00be87] hover:text-[#006b55]",
            ].join(" ")}
            title="Copiar resumen visible para pegar en Excel"
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            {copyStatus === "copied"
              ? "Copiado"
              : copyStatus === "error"
              ? "Error"
              : "Copiar resumen"}
          </button>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={expandirTodo}
              disabled={pivotGroups.length === 0}
              className="inline-flex h-8 items-center justify-center gap-2 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Expand className="h-3.5 w-3.5" aria-hidden="true" />
              Expandir
            </button>
            <button
              type="button"
              onClick={colapsarTodo}
              disabled={pivotGroups.length === 0}
              className="inline-flex h-8 items-center justify-center gap-2 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              Colapsar
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
            <SummaryBox label="Registros" value={String(totalMetrics.registros)} />
            <SummaryBox label="Neto" value={formatNumber(totalMetrics.neto)} />
            <SummaryBox
              label="Ampliacion"
              value={formatNumber(totalMetrics.ampliacion)}
              valueClass="text-emerald-800"
            />
            <SummaryBox
              label="Disminucion"
              value={formatNumber(totalMetrics.disminucion)}
              valueClass="text-rose-700"
            />
          </div>
        </aside>

        <main className="min-h-0 overflow-auto">
          <table className="min-w-[940px] w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left">
                  Agrupamiento
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">
                  Campo
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Registros
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Ampliacion
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Disminucion
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Neto
                </th>
              </tr>
            </thead>
            <tbody>
              {pivotGroups.length > 0 ? (
                pivotGroups.map((group) => (
                  <PivotGroupRows
                    key={group.id}
                    group={group}
                    openGroups={openGroups}
                    maxDepth={groupFields.length - 1}
                    onToggleGroup={toggleGroup}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-[12px] text-slate-400"
                  >
                    No hay modificaciones para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#00be87]"
      />
    </label>
  );
}

function SummaryBox({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-slate-200 bg-white px-2 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-[13px] font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function PivotGroupRows({
  group,
  openGroups,
  maxDepth,
  onToggleGroup,
}: {
  group: PivotGroup;
  openGroups: OpenGroupsState;
  maxDepth: number;
  onToggleGroup: (id: string) => void;
}) {
  const isLowestLevel = group.children.length === 0;
  const hasChildren = group.children.length > 0;
  const open = isGroupOpen(group, openGroups);
  const showMetrics = isLowestLevel || !open;
  const levelVisual = getLevelVisual(group.depth, maxDepth);

  return (
    <>
      <tr
        className="border-b transition-colors hover:bg-slate-50"
        style={levelVisual.rowStyle}
      >
        <td
          className={`px-3 py-2 ${levelVisual.label}`}
          style={{ borderLeft: `4px solid ${levelVisual.accent}` }}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="shrink-0"
              style={{ width: `${group.depth * 22}px` }}
            />
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[13px] leading-none transition",
                  levelVisual.toggle,
                ].join(" ")}
                title={open ? "Colapsar grupo" : "Expandir grupo"}
              >
                {open ? "-" : "+"}
              </button>
            ) : (
              <span
                className={[
                  "mt-2 h-1.5 w-1.5 shrink-0",
                  levelVisual.marker,
                ].join(" ")}
              />
            )}
            <div className="min-w-0 whitespace-normal break-words leading-snug">
              {group.label}
            </div>
          </div>
        </td>
        <td className={`px-3 py-2 ${levelVisual.field}`}>
          {getFieldLabel(group.field)}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums ${levelVisual.neutralMetric}`}
        >
          {showMetrics ? group.metrics.registros : ""}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums ${levelVisual.positiveMetric}`}
        >
          {showMetrics ? formatNumber(group.metrics.ampliacion) : ""}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums ${levelVisual.negativeMetric}`}
        >
          {showMetrics ? formatNumber(group.metrics.disminucion) : ""}
        </td>
        <td
          className={[
            "px-3 py-2 text-right font-semibold tabular-nums",
            showMetrics && group.metrics.neto < 0
              ? levelVisual.negativeMetric
              : levelVisual.netoPositive,
          ].join(" ")}
        >
          {showMetrics ? formatNumber(group.metrics.neto) : ""}
        </td>
      </tr>
      {open &&
        group.children.map((child) => (
          <PivotGroupRows
            key={child.id}
            group={child}
            openGroups={openGroups}
            maxDepth={maxDepth}
            onToggleGroup={onToggleGroup}
          />
        ))}
    </>
  );
}
