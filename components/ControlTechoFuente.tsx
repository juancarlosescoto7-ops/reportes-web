"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { obtenerControlTechoPorFuente } from "@/services/controlTechoFuente";

type RawRow = Record<string, unknown>;

type ColumnConfig = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  kind?: "money" | "percent" | "ratioPercent" | "state";
};

const COLUMNS: ColumnConfig[] = [
  { key: "fuente", label: "Fuente" },
  { key: "nivel_aplicacion", label: "Nivel" },
  { key: "id_nivel", label: "ID" },
  { key: "porcentaje_tope", label: "Tope", align: "right", kind: "percent" },
  { key: "monto_fuente", label: "Monto fuente", align: "right", kind: "money" },
  {
    key: "monto_permitido_grupo",
    label: "Permitido",
    align: "right",
    kind: "money",
  },
  {
    key: "monto_vigente_grupo",
    label: "Vigente",
    align: "right",
    kind: "money",
  },
  {
    key: "monto_disponible_grupo",
    label: "Disponible",
    align: "right",
    kind: "money",
  },
  {
    key: "porcentaje_usado_del_tope",
    label: "Uso",
    align: "right",
    kind: "ratioPercent",
  },
  { key: "estado_tope", label: "Estado", align: "center", kind: "state" },
];

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: unknown) {
  const parsed = parseNumber(value);
  if (parsed === null) return valueToText(value);

  return parsed.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: unknown) {
  const parsed = parseNumber(value);
  if (parsed === null) return valueToText(value);

  return `${parsed.toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatRatioPercent(value: unknown) {
  const parsed = parseNumber(value);
  if (parsed === null) return valueToText(value);

  return `${(parsed * 100).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function valueToText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getTextAlignClass(align: ColumnConfig["align"]) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function getCellClass(column: ColumnConfig, value: unknown) {
  if (column.key === "monto_disponible_grupo") {
    const parsed = parseNumber(value);
    if (parsed !== null && parsed < 0) return "font-semibold text-rose-700";
    if (parsed === 0) return "font-semibold text-amber-700";
    return "font-semibold text-emerald-800";
  }

  if (column.align === "right") return "tabular-nums text-slate-800";
  return "text-slate-800";
}

function getStateClass(value: unknown) {
  const state = String(value ?? "");

  if (state === "SOBREPASADO") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (state === "SIN_DISPONIBLE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function renderCell(row: RawRow, column: ColumnConfig) {
  const value = row[column.key];

  if (column.kind === "money") return formatMoney(value);
  if (column.kind === "percent") return formatPercent(value);
  if (column.kind === "ratioPercent") return formatRatioPercent(value);
  if (column.kind === "state") {
    return (
      <span
        className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStateClass(
          value
        )}`}
      >
        {valueToText(value) || "N/D"}
      </span>
    );
  }

  return valueToText(value);
}

function groupByFuente(rows: RawRow[]) {
  const grouped = new Map<string, RawRow[]>();

  for (const row of rows) {
    const fuente = valueToText(row.fuente) || "Sin fuente";

    if (!grouped.has(fuente)) {
      grouped.set(fuente, []);
    }

    grouped.get(fuente)?.push(row);
  }

  return Array.from(grouped.entries()).map(([fuente, fuenteRows]) => ({
    fuente,
    rows: fuenteRows,
  }));
}

export default function ControlTechoFuente() {
  const [data, setData] = useState<RawRow[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fuentes = groupByFuente(data);

  async function cargar() {
    setLoading(true);
    setError("");

    try {
      const rows = await obtenerControlTechoPorFuente();
      setData(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el control de techo por fuente."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    void cargar();
  }, []);

  return (
    <div className="px-4 py-4">
      <div className="operational-header mb-4 flex justify-end rounded-lg px-3 py-2">
        <button
          type="button"
          onClick={cargar}
          disabled={mounted && loading}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Recargar
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
          {error}
        </div>
      )}

      {!mounted || loading ? (
        <div className="py-8 text-center text-[12px] text-slate-400">
          Cargando control de techo...
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-slate-400">
          No hay datos de control de techo disponibles.
        </div>
      ) : (
        <div className="space-y-4">
          {fuentes.map((grupo) => (
            <section key={grupo.fuente} className="border border-slate-200 bg-white">
              <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Fuente
                  </div>
                  <div className="text-sm font-semibold text-slate-950">
                    {grupo.fuente}
                  </div>
                </div>

                <div className="text-[11px] font-medium text-slate-500">
                  {grupo.rows.length} registros
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1080px] w-full border-collapse text-[12px]">
                  <thead className="bg-white text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      {COLUMNS.filter((column) => column.key !== "fuente").map(
                        (column) => (
                          <th
                            key={column.key}
                            className={`border-b border-slate-200 px-3 py-2 ${getTextAlignClass(
                              column.align
                            )}`}
                          >
                            {column.label}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {grupo.rows.map((row, index) => (
                      <tr
                        key={`${valueToText(row.nivel_aplicacion)}-${valueToText(
                          row.id_nivel
                        )}-${index}`}
                        className="border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0"
                      >
                        {COLUMNS.filter((column) => column.key !== "fuente").map(
                          (column) => (
                            <td
                              key={column.key}
                              className={`whitespace-nowrap px-3 py-2 ${getTextAlignClass(
                                column.align
                              )} ${getCellClass(column, row[column.key])}`}
                            >
                              {renderCell(row, column)}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
