"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileSearch, Search, ShieldCheck } from "lucide-react";

import { SUPABASE_URL } from "@/lib/supabase";
import {
  agruparEgresosAuditoriaPorMes,
  agruparEgresosAuditoriaPorOrden,
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
  const ordenes = useMemo(
    () => agruparEgresosAuditoriaPorOrden(egresos),
    [egresos]
  );

  const ordenesFiltradas = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);

    return ordenes.filter((orden) => {
      if (
        mesSeleccionado !== "todos" &&
        obtenerClaveMes(orden.fecha) !== mesSeleccionado
      ) {
        return false;
      }

      if (!termino) return true;

      return normalizarBusqueda(
        [
          orden.noOrden,
          orden.fecha,
          orden.descripcion,
          ...orden.detalles.flatMap((detalle) => [
            detalle.proveedor,
            detalle.cheque,
          ]),
        ].join(" ")
      ).includes(termino);
    });
  }, [busqueda, mesSeleccionado, ordenes]);

  const grupos = useMemo(
    () =>
      agruparEgresosAuditoriaPorMes(
        ordenesFiltradas.flatMap((orden) => orden.detalles)
      ).map((grupo) => ({
        ...grupo,
        ordenes: agruparEgresosAuditoriaPorOrden(grupo.items),
      })),
    [ordenesFiltradas]
  );
  const totalFiltrado = ordenesFiltradas.reduce(
    (total, orden) => total + orden.montoEgreso,
    0
  );
  const totalConDocumento = ordenesFiltradas.filter(
    (orden) => orden.rutaDocumento
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
            <Metrica label="Órdenes" value={String(ordenesFiltradas.length)} />
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
                placeholder="Orden, descripción, beneficiario o cheque"
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
                <span>{grupo.cantidadOrdenes} orden(es)</span>
                <span className="font-semibold tabular-nums text-slate-950">
                  {formatearMonto(grupo.total)}
                </span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-200/45 p-3">
              {grupo.ordenes.map((orden) => {
                const urlDocumento = construirUrlDocumentoAuditoria(
                  SUPABASE_URL,
                  orden.rutaDocumento
                );

                return (
                  <article
                    key={orden.noOrden}
                    className="overflow-hidden border border-slate-300 bg-white shadow-sm"
                  >
                    <div className="border-b-2 border-[#005f48] bg-gradient-to-r from-[#dcece7] via-[#edf5f2] to-white px-4 py-4">
                      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#005f48]">
                        <span className="h-1.5 w-1.5 bg-[#005f48]" />
                        Datos generales de la orden
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[105px_100px_minmax(280px,1fr)_145px_150px] lg:items-start">
                        <DatoGeneralOrden
                          label="Fecha"
                          value={formatearFecha(orden.fecha)}
                        />
                        <DatoGeneralOrden
                          label="Orden"
                          value={`#${orden.noOrden}`}
                          destacado
                        />
                        <DatoGeneralOrden
                          label="Descripción"
                          value={orden.descripcion}
                        />
                        <DatoGeneralOrden
                          label="Egreso total"
                          value={formatearMonto(orden.montoEgreso)}
                          align="right"
                          destacado
                        />

                        <div className="text-left lg:text-center">
                          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                            Orden de pago
                          </div>
                          {urlDocumento ? (
                            <a
                              href={urlDocumento}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center gap-2 rounded-md border border-[#005f48] bg-white px-3 text-[11px] font-semibold text-[#005f48] shadow-sm transition hover:bg-emerald-50"
                              title={
                                orden.nombreDocumento ??
                                `Orden de pago #${orden.noOrden}`
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
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 px-4 py-4 lg:pl-8">
                      <div className="mb-3 flex items-center justify-between gap-3 border-l-4 border-slate-400 pl-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                          Detalle de beneficiarios y cheques
                        </div>
                        <div className="border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                          {orden.detalles.length} renglón(es)
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        <table className="w-full min-w-[680px] border-collapse text-left text-[12px]">
                              <thead className="bg-slate-200/85 text-[10px] uppercase tracking-[0.14em] text-slate-600">
                                <tr>
                                  <th className="w-[70px] px-3 py-2 text-center font-semibold">
                                    Renglón
                                  </th>
                                  <th className="w-[180px] px-3 py-2 font-semibold">
                                    Cheque
                                  </th>
                                  <th className="px-3 py-2 font-semibold">
                                    Beneficiario
                                  </th>
                                  <th className="w-[170px] px-3 py-2 text-right font-semibold">
                                    Egreso
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {orden.detalles.map((detalle, index) => (
                                  <tr
                                    key={`${detalle.cheque}-${detalle.proveedor}-${index}`}
                                    className="bg-white/70 hover:bg-emerald-50/35"
                                  >
                                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-400">
                                      {index + 1}
                                    </td>
                                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-800">
                                      {detalle.cheque}
                                    </td>
                                    <td className="px-3 py-2.5 leading-5 text-slate-700">
                                      {detalle.proveedor}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-950">
                                      {formatearMonto(detalle.montoEgreso)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                        </table>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function DatoGeneralOrden({
  label,
  value,
  align = "left",
  destacado = false,
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  destacado?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-left lg:text-right" : "text-left"}>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
        {label}
      </div>
      <div
        className={[
          "text-[12px] leading-5",
          destacado ? "font-semibold text-slate-950" : "text-slate-700",
        ].join(" ")}
      >
        {value}
      </div>
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
