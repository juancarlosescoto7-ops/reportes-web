"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Maximize2,
  Minimize2,
  RefreshCcw,
} from "lucide-react";

import RequisitoDocumentoCard from "@/components/RequisitoDocumentoCard";
import { SUPABASE_URL } from "@/lib/supabase";
import type { DocumentoProyecto } from "@/services/documentacionProyectos";
import {
  MENSAJE_ORDEN_CON_DOCUMENTO,
  obtenerOrdenesPagoConEstadoDocumento,
  OrdenPagoConDocumentoError,
  subirArchivoOrdenPago,
  type OrdenPagoConDocumento,
} from "@/services/documentosOrdenPago.service";

export default function DocumentacionOrdenesPago() {
  const [ordenes, setOrdenes] = useState<OrdenPagoConDocumento[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  const [visorExpandido, setVisorExpandido] = useState(false);
  const visorRef = useRef<HTMLElement | null>(null);

  const cargarOrdenes = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const data = await obtenerOrdenesPagoConEstadoDocumento();
      setOrdenes(data);
      setOrdenSeleccionada((actual) =>
        actual && data.some((orden) => orden.noOrden === actual)
          ? actual
          : data[0]?.noOrden ?? null
      );
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las órdenes de pago.");
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

  const totalConDocumento = useMemo(
    () => ordenes.filter((orden) => orden.tieneDocumento).length,
    [ordenes]
  );

  const urlDocumentoOrden = useMemo(
    () => construirUrlDocumentoOrden(ordenActual?.rutaDocumento ?? null),
    [ordenActual?.rutaDocumento]
  );

  const documentoOrden = useMemo<DocumentoProyecto | null>(() => {
    if (!ordenActual) return null;

    return {
      id_proyecto: ordenActual.noOrden,
      nombre_proyecto: `Orden ${ordenActual.noOrden}`,
      id_requisito: 0,
      nombre_requisito: `Orden de pago #${ordenActual.noOrden}`,
      url_documento: ordenActual.rutaDocumento,
      fecha_documento: ordenActual.fecha,
      mensaje: "",
      codigo_presupuestario: "",
    };
  }, [ordenActual]);

  async function subirOrden(archivo: File) {
    if (!ordenActual) return;

    if (ordenActual.tieneDocumento) {
      mostrarAdvertenciaDocumentoExistente(ordenActual.noOrden);
      throw new OrdenPagoConDocumentoError();
    }

    try {
      await subirArchivoOrdenPago({
        archivo,
        noOrden: ordenActual.noOrden,
      });
    } catch (err) {
      if (err instanceof OrdenPagoConDocumentoError) {
        mostrarAdvertenciaDocumentoExistente(ordenActual.noOrden);
        await cargarOrdenes();
      }

      throw err;
    }

    setAdvertencia(null);
  }

  function mostrarAdvertenciaDocumentoExistente(noOrden: number) {
    setAdvertencia(`Orden #${noOrden}: ${MENSAJE_ORDEN_CON_DOCUMENTO}`);
  }

  function seleccionarOrden(noOrden: number) {
    setOrdenSeleccionada(noOrden);
    setAdvertencia(null);
    setVisorExpandido(false);
  }

  function abrirDocumentoOrden(rutaDocumento: string | null) {
    if (!construirUrlDocumentoOrden(rutaDocumento)) return;

    visorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
              Órdenes de pago
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

        <div className="grid grid-cols-2 border-b border-slate-200 bg-white/35 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <div className="px-3 py-1.5 text-slate-500">
            Total <span className="text-slate-800">{ordenes.length}</span>
          </div>
          <div className="border-l border-slate-200 px-3 py-1.5 text-emerald-700">
            Con PDF <span className="text-emerald-900">{totalConDocumento}</span>
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

        <div className="h-[calc(100%-119px)] overflow-y-auto px-2 py-2">
          {cargando ? (
            <EstadoLista texto="Cargando órdenes..." />
          ) : ordenesFiltradas.length === 0 ? (
            <EstadoLista texto="No se encontraron órdenes." />
          ) : (
            <div className="space-y-1">
              {ordenesFiltradas.map((orden) => {
                const active = orden.noOrden === ordenSeleccionada;

                return (
                  <button
                    key={orden.noOrden}
                    type="button"
                    onClick={() => seleccionarOrden(orden.noOrden)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      seleccionarOrden(orden.noOrden);
                      event.dataTransfer.dropEffect = orden.tieneDocumento
                        ? "none"
                        : "copy";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      seleccionarOrden(orden.noOrden);

                      if (orden.tieneDocumento) {
                        mostrarAdvertenciaDocumentoExistente(orden.noOrden);
                      }
                    }}
                    className={[
                      "grid w-full grid-cols-[3px_1fr] border border-transparent text-left transition-colors",
                      orden.tieneDocumento
                        ? active
                          ? "rounded-md border-emerald-300/80 bg-emerald-100/75 text-emerald-950 shadow-sm"
                          : "rounded-md bg-emerald-50/65 text-emerald-800 hover:bg-emerald-100/70"
                        : active
                          ? "rounded-md bg-white/70 text-slate-950 shadow-sm"
                          : "rounded-md text-slate-500 hover:bg-white/45 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-full min-h-[48px]",
                        orden.tieneDocumento
                          ? "bg-emerald-500"
                          : active
                            ? "accent-rail"
                            : "bg-transparent",
                      ].join(" ")}
                    />

                    <span className="min-w-0 px-2 py-2">
                      <span className="flex items-center justify-between gap-2">
                        <span className="block text-[13px] font-semibold tabular-nums">
                          #{orden.noOrden}
                        </span>

                        {orden.tieneDocumento && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                            PDF
                          </span>
                        )}
                      </span>

                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {orden.descripcion || "Sin descripción"}
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
            {ordenActual?.tieneDocumento
              ? "Documento de la orden"
              : "Carga de archivo"}
          </div>

          <div className="mt-0.5 text-[13px] font-semibold text-slate-950">
            {ordenActual ? `Orden #${ordenActual.noOrden}` : "Sin orden seleccionada"}
          </div>
        </div>

        <div className="h-[calc(100%-54px)] min-h-0 p-3">
          {ordenActual && documentoOrden ? (
            <div
              className={[
                "grid h-full min-h-0 gap-3",
                urlDocumentoOrden
                  ? "overflow-y-auto xl:grid-cols-[minmax(250px,320px)_minmax(0,1fr)] xl:overflow-hidden"
                  : "content-start overflow-y-auto",
              ].join(" ")}
            >
              <div
                className={[
                  "grid content-start gap-3",
                  urlDocumentoOrden
                    ? "xl:min-h-0 xl:overflow-y-auto xl:pr-1"
                    : "xl:grid-cols-[minmax(280px,420px)_1fr]",
                ].join(" ")}
              >
                {error && (
                  <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 xl:col-span-full">
                    {error}
                  </div>
                )}

                {(advertencia || ordenActual.tieneDocumento) && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium leading-5 text-amber-800 xl:col-span-full"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {advertencia ??
                        `La orden #${ordenActual.noOrden} ya tiene un documento. La carga de otro archivo está bloqueada.`}
                    </span>
                  </div>
                )}

                <div>
                  <RequisitoDocumentoCard
                    documento={documentoOrden}
                    inputIdSuffix={`input-orden-pago-${ordenActual.noOrden}`}
                    nombreEscaneo={`Orden_pago_${ordenActual.noOrden}.pdf`}
                    mostrarEscanerProfesional
                    onAbrir={abrirDocumentoOrden}
                    onActualizado={cargarOrdenes}
                    onSubirArchivo={subirOrden}
                    onIntentoCargaBloqueada={() =>
                      mostrarAdvertenciaDocumentoExistente(
                        ordenActual.noOrden
                      )
                    }
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
                        {ordenActual.tieneDocumento
                          ? "Documento registrado"
                          : "Carga y escaneo móvil"}
                      </div>

                      <div className="mt-1 text-[12px] leading-5 text-slate-500">
                        {ordenActual.tieneDocumento
                          ? "Esta orden ya cuenta con un PDF. Puede visualizarlo en el visor interno de esta pantalla, pero no cargar un reemplazo."
                          : "Arrastre un PDF sobre la tarjeta de la orden o use el escáner profesional móvil cuando la licencia esté configurada. Sin licencia, el escaneo queda disponible al abrir este módulo desde el teléfono."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-subtle px-3 py-3 xl:col-span-full">
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
                      label="Descripción"
                      value={ordenActual.descripcion || "Sin descripción"}
                    />
                  </div>
                </div>
              </div>

              {urlDocumentoOrden && (
                <section
                  ref={visorRef}
                  className={[
                    "flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm",
                    visorExpandido
                      ? "fixed inset-4 z-[100] w-auto max-w-none"
                      : "h-[calc(100dvh-8rem)] min-h-[680px] w-full max-w-[760px] justify-self-center xl:h-full xl:min-h-0",
                  ].join(" ")}
                >
                  <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-300 bg-slate-50/95 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Visor interno
                      </div>
                      <div className="truncate text-[12px] font-semibold text-slate-900">
                        Documento de la orden #{ordenActual.noOrden}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setVisorExpandido((actual) => !actual)}
                      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-700 transition hover:border-[#005f48]/50 hover:text-[#005f48]"
                    >
                      {visorExpandido ? (
                        <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {visorExpandido ? "Restaurar" : "Expandir"}
                    </button>
                  </div>

                  <iframe
                    src={urlDocumentoOrden}
                    className="min-h-0 w-full flex-1 border-0 bg-white"
                    title={`Documento de la orden de pago #${ordenActual.noOrden}`}
                  />
                </section>
              )}
            </div>
          ) : (
            <div className="grid content-start gap-3 overflow-y-auto">
              {error && (
                <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                  {error}
                </div>
              )}

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
                    Cuando exista una orden de pago, aparecerá aquí para consultar
                    su estado documental o cargar su PDF.
                  </div>
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

function construirUrlDocumentoOrden(rutaDocumento: string | null) {
  if (!rutaDocumento) return null;

  if (rutaDocumento.startsWith("http")) {
    return rutaDocumento;
  }

  const rutaNormalizada = rutaDocumento.replace(/^\/+/, "");

  if (rutaNormalizada.startsWith("ordenes_pago/")) {
    return `${SUPABASE_URL}/storage/v1/object/public/${rutaNormalizada}`;
  }

  return `${SUPABASE_URL}/storage/v1/object/public/ordenes_pago/${rutaNormalizada}`;
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
