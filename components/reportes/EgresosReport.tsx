"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  obtenerOrdenesEstructuradas,
  Orden,
} from "@/services/ordenes.service";
import EjecutarOrdenPagoModal from "@/components/EjecutarOrdenPagoModal";

const EPSILON = 0.01;

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isOrdenNoCompleta(order: Orden) {
  return Math.abs(order.diferencia) > EPSILON;
}

function isOrdenPendienteEjecucion(order: Orden) {
  return order.diferencia > EPSILON;
}

function getEstadoTexto(order: Orden) {
  if (order.diferencia > EPSILON) return "Pendiente";
  if (order.diferencia < -EPSILON) return "Sobreejecución";
  return "Conciliada";
}

function getEstadoClass(order: Orden) {
  if (order.diferencia > EPSILON) {
    return "border-amber-500 text-amber-700 bg-amber-50/60";
  }

  if (order.diferencia < -EPSILON) {
    return "border-rose-500 text-rose-700 bg-rose-50/60";
  }

  return "border-emerald-500 text-emerald-700 bg-emerald-50/60";
}

function getRowAccent(order: Orden) {
  if (order.diferencia > EPSILON) return "border-l-amber-500";
  if (order.diferencia < -EPSILON) return "border-l-rose-500";
  return "border-l-transparent";
}

function getDiffClass(value: number) {
  if (value > EPSILON) return "text-amber-700 font-semibold";
  if (value < -EPSILON) return "text-rose-700 font-semibold";
  return "text-slate-700";
}

function obtenerOrdenPagoId(order: Orden | null) {
  if (!order) return null;

  const raw = (order as any).orden_pago_id ?? order.no_orden;
  const id = Number(raw);

  return Number.isFinite(id) ? id : null;
}

function Encabezado() {
  return (
    <div className="pdf-encabezado fixed left-0 top-0 z-50 w-full bg-white">
      <img
        src="/logo.svg"
        alt="Encabezado"
        className="block h-auto w-full"
      />
    </div>
  );
}

function PrintStyles() {
  return (
    <style jsx global>{`
      @page {
        size: letter landscape;
        margin: 0;
      }

      .pdf-encabezado,
      .print-only {
        display: none;
      }

      @media print {
        html,
        body {
          width: 11in;
          min-height: 8.5in;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          overflow: visible !important;
        }

        .no-print {
          display: none !important;
        }

        .pdf-encabezado {
          display: block !important;
          position: fixed !important;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 9999;
          background: #ffffff !important;
        }

        .print-only {
          display: block !important;
        }

        .print-root {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #0f172a !important;
        }

        .print-page {
          padding: 1.08in 0.35in 0.45in 0.35in !important;
        }

        .print-header {
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-main {
          padding: 0 !important;
          overflow: visible !important;
        }

        .print-table-wrap {
          height: auto !important;
          overflow: visible !important;
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          backdrop-filter: none !important;
        }

        .print-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-size: 8.5px !important;
        }

        .print-table thead {
          position: static !important;
          background: #f8fafc !important;
        }

        .print-table th,
        .print-table td {
          padding: 4px 5px !important;
          border-color: #d7dee8 !important;
          vertical-align: top !important;
        }

        .print-hide {
          display: none !important;
        }

        .print-description {
          display: block !important;
          overflow: visible !important;
          -webkit-line-clamp: unset !important;
          line-clamp: unset !important;
          white-space: normal !important;
          line-height: 1.25 !important;
        }

        .print-row,
        .print-row:hover {
          background: #ffffff !important;
        }

        .print-group-row {
          background: #eef2f7 !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-signature {
          margin-top: 0.55in !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `}</style>
  );
}

