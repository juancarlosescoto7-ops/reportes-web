"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileSearch, Search, ShieldCheck } from "lucide-react";

import { SUPABASE_URL } from "@/lib/supabase";
import {
  agruparEgresosAuditoriaPorMes,
  construirUrlDocumentoAuditoria,
  obtenerClaveMes,
  type EgresoAuditoria,
} from "@/lib/auditoria-egresos";

export default function AuditoriaEgresos({
  egresos,
}: {
  egresos: EgresoAuditoria[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState("todos");

  const meses = useMemo(
    () => agruparEgresosAuditoriaPorMes(egresos),
    [egresos]
  );

  const egresosFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);

    return egresos.filter((egreso) => {
      if (
        mesSeleccionado !== "todos" &&
        obtenerClaveMes(egreso.fecha) !== mesSeleccionado
      ) {
        return false;
      }

      if (!termino) return true;

      return normalizarBusqueda(
        [
          egreso.noOrden,
          egreso.fecha,
          egreso.descripcion,
          egreso.proveedor,
          egreso.cheque,
        ].join(" ")
      ).includes(termino);
    });
  }, [busqueda, egresos, mesSeleccionado]);

  const grupos = useMemo(
    () => agruparEgresosAuditoriaPorMes(egresosFiltrados),
    [egresosFiltrados]
  );
  const totalFiltrado = egresosFiltrados.reduce(
    (total, egreso) => total + egreso.montoEgreso,
    0
  );
  const totalConDocumento = egresosFiltrados.filter(
    (egreso) => egreso.rutaDocumento
  ).length;

  return (
    <div className="mx-auto grid min-h-full w-full max-w-[1700px] content-start gap-3 p-1 text-slate-800">
      <header className="glass-panel overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 bg-white/55 px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#003331] text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Consulta institucional
              </div>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-slate-950">
                Auditoría de egresos
              </h1>
              <p className="mt-1 text-[12px] text-slate-500">
                Vista documental de solo lectura, sin información de ejecución presupuestaria.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 bg-white/80">
            <Metrica label="Órdenes" value={String(egresosFiltrados.length)} />
            <Metrica label="Con PDF" value={String(totalConDocumento)} />
            <Metrica label="Egreso" value={formatearMonto(totalFiltrado)} />
          </div>
        </div>

        <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(260px,1fr)_240px_auto] md:items-end">
          <label className="grid gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Buscar
            </span>
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Orden, descripción, proveedor o cheque"
                className="h-9 w-full rounded-md border border-slate-300 bg-white/85 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-[#005f48]"
              />
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Mes
            </span>
            <select
              value={mesSeleccionado}
              onChange={(event) => setMesSeleccionado(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white/85 px-3 text-[12px] outline-none focus:border-[#005f48]"
            >
              <option value="todos">Todos los meses</option>
              {meses.map((mes) => (
                <option key={mes.id} value={mes.id}>
                  {mes.titulo}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setMesSeleccionado("todos");
            }}
            disabled={!busqueda && mesSeleccionado === "todos"}
            className="h-9 rounded-md border border-slate-300 bg-white/85 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpiar filtros
          </button>
        </div>
      </header>

      {grupos.length === 0 ? (
        <section className="glass-panel grid min-h-[300px] place-items-center p-8 text-center">
          <div>
            <FileSearch
              className="mx-auto h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <div className="mt-3 text-[13px] font-semibold text-slate-800">
              No se encontraron egresos
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Ajuste la búsqueda o seleccione otro mes.
            </p>
          </div>
        </section>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.id} className="glass-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-100/80 px-4 py-2.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Periodo mensual
                </div>
                <h2 className="mt-0.5 text-[14px] font-semibold text-slate-950">
                  {grupo.titulo}
                </h2>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span>{grupo.items.length} orden(es)</span>
                <span className="font-semibold tabular-nums text-slate-950">
                  {formatearMonto(grupo.total)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-[12px]">
                <thead className="bg-white/75 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="w-[105px] px-3 py-2 font-semibold">Fecha</th>
                    <th className="w-[100px] px-3 py-2 font-semibold">Orden</th>
                    <th className="px-3 py-2 font-semibold">Descripción</th>
                    <th className="w-[230px] px-3 py-2 font-semibold">Proveedor</th>
                    <th className="w-[150px] px-3 py-2 font-semibold">Cheque</th>
                    <th className="w-[145px] px-3 py-2 text-right font-semibold">Egreso</th>
                    <th className="w-[145px] px-3 py-2 text-center font-semibold">Orden de pago</th>
                  </tr>
                </thead>

                <tbody>
                  {grupo.items.map((egreso) => {
                    const urlDocumento = construirUrlDocumentoAuditoria(
                      SUPABASE_URL,
                      egreso.rutaDocumento
                    );

                    return (
                      <tr
                        key={egreso.noOrden}
                        className="border-t border-slate-200 bg-white/60"
                      >
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">
                          {formatearFecha(egreso.fecha)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-950">
                          #{egreso.noOrden}
                        </td>
                        <td className="px-3 py-2.5 leading-5 text-slate-700">
                          {egreso.descripcion}
                        </td>
                        <td className="px-3 py-2.5 leading-5 text-slate-700">
                          {egreso.proveedor}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">
                          {egreso.cheque}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-950">
                          {formatearMonto(egreso.montoEgreso)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {urlDocumento ? (
                            <a
                              href={urlDocumento}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100"
                              title={
                                egreso.nombreDocumento ??
                                `Orden de pago #${egreso.noOrden}`
                              }
                            >
                              Visualizar
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Sin documento
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Metrica({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[115px] px-3 py-2 text-right">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}

function normalizarBusqueda(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatearFecha(value: string | null) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (!match) return "-";

  return `${match[3].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[1]}`;
}

function formatearMonto(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
