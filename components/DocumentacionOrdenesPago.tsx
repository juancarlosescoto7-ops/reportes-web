"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSearch, RefreshCcw } from "lucide-react";

import RequisitoDocumentoCard from "@/components/RequisitoDocumentoCard";
import type { DocumentoProyecto } from "@/services/documentacionProyectos";
import {
  obtenerOrdenesPagoSinArchivo,
  subirArchivoOrdenPago,
  type OrdenPagoSinArchivo,
} from "@/services/documentosOrdenPago.service";

export default function DocumentacionOrdenesPago() {
  const [ordenes, setOrdenes] = useState<OrdenPagoSinArchivo[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarOrdenes = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const data = await obtenerOrdenesPagoSinArchivo();
      setOrdenes(data);
      setOrdenSeleccionada((actual) =>
        actual && data.some((orden) => orden.noOrden === actual)
          ? actual
          : data[0]?.noOrden ?? null
      );
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las ordenes sin archivo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarOrdenes();
  }, [cargarOrdenes]);

  const ordenesFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    if (!term) return ordenes;

    return ordenes.filter((orden) => {
      return (
        String(orden.noOrden).includes(term) ||
        orden.descripcion.toLowerCase().includes(term)
      );
    });
  }, [busqueda, ordenes]);

  const ordenActual = ordenes.find(
    (orden) => orden.noOrden === ordenSeleccionada
  );

  const documentoOrden = useMemo<DocumentoProyecto | null>(() => {
    if (!ordenActual) return null;

    return {
      id_proyecto: ordenActual.noOrden,
      nombre_proyecto: `Orden ${ordenActual.noOrden}`,
      id_requisito: 0,
      nombre_requisito: `Orden de pago #${ordenActual.noOrden}`,
      url_documento: null,
      fecha_documento: ordenActual.fecha,
      mensaje: "",
      codigo_presupuestario: "",
    };
  }, [ordenActual]);

  async function subirOrden(archivo: File) {
    if (!ordenActual) return;

    await subirArchivoOrdenPago({
      archivo,
      noOrden: ordenActual.noOrden,
    });

    await cargarOrdenes();
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-1 text-[12px] text-slate-800 lg:grid-cols-[20rem_1fr]">
      <section className="glass-panel min-h-0 overflow-hidden">
        <div className="border-b border-slate-300/60 bg-white/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Control documental
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold text-slate-950">
              Ordenes sin PDF
            </div>

            <button
              type="button"
              onClick={cargarOrdenes}
              disabled={cargando}
              className="grid h-7 w-7 place-items-center rounded-md border border-slate-300/70 bg-white/65 text-slate-600 transition hover:border-[#005f48]/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              title="Actualizar"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white/35 px-2 py-2">
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar orden"
            className="h-8 w-full rounded-md border border-slate-300 bg-white/75 px-2 text-[12px] outline-none placeholder:text-slate-400 focus:border-slate-700"
          />
        </div>

        <div className="h-[calc(100%-91px)] overflow-y-auto px-2 py-2">
          {cargando ? (
            <EstadoLista texto="Cargando ordenes..." />
          ) : ordenesFiltradas.length === 0 ? (
            <EstadoLista texto="No hay ordenes pendientes." />
          ) : (
            <div className="space-y-1">
              {ordenesFiltradas.map((orden) => {
                const active = orden.noOrden === ordenSeleccionada;

                return (
                  <button
                    key={orden.noOrden}
                    type="button"
                    onClick={() => setOrdenSeleccionada(orden.noOrden)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOrdenSeleccionada(orden.noOrden);
                    }}
                    className={[
                      "grid w-full grid-cols-[3px_1fr] border border-transparent text-left transition-colors",
                      active
                        ? "rounded-md bg-white/70 text-slate-950 shadow-sm"
                        : "rounded-md text-slate-500 hover:bg-white/45 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-full min-h-[48px]",
                        active ? "accent-rail" : "bg-transparent",
                      ].join(" ")}
                    />

                    <span className="min-w-0 px-2 py-2">
                      <span className="block text-[13px] font-semibold tabular-nums">
                        #{orden.noOrden}
                      </span>

                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {orden.descripcion || "Sin descripcion"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel min-h-0 overflow-hidden">
        <div className="border-b border-slate-300/60 bg-white/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Carga de archivo
          </div>

          <div className="mt-0.5 text-[13px] font-semibold text-slate-950">
            {ordenActual ? `Orden #${ordenActual.noOrden}` : "Sin orden seleccionada"}
          </div>
        </div>

        <div className="grid min-h-[calc(100%-54px)] content-start gap-3 p-3">
          {error && (
            <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}

          {ordenActual && documentoOrden ? (
            <>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,420px)_1fr]">
                <div>
                  <RequisitoDocumentoCard
                    documento={documentoOrden}
                    inputIdSuffix={`input-orden-pago-${ordenActual.noOrden}`}
                    nombreEscaneo={`Orden_pago_${ordenActual.noOrden}.pdf`}
                    mostrarEscanerProfesional
                    onAbrir={() => undefined}
                    onActualizado={cargarOrdenes}
                    onSubirArchivo={subirOrden}
                  />
                </div>

                <div className="glass-subtle px-3 py-3">
                  <div className="flex items-start gap-2">
                    <FileSearch
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />

                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-900">
                        Carga y escaneo movil
                      </div>

                      <div className="mt-1 text-[12px] leading-5 text-slate-500">
                        Arrastre un PDF sobre la tarjeta de la orden o use el
                        escaner profesional movil cuando la licencia este
                        configurada. Sin licencia, el escaneo queda disponible
                        al abrir este modulo desde el telefono.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-subtle px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Detalle
                </div>

                <div className="mt-2 grid gap-2 text-[12px]">
                  <Dato label="Orden" value={`#${ordenActual.noOrden}`} />
                  <Dato
                    label="Fecha"
                    value={formatearFecha(ordenActual.fecha)}
                  />
                  <Dato
                    label="Descripcion"
                    value={ordenActual.descripcion || "Sin descripcion"}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="glass-subtle border-dashed px-6 py-8 text-center">
                <FileSearch
                  className="mx-auto h-7 w-7 text-slate-400"
                  aria-hidden="true"
                />

                <div className="mt-3 text-[12px] font-semibold text-slate-700">
                  No hay orden seleccionada
                </div>

                <div className="mt-1 max-w-[320px] text-[12px] leading-5 text-slate-500">
                  Cuando exista una orden sin archivo, aparecera aqui para subir
                  o escanear su PDF.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EstadoLista({ texto }: { texto: string }) {
  return (
    <div className="px-2 py-6 text-center text-[12px] text-slate-400">
      {texto}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-slate-200/70 pb-2 last:border-b-0 last:pb-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div className="min-w-0 break-words text-slate-800">{value}</div>
    </div>
  );
}

function formatearFecha(value: string | null) {
  if (!value) return "-";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "-";

  return fecha.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