export default function OrdenesReport() {
  const [data, setData] = useState<Orden[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [modalEjecucionOpen, setModalEjecucionOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(
    null
  );

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await obtenerOrdenesEstructuradas();
    setData(res);
  }

  function exportarPDF() {
    window.print();
  }

  function toggle(id: string) {
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function abrirModalEjecucion(order: Orden) {
    setOrdenSeleccionada(order);
    setModalEjecucionOpen(true);
  }

  function cerrarModalEjecucion() {
    setModalEjecucionOpen(false);
    setOrdenSeleccionada(null);
  }

  const totalHaber = useMemo(() => {
    return data.reduce((acc, o) => acc + o.total_haber, 0);
  }, [data]);

  const totalEjecutado = useMemo(() => {
    return data.reduce((acc, o) => acc + o.total_ejecutado, 0);
  }, [data]);

  const totalDif = totalHaber - totalEjecutado;

  const porcentajeEjecucion =
    totalHaber > 0 ? (totalEjecutado / totalHaber) * 100 : 0;

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return data;

    return data.filter((o) => {
      const noOrden = o.no_orden ?? "";
      const descripcion = o.descripcion ?? "";

      const matchOrden =
        noOrden.toLowerCase().includes(term) ||
        descripcion.toLowerCase().includes(term);

      const matchBeneficiario = o.beneficiarios.some((b) =>
        (b.nombre ?? "").toLowerCase().includes(term)
      );

      return matchOrden || matchBeneficiario;
    });
  }, [data, search]);

  const ordenesPendientes = useMemo(() => {
    return filtered
      .filter(isOrdenNoCompleta)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  }, [filtered]);

  const ordenesConciliadas = useMemo(() => {
    return filtered.filter((order) => !isOrdenNoCompleta(order));
  }, [filtered]);

  const grupos = useMemo(() => {
    return [
      {
        id: "pendientes",
        titulo: "Pendientes de conciliación",
        descripcion: "Órdenes con diferencia entre egreso y ejecución.",
        items: ordenesPendientes,
      },
      {
        id: "conciliadas",
        titulo: "Conciliadas",
        descripcion: "Órdenes cuya ejecución coincide con el egreso.",
        items: ordenesConciliadas,
      },
    ];
  }, [ordenesPendientes, ordenesConciliadas]);

  const ordenPagoIdSeleccionada = obtenerOrdenPagoId(ordenSeleccionada);

  return (
    <>
      <PrintStyles />
      <Encabezado />

      <div className="print-root print-page grid h-full grid-rows-[auto_1fr] bg-[#eef1f5] text-slate-800">
        {/* TOP BAR */}
        <header className="print-header border-b border-slate-300 bg-white/70 backdrop-blur-xl">
          <div className="grid grid-cols-1 border-b border-slate-200 lg:grid-cols-[1fr_auto]">
            <div className="px-5 py-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Sistema financiero municipal
              </div>

              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[18px] font-semibold tracking-tight text-slate-950">
                  Órdenes de pago
                </h1>

                <span className="text-[12px] text-slate-500">
                  Control de ejecución presupuestaria
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-slate-200 lg:grid-cols-4 lg:border-l lg:border-t-0">
              <Metric label="Egreso" value={formatMoney(totalHaber)} />
              <Metric label="Ejecutado" value={formatMoney(totalEjecutado)} />
              <Metric
                label="Diferencia"
                value={formatMoney(totalDif)}
                valueClass={getDiffClass(totalDif)}
              />
              <Metric
                label="Ejecución"
                value={`${porcentajeEjecucion.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* COMMAND BAR */}
          <div className="no-print grid grid-cols-1 gap-3 px-5 py-2.5 lg:grid-cols-[minmax(360px,520px)_1fr_auto_auto] lg:items-center">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
                Buscar
              </span>

              <input
                className="h-8 w-full border border-slate-300 bg-white/75 pl-[58px] pr-3 text-[12px] text-slate-800 outline-none backdrop-blur-md placeholder:text-slate-400 focus:border-slate-700"
                placeholder="orden, descripción o beneficiario"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="hidden text-[12px] text-slate-500 lg:block">
              Vista operativa compacta · agrupación automática por estado de
              conciliación.
            </div>

            <div className="flex items-center gap-4 text-[12px]">
              <Counter label="Pendientes" value={ordenesPendientes.length} />
              <Counter label="Conciliadas" value={ordenesConciliadas.length} />
              <Counter label="Total" value={filtered.length} strong />
            </div>

            <button
              type="button"
              onClick={exportarPDF}
              className="h-8 border border-slate-900 bg-slate-950 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
            >
              Exportar PDF
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main className="print-main overflow-hidden p-4">
          <div className="print-table-wrap h-full overflow-auto border border-slate-300 bg-white/65 backdrop-blur-xl">
            <table className="print-table w-full min-w-[1260px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-20 bg-[#f7f9fb]/95 backdrop-blur-xl">
                <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="print-hide w-[40px] px-3 py-2 font-semibold"></th>
                  <th className="w-[145px] px-3 py-2 font-semibold">
                    Estado
                  </th>
                  <th className="w-[130px] px-3 py-2 font-semibold">
                    Orden
                  </th>
                  <th className="w-[110px] px-3 py-2 font-semibold">
                    Fecha
                  </th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="w-[150px] px-3 py-2 text-right font-semibold">
                    Egreso
                  </th>
                  <th className="w-[150px] px-3 py-2 text-right font-semibold">
                    Ejecutado
                  </th>
                  <th className="w-[150px] px-3 py-2 text-right font-semibold">
                    Diferencia
                  </th>
                  <th className="w-[95px] px-3 py-2 text-center font-semibold">
                    Benef.
                  </th>
                </tr>
              </thead>

              <tbody>
                {grupos.map((grupo) => (
                  <Fragment key={grupo.id}>
                    <tr className="print-group-row border-y border-slate-300 bg-slate-100/85">
                      <td colSpan={9} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800">
                              {grupo.titulo}
                            </div>

                            <div className="text-[11px] text-slate-500">
                              {grupo.descripcion}
                            </div>
                          </div>

                          <div className="text-[11px] font-semibold text-slate-600">
                            {grupo.items.length} registros
                          </div>
                        </div>
                      </td>
                    </tr>

                    {grupo.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="border-b border-slate-200 px-3 py-7 text-center text-[12px] text-slate-400"
                        >
                          No hay registros en esta sección.
                        </td>
                      </tr>
                    )}

                    {grupo.items.map((order) => {
                      const isOpen = open.includes(order.no_orden);
                      const pendienteEjecucion =
                        isOrdenPendienteEjecucion(order);

                      return (
                        <Fragment key={order.no_orden}>
                          <tr
                            onClick={() => {
                              if (pendienteEjecucion) {
                                abrirModalEjecucion(order);
                              }
                            }}
                            title={
                              pendienteEjecucion
                                ? "Registrar ejecución presupuestaria"
                                : "Orden sin acción de ejecución"
                            }
                            className={[
                              "print-row group border-b border-l-2 border-b-slate-200 bg-white/70 transition-colors",
                              getRowAccent(order),
                              pendienteEjecucion
                                ? "cursor-pointer hover:bg-[#f3fbf8]"
                                : "cursor-default hover:bg-slate-50/95",
                            ].join(" ")}
                          >
                            <td className="print-hide px-3 py-2 align-top">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(order.no_orden);
                                }}
                                className="h-6 w-6 border border-slate-300 bg-white text-[14px] leading-none text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
                                title={
                                  isOpen ? "Ocultar detalle" : "Ver detalle"
                                }
                              >
                                {isOpen ? "−" : "+"}
                              </button>
                            </td>

                            <td className="relative px-3 py-2 align-top">
                              <span
                                className={[
                                  "inline-block border-l-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
                                  getEstadoClass(order),
                                ].join(" ")}
                              >
                                {getEstadoTexto(order)}
                              </span>

                              {pendienteEjecucion && (
                                <div className="no-print pointer-events-none absolute left-3 top-[34px] z-30 border border-slate-300 bg-white/95 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-700 opacity-0 shadow-sm backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100">
                                  Click para ejecutar orden
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-2 align-top font-semibold tabular-nums text-slate-950">
                              {order.no_orden}
                            </td>

                            <td className="px-3 py-2 align-top tabular-nums text-slate-600">
                              {order.fecha}
                            </td>

                            <td className="px-3 py-2 align-top text-slate-700">
                              <div className="print-description line-clamp-2 leading-5">
                                {order.descripcion}
                              </div>
                            </td>

                            <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800">
                              {formatMoney(order.total_haber)}
                            </td>

                            <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800">
                              {formatMoney(order.total_ejecutado)}
                            </td>

                            <td
                              className={[
                                "px-3 py-2 align-top text-right tabular-nums",
                                getDiffClass(order.diferencia),
                              ].join(" ")}
                            >
                              {formatMoney(order.diferencia)}
                            </td>

                            <td className="px-3 py-2 text-center align-top tabular-nums text-slate-700">
                              {order.beneficiarios.length}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="border-b border-slate-300 bg-[#f8fafc]/90">
                              <td colSpan={9} className="px-10 py-3">
                                <DetalleOrden
                                  order={order}
                                  formatMoney={formatMoney}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-[13px] text-slate-500"
                    >
                      No se encontraron órdenes con el criterio ingresado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <FirmaReporte />
        </main>
      </div>

      <div className="no-print">
        <EjecutarOrdenPagoModal
          open={modalEjecucionOpen}
          ordenPagoId={ordenPagoIdSeleccionada}
          ordenLabel={ordenSeleccionada?.no_orden ?? null}
          montoPendiente={
            ordenSeleccionada ? Math.abs(ordenSeleccionada.diferencia) : 0
          }
          onClose={cerrarModalEjecucion}
          onInsertado={cargar}
        />
      </div>
    </>
  );
}

type MetricProps = {
  label: string;
  value: string;
  valueClass?: string;
};

function Metric({
  label,
  value,
  valueClass = "text-slate-950",
}: MetricProps) {
  return (
    <div className="min-w-[145px] border-r border-slate-200 px-4 py-3 last:border-r-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div
        className={`mt-1 whitespace-nowrap text-[13px] font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

type CounterProps = {
  label: string;
  value: number;
  strong?: boolean;
};

function Counter({ label, value, strong = false }: CounterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span
        className={[
          "tabular-nums",
          strong
            ? "font-semibold text-slate-950"
            : "font-semibold text-slate-700",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function FirmaReporte() {
  return (
    <div className="print-only print-signature">
      <div className="ml-auto w-[340px] text-center text-slate-900">
        <div className="mb-2 border-t border-slate-900"></div>

        <div className="text-[12px] font-semibold">
          María de los Ángeles Arévalo Cuello
        </div>

        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
          Tesorera Municipal
        </div>
      </div>
    </div>
  );
}

type DetalleOrdenProps = {
  order: Orden;
  formatMoney: (value: number) => string;
};

function DetalleOrden({ order, formatMoney }: DetalleOrdenProps) {
  return (
    <div className="border border-slate-300 bg-white/80 backdrop-blur-xl">
      <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-slate-100/80 px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            Detalle de ejecución
          </div>

          <div className="text-[11px] text-slate-500">
            Beneficiarios, egreso bancario y partidas ejecutadas.
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          Orden{" "}
          <span className="font-semibold tabular-nums text-slate-800">
            {order.no_orden}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {order.beneficiarios.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-[300px_160px_1fr] bg-white/70"
          >
            <div className="border-r border-slate-200 px-3 py-2">
              <div className="text-[12px] font-semibold text-slate-900">
                {b.nombre}
              </div>

              <div className="mt-0.5 text-[11px] text-slate-500">
                ID: {b.id}
              </div>
            </div>

            <div className="border-r border-slate-200 px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Egreso
              </div>

              <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-950">
                {formatMoney(b.haber)}
              </div>
            </div>

            <div>
              {b.ejecuciones.length > 0 ? (
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">
                        Código presupuestario
                      </th>

                      <th className="w-[160px] px-3 py-2 text-right font-semibold">
                        Ejecutado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {b.ejecuciones.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 text-slate-700">
                          {e.codigo_presupuestario}
                        </td>

                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                          {formatMoney(e.monto_ejecutado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-3 py-3 text-[12px] text-slate-400">
                  Sin ejecución presupuestaria asociada.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}