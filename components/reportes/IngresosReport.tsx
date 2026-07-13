"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  obtenerReporteIngresos,
  type IngresoReporte,
} from "@/services/ingresos.service";

type Props = {
  refreshKey?: number;
  accionesPrincipales?: ReactNode;
};

type ArqueoGrupo = {
  key: string;
  fecha: string | null;
  descripcion: string | null;
  total: number;
  depositos: IngresoReporte[];
  fechaOrden: number;
  sourceIndex: number;
};

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizar(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obtenerTiempoFecha(value: string | null | undefined) {
  if (!value) return 0;

  const text = String(value).trim();
  const soloFecha = text.split("T")[0].split(" ")[0];
  const isoMatch = soloFecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = soloFecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  if (localMatch) {
    const [, day, month, year] = localMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const time = new Date(text).getTime();

  return Number.isFinite(time) ? time : 0;
}

function obtenerFechaArqueo(item: IngresoReporte) {
  return item.fecha_arqueo ?? item.fecha ?? null;
}

function obtenerArqueoKey(item: IngresoReporte) {
  const idArqueo = (item as IngresoReporte & { id_arqueo?: string | number })
    .id_arqueo;

  if (idArqueo !== undefined && idArqueo !== null) {
    return String(idArqueo);
  }

  return `${obtenerFechaArqueo(item) ?? ""}::${item.descripcion ?? ""}::${
    item.total ?? ""
  }`;
}

function agruparPorArqueo(rows: IngresoReporte[]): ArqueoGrupo[] {
  const map = new Map<string, ArqueoGrupo>();

  rows.forEach((item, index) => {
    const key = obtenerArqueoKey(item);
    const existente = map.get(key);

    if (existente) {
      existente.depositos.push(item);
      existente.total += Number(item.monto ?? 0);
      existente.sourceIndex = Math.max(existente.sourceIndex, index);
      existente.fechaOrden = Math.max(
        existente.fechaOrden,
        obtenerTiempoFecha(obtenerFechaArqueo(item)),
        obtenerTiempoFecha(item.fecha_deposito)
      );
      return;
    }

    map.set(key, {
      key,
      fecha: obtenerFechaArqueo(item),
      descripcion: item.descripcion,
      total: Number(item.monto ?? 0),
      depositos: [item],
      sourceIndex: index,
      fechaOrden: Math.max(
        obtenerTiempoFecha(obtenerFechaArqueo(item)),
        obtenerTiempoFecha(item.fecha_deposito)
      ),
    });
  });

  return Array.from(map.values())
    .map((grupo) => ({
      ...grupo,
      depositos: [...grupo.depositos].sort((a, b) => {
        const fechaDiff =
          obtenerTiempoFecha(b.fecha_deposito) -
          obtenerTiempoFecha(a.fecha_deposito);

        if (fechaDiff !== 0) return fechaDiff;

        return Number(b.bloque ?? 0) - Number(a.bloque ?? 0);
      }),
    }))
    .sort((a, b) => {
      const fechaDiff = b.fechaOrden - a.fechaOrden;

      if (fechaDiff !== 0) return fechaDiff;

      const sourceDiff = b.sourceIndex - a.sourceIndex;

      if (sourceDiff !== 0) return sourceDiff;

      return String(b.key).localeCompare(String(a.key));
    });
}

function formatearFechaFiltro(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function construirTextoPeriodo(fechaDesde: string, fechaHasta: string) {
  if (fechaDesde && fechaHasta) {
    return `Periodo: ${formatearFechaFiltro(fechaDesde)} al ${formatearFechaFiltro(
      fechaHasta
    )}`;
  }

  if (fechaDesde) {
    return `Periodo: desde ${formatearFechaFiltro(fechaDesde)}`;
  }

  if (fechaHasta) {
    return `Periodo: hasta ${formatearFechaFiltro(fechaHasta)}`;
  }

  return "Periodo: todos los registros";
}

function estaEnRangoFecha(
  item: IngresoReporte,
  fechaDesde: string,
  fechaHasta: string
) {
  const fechaItem = obtenerFechaArqueo(item);

  if (!fechaItem) return !fechaDesde && !fechaHasta;

  const tiempoItem = obtenerTiempoFecha(fechaItem);
  const tiempoDesde = fechaDesde ? obtenerTiempoFecha(fechaDesde) : null;
  const tiempoHasta = fechaHasta ? obtenerTiempoFecha(fechaHasta) : null;

  if (!tiempoItem) return false;
  if (tiempoDesde !== null && tiempoItem < tiempoDesde) return false;
  if (tiempoHasta !== null && tiempoItem > tiempoHasta) return false;

  return true;
}

function imprimirReporteIngresos(
  grupos: ArqueoGrupo[],
  fechaDesde: string,
  fechaHasta: string
) {
  const rows = grupos.flatMap((grupo) => grupo.depositos);
  const total = rows.reduce((acc, item) => acc + Number(item.monto ?? 0), 0);
  const periodo = construirTextoPeriodo(fechaDesde, fechaHasta);
  const fechaReporte = new Date().toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const filas = grupos
    .map((grupo) => {
      const filasDepositos = grupo.depositos
        .map(
          (item) => `
        <tr>
          <td class="center">${escapeHtml(item.bloque)}</td>
          <td>${escapeHtml(item.fecha_deposito)}</td>
          <td>${escapeHtml(item.tipo_ingreso)}</td>
          <td>${escapeHtml(item.cuenta)}</td>
          <td class="money">${escapeHtml(formatMoney(item.monto))}</td>
        </tr>
      `
        )
        .join("");

      return `
        <tr class="group-row">
          <td colspan="5">
            <strong>${escapeHtml(grupo.fecha)}</strong>
            <span>${escapeHtml(grupo.descripcion || "Sin descripcion")}</span>
            <em>${escapeHtml(formatMoney(grupo.total))}</em>
          </td>
        </tr>
        ${filasDepositos}
      `;
    })
    .join("");

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de ingresos</title>
        <style>
          @page { size: letter landscape; margin: 0.65in; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          h1 { margin: 0; font-size: 22px; }
          .meta { margin-top: 4px; color: #475569; font-size: 13px; }
          .summary { text-align: right; font-size: 13px; color: #475569; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
          thead { display: table-header-group; background: #f1f5f9; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 3px; vertical-align: top; }
          th { color: #475569; font-size: 9px; text-align: left; text-transform: uppercase; }
          .money { text-align: right; font-weight: 700; white-space: nowrap; }
          .center { text-align: center; }
          .group-row td { background: #e2e8f0; border-color: #94a3b8; }
          .group-row strong { margin-right: 12px; }
          .group-row span { color: #475569; }
          .group-row em { float: right; font-style: normal; font-weight: 700; }
          tfoot td { background: #f8fafc; font-weight: 700; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Reporte de ingresos</h1>
            <div class="meta">Emitido el ${escapeHtml(fechaReporte)}</div>
            <div class="meta">${escapeHtml(periodo)}</div>
          </div>
          <div class="summary">
            <div><strong>${escapeHtml(grupos.length)}</strong> arqueos</div>
            <div><strong>${escapeHtml(rows.length)}</strong> depositos</div>
            <div>Total: <strong>${escapeHtml(formatMoney(total))}</strong></div>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Deposito</th>
              <th>Tipo</th>
              <th>Cuenta</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="5">No hay registros.</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right;">Total</td>
              <td class="money">${escapeHtml(formatMoney(total))}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

export default function IngresosReport({
  refreshKey = 0,
  accionesPrincipales,
}: Props) {
  const [data, setData] = useState<IngresoReporte[]>([]);
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gruposAbiertos, setGruposAbiertos] = useState<string[]>([]);

  async function cargar() {
    try {
      setLoading(true);
      setError("");
      const rows = await obtenerReporteIngresos();
      setData(rows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el reporte."
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const term = normalizar(search);

    return data.filter((item) => {
      if (!estaEnRangoFecha(item, fechaDesde, fechaHasta)) {
        return false;
      }

      if (!term) return true;

      return [
        obtenerFechaArqueo(item),
        item.descripcion,
        item.fecha_deposito,
        item.tipo_ingreso,
        item.cuenta,
      ].some((value) => normalizar(value).includes(term));
    });
  }, [data, fechaDesde, fechaHasta, search]);

  const grupos = useMemo(() => {
    return agruparPorArqueo(filtered);
  }, [filtered]);

  useEffect(() => {
    setGruposAbiertos((prev) => {
      if (prev.length > 0) {
        return prev.filter((key) => grupos.some((grupo) => grupo.key === key));
      }

      return grupos.slice(0, 3).map((grupo) => grupo.key);
    });
  }, [grupos]);

  const total = useMemo(() => {
    return filtered.reduce((acc, item) => acc + Number(item.monto ?? 0), 0);
  }, [filtered]);

  function toggleGrupo(key: string) {
    setGruposAbiertos((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  }

  function expandirTodos() {
    setGruposAbiertos(grupos.map((grupo) => grupo.key));
  }

  function contraerTodos() {
    setGruposAbiertos([]);
  }

  function limpiarRangoFechas() {
    setFechaDesde("");
    setFechaHasta("");
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <header className="operational-header grid gap-3 px-3 py-2 lg:grid-cols-[minmax(150px,220px)_minmax(260px,420px)_minmax(360px,460px)_1fr_auto_auto_auto_auto] lg:items-center">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase text-slate-400">
            Reporte
          </div>
          <h2 className="truncate text-[15px] font-semibold text-slate-950">
            Ingresos registrados
          </h2>
        </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por fecha, cuenta o tipo"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(event) => setFechaDesde(event.target.value)}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={limpiarRangoFechas}
              disabled={!fechaDesde && !fechaHasta}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Limpiar
            </button>
          </div>

          <div className="hidden text-[12px] text-slate-500 lg:block">
            Agrupado por arqueo y ordenado del mas reciente al mas antiguo.
          </div>

          {accionesPrincipales}

          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? "Cargando" : "Actualizar"}
          </button>

          <button
            type="button"
            onClick={
              gruposAbiertos.length === grupos.length
                ? contraerTodos
                : expandirTodos
            }
            disabled={loading || grupos.length === 0}
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {gruposAbiertos.length === grupos.length ? "Contraer" : "Expandir"}
          </button>

          <button
            type="button"
            onClick={() => imprimirReporteIngresos(grupos, fechaDesde, fechaHasta)}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
      </header>

      <div className="border-b border-slate-200">
        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="text-[12px] text-slate-500">
              {construirTextoPeriodo(fechaDesde, fechaHasta)}. Agrupado por
              arqueo y ordenado del mas reciente al mas antiguo.
            </div>
          </div>

          <div className="grid grid-cols-3 border border-slate-200 bg-slate-50">
            <Metric label="Arqueos" value={String(grupos.length)} />
            <Metric label="Depositos" value={String(filtered.length)} />
            <Metric label="Total" value={formatMoney(total)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="m-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full min-w-[940px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-[90px] px-3 py-2 text-center font-semibold">
                Bloque
              </th>
              <th className="w-[130px] px-3 py-2 font-semibold">Deposito</th>
              <th className="w-[130px] px-3 py-2 font-semibold">Tipo</th>
              <th className="w-[240px] px-3 py-2 font-semibold">Cuenta</th>
              <th className="w-[150px] px-3 py-2 text-right font-semibold">
                Monto
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-sm text-slate-500"
                >
                  Cargando ingresos...
                </td>
              </tr>
            )}

            {!loading &&
              grupos.map((grupo) => {
                const abierto = gruposAbiertos.includes(grupo.key);

                return (
                  <Fragment key={grupo.key}>
                    <tr className="border-y border-slate-300 bg-slate-100">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <button
                            type="button"
                            onClick={() => toggleGrupo(grupo.key)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          >
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-700">
                              {abierto ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>

                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-[12px] font-semibold uppercase text-slate-800">
                                  Arqueo
                                </span>
                                <span className="tabular-nums text-[12px] font-semibold text-slate-950">
                                  {grupo.fecha}
                                </span>
                                <span className="text-[12px] text-slate-500">
                                  {grupo.depositos.length} deposito(s)
                                </span>
                              </span>
                              <span className="mt-1 block truncate text-[12px] text-slate-600">
                                {grupo.descripcion || "Sin descripcion"}
                              </span>
                            </span>
                          </button>

                          <div className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-slate-950">
                            {formatMoney(grupo.total)}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {abierto &&
                      grupo.depositos.map((item, index) => (
                        <tr
                          key={`${grupo.key}-${item.bloque}-${item.fecha_deposito}-${index}`}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-center tabular-nums text-slate-600">
                            {item.bloque}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-600">
                            {item.fecha_deposito}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">
                            {item.tipo_ingreso}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {item.cuenta}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                            {formatMoney(item.monto)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}

            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-sm text-slate-500"
                >
                  No se encontraron ingresos.
                </td>
              </tr>
            )}
          </tbody>

          {!loading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-400"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                  {formatMoney(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-[120px] border-r border-slate-200 px-4 py-2 last:border-r-0">
      <div className="text-[10px] font-medium uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-1 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}
