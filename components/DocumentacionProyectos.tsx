"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

import {
  obtenerDocumentosProyectos,
  DocumentoProyecto,
} from "@/services/documentacionProyectos";

import { obtenerOrdenesPago, OrdenPago } from "@/services/ordenesPago";
import { obtenerPresupuesto } from "@/services/presupuesto";

import { SUPABASE_URL } from "@/lib/supabase";
import { calcularResumenPresupuestoProyecto } from "@/lib/resumenPresupuestoProyecto";

import RequisitoDocumentoCard from "@/components/RequisitoDocumentoCard";

export default function DocumentacionProyectos() {
  const [documentos, setDocumentos] = useState<DocumentoProyecto[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [presupuesto, setPresupuesto] = useState<Record<string, unknown>[]>([]);

  const [proyectoSeleccionado, setProyectoSeleccionado] =
    useState<number | null>(null);

  const [docsAbiertos, setDocsAbiertos] = useState<string[]>([]);
  const [docActivo, setDocActivo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [estadoPdf, setEstadoPdf] = useState<{
    tipo: "ok" | "error";
    mensaje: string;
  } | null>(null);

  const cargarDatos = useCallback(async () => {
    const [docs, ords, filasPresupuesto] = await Promise.all([
      obtenerDocumentosProyectos(),
      obtenerOrdenesPago(),
      obtenerPresupuesto(),
    ]);

    setDocumentos(docs);
    setOrdenes(ords);
    setPresupuesto(
      Array.isArray(filasPresupuesto) ? filasPresupuesto : []
    );

    setProyectoSeleccionado((actual) =>
      actual ?? (docs.length > 0 ? docs[0].id_proyecto : null)
    );
  }, []);

  useEffect(() => {
    void Promise.resolve().then(cargarDatos);
  }, [cargarDatos]);

  const proyectosUnicos = useMemo(() => {
    const map = new Map<number, string>();

    documentos.forEach((d) => {
      map.set(d.id_proyecto, d.nombre_proyecto);
    });

    return Array.from(map.entries()).map(
      ([id_proyecto, nombre_proyecto]) => ({
        id_proyecto,
        nombre_proyecto,
      })
    );
  }, [documentos]);

  const codigosPresupuestariosPorProyecto = useMemo(() => {
    const map = new Map<number, string[]>();

    proyectosUnicos.forEach((proyecto) => {
      const codigosObraProyecto = documentos
        .filter((d) => d.id_proyecto === proyecto.id_proyecto)
        .map((d) => d.codigo_presupuestario)
        .filter(Boolean)
        .map((codigo) => codigo.toUpperCase().trim());

      const codigos = ordenes
        .filter((orden) => {
          const mismoProyecto =
            String(orden.codigo_proyecto ?? "").trim() ===
            String(proyecto.id_proyecto);
          const mismaObra = codigosObraProyecto.includes(
            orden.codigo_obra?.toUpperCase().trim()
          );

          return mismoProyecto || mismaObra;
        })
        .map((orden) => orden.codigo_presupuestario)
        .filter(Boolean)
        .map((codigo) => codigo.trim());

      map.set(proyecto.id_proyecto, Array.from(new Set(codigos)));
    });

    return map;
  }, [documentos, ordenes, proyectosUnicos]);

  const proyectosFiltrados = useMemo(() => {
    const term = busquedaProyecto.toLowerCase().trim();

    if (!term) return proyectosUnicos;

    return proyectosUnicos.filter((p) =>
      p.nombre_proyecto.toLowerCase().includes(term)
    );
  }, [proyectosUnicos, busquedaProyecto]);

  const proyectoActual = proyectosUnicos.find(
    (p) => p.id_proyecto === proyectoSeleccionado
  );

  const codigosPresupuestariosProyectoActual = useMemo(
    () =>
      proyectoSeleccionado
        ? codigosPresupuestariosPorProyecto.get(proyectoSeleccionado) ?? []
        : [],
    [codigosPresupuestariosPorProyecto, proyectoSeleccionado]
  );

  const resumenPresupuestoProyecto = useMemo(
    () =>
      calcularResumenPresupuestoProyecto({
        filas: presupuesto,
        idProyecto: proyectoSeleccionado,
        codigosPresupuestarios: codigosPresupuestariosProyectoActual,
      }),
    [
      presupuesto,
      proyectoSeleccionado,
      codigosPresupuestariosProyectoActual,
    ]
  );

  const filasDocumentosProyecto = useMemo(() => {
    return documentos.filter(
      (d) => d.id_proyecto === proyectoSeleccionado
    );
  }, [documentos, proyectoSeleccionado]);

  const documentosProyecto = useMemo(() => {
    const unicos = new Map<number, DocumentoProyecto>();

    filasDocumentosProyecto.forEach((documento) => {
      const actual = unicos.get(documento.id_requisito);

      if (!actual || (!actual.url_documento && documento.url_documento)) {
        unicos.set(documento.id_requisito, documento);
      }
    });

    return Array.from(unicos.values());
  }, [filasDocumentosProyecto]);

  const codigosProyecto = useMemo(() => {
    return filasDocumentosProyecto
      .map((d) => d.codigo_presupuestario)
      .filter(Boolean)
      .map((c) => c.toUpperCase().trim());
  }, [filasDocumentosProyecto]);

  const ordenesFiltradas = useMemo(() => {
    const unicas = new Map<string, OrdenPago>();

    ordenes.forEach((orden) => {
      const idOrden = orden.orden_pago_id?.trim();
      const mismoProyecto =
        String(orden.codigo_proyecto ?? "").trim() ===
        String(proyectoSeleccionado ?? "");
      const mismaObra = codigosProyecto.includes(
        orden.codigo_obra?.toUpperCase().trim()
      );

      if (!idOrden || (!mismoProyecto && !mismaObra)) return;

      const actual = unicas.get(idOrden);

      if (!actual || (!actual.url && orden.url)) {
        unicas.set(idOrden, orden);
      }
    });

    return Array.from(unicas.values()).sort((a, b) =>
      String(a.orden_pago_id).localeCompare(String(b.orden_pago_id), "es", {
        numeric: true,
        sensitivity: "base",
      })
    );
  }, [ordenes, codigosProyecto, proyectoSeleccionado]);

  const totalArchivosExpediente = useMemo(() => {
    const requisitos = documentosProyecto.filter(
      (documento) => documento.url_documento
    ).length;
    const ordenesConArchivo = ordenesFiltradas.filter(
      (orden) => orden.url
    ).length;

    return requisitos + ordenesConArchivo;
  }, [documentosProyecto, ordenesFiltradas]);

  function construirUrlDocumento(
    ruta: string | null,
    bucket: "documentos" | "ordenes_pago" = "documentos"
  ) {
    if (!ruta) return null;

    if (ruta.startsWith("http")) {
      return ruta;
    }

    const rutaNormalizada = ruta.replace(/^\/+/, "");

    if (
      rutaNormalizada.startsWith("documentos/") ||
      rutaNormalizada.startsWith("ordenes_pago/")
    ) {
      return `${SUPABASE_URL}/storage/v1/object/public/${rutaNormalizada}`;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${rutaNormalizada}`;
  }

  function abrir(
    rutaDocumento: string | null,
    bucket: "documentos" | "ordenes_pago" = "documentos"
  ) {
    const url = construirUrlDocumento(rutaDocumento, bucket);

    if (!url) return;

    setDocsAbiertos((prev) =>
      prev.includes(url) ? prev : [...prev, url]
    );

    setDocActivo(url);
  }

  function seleccionarProyecto(idProyecto: number) {
    setProyectoSeleccionado(idProyecto);
    setDocsAbiertos([]);
    setDocActivo(null);
    setExpandido(false);
    setEstadoPdf(null);
  }

  function cerrarDocumento(url: string) {
    setDocsAbiertos((prev) => prev.filter((x) => x !== url));

    if (docActivo === url) {
      const restantes = docsAbiertos.filter((x) => x !== url);
      setDocActivo(restantes.length > 0 ? restantes[0] : null);
    }
  }

  function formatearMonto(value: number) {
    return value.toLocaleString("es-HN", {
      style: "currency",
      currency: "HNL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function generarExpedientePdf() {
    if (!proyectoSeleccionado || !proyectoActual) return;

    try {
      setGenerandoPdf(true);
      setEstadoPdf(null);

      const response = await fetch("/api/proyectos/expediente-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idProyecto: proyectoSeleccionado,
          nombreProyecto: proyectoActual.nombre_proyecto,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error || "No se pudo generar el expediente PDF."
        );
      }

      const archivo = await response.blob();
      const urlDescarga = URL.createObjectURL(archivo);
      const disposition = response.headers.get("content-disposition") ?? "";
      const nombreServidor = disposition.match(/filename="([^"]+)"/i)?.[1];
      const enlace = document.createElement("a");

      enlace.href = urlDescarga;
      enlace.download =
        nombreServidor || `expediente-proyecto-${proyectoSeleccionado}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(urlDescarga), 1_000);

      const cantidadDocumentos =
        response.headers.get("x-document-count") ??
        String(totalArchivosExpediente);
      const cantidadPaginas = response.headers.get("x-page-count");

      setEstadoPdf({
        tipo: "ok",
        mensaje: `Expediente generado con ${cantidadDocumentos} archivos${
          cantidadPaginas ? ` y ${cantidadPaginas} paginas` : ""
        }.`,
      });
    } catch (error) {
      setEstadoPdf({
        tipo: "error",
        mensaje:
          error instanceof Error
            ? error.message
            : "No se pudo generar el expediente PDF.",
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-3 p-1 text-[12px] text-slate-800 md:grid-cols-[15rem_minmax(360px,0.95fr)_1.35fr]">
      {/* PANEL IZQUIERDO: PROYECTOS */}
      <section className="glass-panel min-h-0 overflow-hidden">
        <div className="border-b border-slate-300/60 bg-white/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Control
          </div>

          <div className="mt-0.5 text-[13px] font-semibold text-slate-950">
            Proyectos
          </div>
        </div>

        <div className="operational-header px-2 py-2">
          <input
            value={busquedaProyecto}
            onChange={(e) => setBusquedaProyecto(e.target.value)}
            placeholder="Buscar proyecto"
            className="h-8 w-full rounded-md border border-slate-300 bg-white/75 px-2 text-[12px] outline-none placeholder:text-slate-400 focus:border-slate-700"
          />
        </div>

        <div className="h-[calc(100%-89px)] overflow-y-auto px-2 py-2">
          {proyectosFiltrados.map((p) => {
            const active = proyectoSeleccionado === p.id_proyecto;

            return (
              <button
                key={p.id_proyecto}
                onClick={() => seleccionarProyecto(p.id_proyecto)}
                onDragOver={(e) => {
                  e.preventDefault();

                  if (proyectoSeleccionado !== p.id_proyecto) {
                    seleccionarProyecto(p.id_proyecto);
                  }
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
                    "h-full min-h-[34px]",
                    active ? "accent-rail" : "bg-transparent",
                  ].join(" ")}
                />

                <span className="min-w-0 px-2 py-2 leading-4">
                  <span className="block">{p.nombre_proyecto}</span>
                </span>
              </button>
            );
          })}

          {proyectosFiltrados.length === 0 && (
            <div className="px-2 py-6 text-center text-[12px] text-slate-400">
              No se encontraron proyectos.
            </div>
          )}
        </div>
      </section>

      {/* PANEL CENTRAL: EXPEDIENTE */}
      <section className="glass-panel flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-slate-300/60 bg-white/45 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Expediente documental
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-950">
                {proyectoActual?.nombre_proyecto || "Sin proyecto seleccionado"}
              </div>

              <div className="mt-0.5 text-[11px] text-slate-500">
                {documentosProyecto.length} requisitos ·{" "}
                {ordenesFiltradas.length} órdenes de pago
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="text-[11px] text-slate-500">
                ID{" "}
                <span className="font-semibold tabular-nums text-slate-800">
                  {proyectoSeleccionado ?? "—"}
                </span>
              </div>

              <button
                type="button"
                onClick={generarExpedientePdf}
                disabled={
                  generandoPdf ||
                  !proyectoSeleccionado ||
                  totalArchivosExpediente === 0
                }
                title={
                  totalArchivosExpediente === 0
                    ? "Este proyecto no tiene archivos PDF enlazados"
                    : "Descargar el expediente completo en PDF"
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#005f48]/35 bg-[#005f48] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#004b3a] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {generandoPdf ? (
                  <LoaderCircle
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {generandoPdf ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {estadoPdf && (
            <div
              role={estadoPdf.tipo === "error" ? "alert" : "status"}
              className={[
                "border-b px-3 py-2 text-[11px] font-medium",
                estadoPdf.tipo === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {estadoPdf.mensaje}
            </div>
          )}

          <div className="border-b border-slate-300/60 bg-white/35 px-3 py-3">
            <div className="glass-subtle px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Resumen presupuestario
                </div>

                <div className="text-[10px] text-slate-400">
                  {resumenPresupuestoProyecto.cantidadPartidas} partidas
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  {
                    label: "Presupuesto inicial",
                    value: resumenPresupuestoProyecto.presupuestoInicial,
                    accent: "border-l-slate-500",
                  },
                  {
                    label: "Monto vigente",
                    value: resumenPresupuestoProyecto.montoVigente,
                    accent: "border-l-emerald-600",
                  },
                  {
                    label: "Monto ejecutado",
                    value: resumenPresupuestoProyecto.montoEjecutado,
                    accent: "border-l-sky-600",
                  },
                  {
                    label: "Monto comprometido",
                    value: resumenPresupuestoProyecto.montoComprometido,
                    accent: "border-l-amber-500",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`min-w-0 border-l-2 bg-white/65 px-2.5 py-2 ${item.accent}`}
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-1 truncate text-[13px] font-semibold tabular-nums text-slate-950">
                      {formatearMonto(item.value)}
                    </div>
                  </div>
                ))}
              </div>

              {proyectoSeleccionado &&
                resumenPresupuestoProyecto.cantidadPartidas === 0 && (
                  <div className="mt-2 text-[11px] text-slate-400">
                    Sin partidas presupuestarias vinculadas a este proyecto.
                  </div>
                )}
            </div>
          </div>

          <div className="border-b border-slate-300/60 bg-white/35 px-3 py-3">
            <div className="glass-subtle px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Codigo presupuestario
              </div>

              {codigosPresupuestariosProyectoActual.length === 0 ? (
                <div className="mt-2 text-[12px] text-slate-400">
                  Sin codigos presupuestarios registrados.
                </div>
              ) : (
                <div className="mt-2 grid gap-1.5">
                  {codigosPresupuestariosProyectoActual.map((codigo) => (
                    <div
                      key={codigo}
                      className="break-all border-l-2 border-l-[#003331] bg-white/55 px-2.5 py-2 font-mono text-[11px] font-semibold leading-4 text-slate-800"
                    >
                      {codigo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* REQUISITOS */}
          <div className="border-b border-slate-300">
            <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/35 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Requisitos documentales
                </div>

                <div className="text-[11px] text-slate-500">
                  Documentación requerida por proyecto.
                </div>
              </div>

              <div className="text-[11px] font-semibold text-slate-600">
                {documentosProyecto.length}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-2">
              {documentosProyecto.map((d, i) => (
                <div
                  key={`${d.id_proyecto}-${d.id_requisito}-${i}`}
                  className="min-w-0"
                >
                  <RequisitoDocumentoCard
                    documento={d}
                    onAbrir={abrir}
                    onActualizado={cargarDatos}
                  />
                </div>
              ))}

              {documentosProyecto.length === 0 && (
                <div className="col-span-full px-3 py-8 text-center text-[12px] text-slate-400">
                  No hay requisitos documentales asociados a este proyecto.
                </div>
              )}
            </div>
          </div>

          {/* ÓRDENES DE PAGO */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/35 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  Órdenes de pago
                </div>

                <div className="text-[11px] text-slate-500">
                  Documentos financieros vinculados al código de obra.
                </div>
              </div>

              <div className="text-[11px] font-semibold text-slate-600">
                {ordenesFiltradas.length}
              </div>
            </div>

            {ordenesFiltradas.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] text-slate-400">
                Sin órdenes de pago registradas para este proyecto.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {ordenesFiltradas.map((o, i) => (
                  <button
                    key={`${o.orden_pago_id}-${i}`}
                    type="button"
                    onClick={() => abrir(o.url, "ordenes_pago")}
                    disabled={!o.url}
                    className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left transition-colors hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div>
                      <div className="text-[12px] font-semibold tabular-nums text-slate-950">
                        Orden #{o.orden_pago_id}
                      </div>

                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {o.url
                          ? "Abrir documento financiero"
                          : "Sin archivo PDF enlazado"}
                      </div>
                    </div>

                    <div className="self-center text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      {o.url ? "PDF" : "Pendiente"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PANEL DERECHO: VISOR */}
      <section
        className={[
          "glass-panel min-h-0",
          "flex flex-col overflow-hidden",
          expandido ? "fixed inset-4 z-[80]" : "",
        ].join(" ")}
      >
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-300/60 bg-white/45 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Visor documental
            </div>

            <div className="mt-0.5 truncate text-[12px] text-slate-700">
              {docActivo
                ? "Documento activo"
                : "Seleccione un requisito documental o una orden de pago"}
            </div>
          </div>

          <button
            onClick={() => setExpandido(!expandido)}
            className="h-7 rounded-md border border-slate-300/70 bg-white/65 px-3 text-[11px] font-medium text-slate-700 transition hover:border-[#005f48]/50 hover:bg-white"
          >
            {expandido ? "Restaurar" : "Expandir"}
          </button>
        </div>

        {/* TABS DE DOCUMENTOS ABIERTOS */}
        {docsAbiertos.length > 0 && (
          <div className="flex min-h-[34px] items-center overflow-x-auto border-b border-slate-200/70 bg-white/45">
            {docsAbiertos.map((url, index) => {
              const active = docActivo === url;

              return (
                <div
                  key={url}
                  className={[
                    "flex h-[34px] shrink-0 items-center border-r border-slate-200",
                    active ? "bg-white/75 text-slate-950" : "text-slate-500",
                  ].join(" ")}
                >
                  <button
                    onClick={() => setDocActivo(url)}
                    className="h-full px-3 text-[11px] hover:bg-white"
                  >
                    Documento {index + 1}
                  </button>

                  <button
                    onClick={() => cerrarDocumento(url)}
                    className="h-full border-l border-slate-200 px-2 text-[11px] text-slate-400 hover:bg-white hover:text-slate-800"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="min-h-0 flex-1 bg-white/35">
          {!docActivo ? (
            <div className="flex h-full items-center justify-center">
              <div className="glass-subtle border-dashed px-6 py-8 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sin documento activo
                </div>

                <div className="mt-2 max-w-[320px] text-[12px] leading-5 text-slate-500">
                  Seleccione un requisito documental o una orden de pago para
                  visualizar el archivo asociado al expediente.
                </div>
              </div>
            </div>
          ) : (
            <iframe
              src={docActivo}
              className="h-full w-full border-0"
              title="Visor documental"
            />
          )}
        </div>
      </section>
    </div>
  );
}
