"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  FileDown,
  FileSearch,
  LoaderCircle,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { SUPABASE_URL } from "@/shared/infrastructure/supabase";
import {
  agruparEgresosAuditoriaPorMes,
  agruparEgresosAuditoriaPorOrden,
  construirConfirmacionExpediente,
  construirUrlDocumentoAuditoria,
  esConfirmacionExpedienteValida,
  filtrarOrdenesAuditoria,
  obtenerProveedoresAuditoria,
  requiereConfirmacionExpediente,
  type EgresoAuditoria,
} from "@/modules/auditoria/domain/auditoria-egresos";

export default function AuditoriaEgresos({
  egresos,
}: {
  egresos: EgresoAuditoria[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [generandoExpediente, setGenerandoExpediente] = useState(false);
  const [confirmandoVolumen, setConfirmandoVolumen] = useState(false);
  const [confirmacionVolumen, setConfirmacionVolumen] = useState("");
  const [estadoExpediente, setEstadoExpediente] = useState<{
    tipo: "ok" | "error";
    mensaje: string;
  } | null>(null);
  const ordenes = useMemo(
    () => agruparEgresosAuditoriaPorOrden(egresos),
    [egresos]
  );
  const proveedores = useMemo(
    () => obtenerProveedoresAuditoria(ordenes),
    [ordenes]
  );

  const ordenesFiltradas = useMemo(
    () =>
      filtrarOrdenesAuditoria(ordenes, {
        busqueda,
        fechaDesde,
        fechaHasta,
        proveedor,
      }),
    [busqueda, fechaDesde, fechaHasta, ordenes, proveedor]
  );
  const ordenesConDocumento = useMemo(
    () => ordenesFiltradas.filter((orden) => orden.rutaDocumento),
    [ordenesFiltradas]
  );

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
  const totalConDocumento = ordenesConDocumento.length;
  const totalSinDocumento = ordenesFiltradas.length - totalConDocumento;
  const filtrosActivos = Boolean(
    busqueda || fechaDesde || fechaHasta || proveedor
  );
  const confirmacionEsperada = construirConfirmacionExpediente(
    totalConDocumento
  );

  function limpiarFiltros() {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
    setProveedor("");
    setEstadoExpediente(null);
  }

  function solicitarExpediente() {
    if (totalConDocumento === 0 || generandoExpediente) return;

    if (requiereConfirmacionExpediente(totalConDocumento)) {
      setEstadoExpediente(null);
      setConfirmacionVolumen("");
      setConfirmandoVolumen(true);
      return;
    }

    void generarExpedientePdf();
  }

  async function generarExpedientePdf(confirmacion = "") {
    if (totalConDocumento === 0 || generandoExpediente) return;

    try {
      setGenerandoExpediente(true);
      setEstadoExpediente(null);

      const response = await fetch("/api/auditoria/expediente-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordenes: ordenesConDocumento.map((orden) => orden.noOrden),
          confirmacionVolumen: confirmacion,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error || "No se pudo generar el expediente de auditoría."
        );
      }

      const archivo = await response.blob();
      const urlDescarga = URL.createObjectURL(archivo);
      const disposition = response.headers.get("content-disposition") ?? "";
      const nombreServidor = disposition.match(/filename="([^"]+)"/i)?.[1];
      const enlace = document.createElement("a");

      enlace.href = urlDescarga;
      enlace.download = nombreServidor || "expediente-auditoria.pdf";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(urlDescarga), 1_000);

      const cantidadDocumentos =
        response.headers.get("x-document-count") ?? String(totalConDocumento);
      const cantidadPaginas = response.headers.get("x-page-count");

      setConfirmandoVolumen(false);
      setEstadoExpediente({
        tipo: "ok",
        mensaje: `Expediente generado con ${cantidadDocumentos} documento(s)${
          cantidadPaginas ? ` y ${cantidadPaginas} página(s)` : ""
        }.`,
      });
    } catch (error) {
      setEstadoExpediente({
        tipo: "error",
        mensaje:
          error instanceof Error
            ? error.message
            : "No se pudo generar el expediente de auditoría.",
      });
    } finally {
      setGenerandoExpediente(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-full w-full max-w-[1700px] content-start gap-3 p-1 text-slate-800">
      <header className="glass-panel relative overflow-visible">
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

        <div className="grid gap-3 bg-white/35 px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(300px,1fr)_155px_155px_minmax(220px,0.65fr)_auto_auto] xl:items-end">
          <label className="grid gap-1 md:col-span-2 xl:col-span-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Buscar
            </span>
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Orden, descripción, proveedor o cheque"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-[#005f48]"
              />
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Desde
            </span>
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(event) => setFechaDesde(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#005f48]"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Hasta
            </span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(event) => setFechaHasta(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#005f48]"
            />
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Proveedor
            </span>
            <select
              value={proveedor}
              onChange={(event) => setProveedor(event.target.value)}
              className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#005f48]"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>

          <button data-shortcut="021"
            type="button"
            onClick={limpiarFiltros}
            disabled={!filtrosActivos}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-[11px] font-semibold text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Limpiar
          </button>

          <button data-shortcut="022"
            type="button"
            onClick={solicitarExpediente}
            disabled={totalConDocumento === 0 || generandoExpediente}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#003331] px-4 text-[11px] font-semibold text-white transition hover:bg-[#004b3a] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {generandoExpediente ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden="true" />
            )}
            {generandoExpediente
              ? "Generando..."
              : `Expediente (${totalConDocumento})`}
          </button>
        </div>

        {(totalSinDocumento > 0 || estadoExpediente) && (
          <div
            role={estadoExpediente?.tipo === "error" ? "alert" : "status"}
            className={[
              "flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] font-medium",
              estadoExpediente?.tipo === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : estadoExpediente?.tipo === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
            ].join(" ")}
          >
            <span>
              {estadoExpediente?.mensaje ??
                `${totalSinDocumento} orden(es) filtrada(s) no tienen PDF y no se incluirán.`}
            </span>
            {estadoExpediente && totalSinDocumento > 0 && (
              <span className="font-normal text-slate-500">
                {totalSinDocumento} orden(es) sin PDF se omitieron.
              </span>
            )}
          </div>
        )}
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
              Ajuste la búsqueda, las fechas o el proveedor seleccionado.
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
                    <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
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
                            <a data-shortcut="023"
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

      {confirmandoVolumen && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4">
          <button data-shortcut="024"
            type="button"
            aria-label="Cerrar confirmación"
            onClick={() => {
              if (!generandoExpediente) setConfirmandoVolumen(false);
            }}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacion-expediente"
            className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/70 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="titulo-confirmacion-expediente"
                    className="text-[15px] font-semibold text-slate-950"
                  >
                    Verificar expediente grande
                  </h2>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">
                    La selección contiene {totalConDocumento} documentos PDF.
                  </p>
                </div>
              </div>

              <button data-shortcut="025"
                type="button"
                aria-label="Cerrar"
                onClick={() => setConfirmandoVolumen(false)}
                disabled={generandoExpediente}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-[12px] leading-5 text-slate-600">
                Para evitar generar expedientes innecesariamente grandes,
                confirme que revisó los filtros y que necesita incluir todos
                estos documentos.
              </p>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Se incluirán
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {totalConDocumento} PDF
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Sin documento
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {totalSinDocumento} orden(es)
                  </div>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-[12px] text-slate-700">
                  Escriba{" "}
                  <strong className="font-mono text-slate-950">
                    {confirmacionEsperada}
                  </strong>{" "}
                  para continuar:
                </span>
                <input
                  autoFocus
                  value={confirmacionVolumen}
                  onChange={(event) =>
                    setConfirmacionVolumen(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      esConfirmacionExpedienteValida(
                        confirmacionVolumen,
                        totalConDocumento
                      )
                    ) {
                      void generarExpedientePdf(confirmacionVolumen);
                    }
                  }}
                  disabled={generandoExpediente}
                  placeholder={confirmacionEsperada}
                  className="h-10 rounded-md border border-slate-300 px-3 font-mono text-[13px] uppercase outline-none focus:border-amber-600 disabled:bg-slate-100"
                />
              </label>

              {estadoExpediente?.tipo === "error" && (
                <div
                  role="alert"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700"
                >
                  {estadoExpediente.mensaje}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button data-shortcut="026"
                type="button"
                onClick={() => setConfirmandoVolumen(false)}
                disabled={generandoExpediente}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button data-shortcut="027"
                type="button"
                onClick={() =>
                  void generarExpedientePdf(confirmacionVolumen)
                }
                disabled={
                  generandoExpediente ||
                  !esConfirmacionExpedienteValida(
                    confirmacionVolumen,
                    totalConDocumento
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#003331] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {generandoExpediente && (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {generandoExpediente ? "Generando..." : "Generar expediente"}
              </button>
            </div>
          </section>
        </div>
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
