"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  obtenerDocumentosProyectos,
  DocumentoProyecto,
} from "@/services/documentacionProyectos";

import { obtenerOrdenesPago, OrdenPago } from "@/services/ordenesPago";

import { SUPABASE_URL } from "@/lib/supabase";

import RequisitoDocumentoCard from "@/components/RequisitoDocumentoCard";

export default function DocumentacionProyectos() {
  const [documentos, setDocumentos] = useState<DocumentoProyecto[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);

  const [proyectoSeleccionado, setProyectoSeleccionado] =
    useState<number | null>(null);

  const [docsAbiertos, setDocsAbiertos] = useState<string[]>([]);
  const [docActivo, setDocActivo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [busquedaProyecto, setBusquedaProyecto] = useState("");

  const cargarDatos = useCallback(async () => {
    const [docs, ords] = await Promise.all([
      obtenerDocumentosProyectos(),
      obtenerOrdenesPago(),
    ]);

    setDocumentos(docs);
    setOrdenes(ords);

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

  const codigosPresupuestariosProyectoActual = proyectoSeleccionado
    ? codigosPresupuestariosPorProyecto.get(proyectoSeleccionado) ?? []
    : [];

  const documentosProyecto = useMemo(() => {
    return documentos.filter(
      (d) => d.id_proyecto === proyectoSeleccionado
    );
  }, [documentos, proyectoSeleccionado]);

  const codigosProyecto = useMemo(() => {
    return documentosProyecto
      .map((d) => d.codigo_presupuestario)
      .filter(Boolean)
      .map((c) => c.toUpperCase().trim());
  }, [documentosProyecto]);

  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((o) =>
      codigosProyecto.includes(o.codigo_obra?.toUpperCase().trim())
    );
  }, [ordenes, codigosProyecto]);

  function construirUrlDocumento(ruta: string | null) {
    if (!ruta) return null;

    if (ruta.startsWith("http")) {
      return ruta;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/documentos/${ruta}`;
  }

  function abrir(rutaDocumento: string | null) {
    const url = construirUrlDocumento(rutaDocumento);

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
  }

  function cerrarDocumento(url: string) {
    setDocsAbiertos((prev) => prev.filter((x) => x !== url));

    if (docActivo === url) {
      const restantes = docsAbiertos.filter((x) => x !== url);
      setDocActivo(restantes.length > 0 ? restantes[0] : null);
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-3 bg-[#eef1f5] p-3 text-[12px] text-slate-800 md:grid-cols-[15rem_minmax(360px,0.95fr)_1.35fr]">
      {/* PANEL IZQUIERDO: PROYECTOS */}
      <section className="min-h-0 border border-slate-300 bg-white/65 backdrop-blur-xl">
        <div className="border-b border-slate-300 bg-white/65 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Control
          </div>

          <div className="mt-0.5 text-[13px] font-semibold text-slate-950">
            Proyectos
          </div>
        </div>

        <div className="border-b border-slate-200 px-2 py-2">
          <input
            value={busquedaProyecto}
            onChange={(e) => setBusquedaProyecto(e.target.value)}
            placeholder="Buscar proyecto"
            className="h-8 w-full border border-slate-300 bg-white/75 px-2 text-[12px] outline-none placeholder:text-slate-400 focus:border-slate-700"
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
                    ? "bg-slate-900/[0.04] text-slate-950"
                    : "text-slate-500 hover:bg-slate-900/[0.025] hover:text-slate-900",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-full min-h-[34px]",
                    active ? "bg-[#003331]" : "bg-transparent",
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
      <section className="min-h-0 overflow-hidden border border-slate-300 bg-white/65 backdrop-blur-xl">
        <div className="border-b border-slate-300 bg-white/65 px-3 py-2">
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

            <div className="shrink-0 text-[11px] text-slate-500">
              ID{" "}
              <span className="font-semibold tabular-nums text-slate-800">
                {proyectoSeleccionado ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="h-[calc(100%-54px)] overflow-y-auto">
          <div className="border-b border-slate-300 bg-white/55 px-3 py-3">
            <div className="border border-slate-200 bg-white px-3 py-3 shadow-sm">
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
                      className="break-all border-l-2 border-l-[#003331] bg-slate-50 px-2.5 py-2 font-mono text-[11px] font-semibold leading-4 text-slate-800"
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
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/75 px-3 py-2">
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
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/75 px-3 py-2">
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
                    onClick={() => abrir(o.url)}
                    className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <div className="text-[12px] font-semibold tabular-nums text-slate-950">
                        Orden #{o.orden_pago_id}
                      </div>

                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Abrir documento financiero
                      </div>
                    </div>

                    <div className="self-center text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      PDF
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
          "min-h-0 border border-slate-300 bg-white/70 backdrop-blur-xl",
          "flex flex-col overflow-hidden",
          expandido ? "fixed inset-4 z-[80]" : "",
        ].join(" ")}
      >
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-white/75 px-3 py-2">
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
            className="h-7 border border-slate-300 bg-white px-3 text-[11px] font-medium text-slate-700 transition hover:border-slate-700 hover:bg-slate-50"
          >
            {expandido ? "Restaurar" : "Expandir"}
          </button>
        </div>

        {/* TABS DE DOCUMENTOS ABIERTOS */}
        {docsAbiertos.length > 0 && (
          <div className="flex min-h-[34px] items-center overflow-x-auto border-b border-slate-200 bg-slate-50/80">
            {docsAbiertos.map((url, index) => {
              const active = docActivo === url;

              return (
                <div
                  key={url}
                  className={[
                    "flex h-[34px] shrink-0 items-center border-r border-slate-200",
                    active ? "bg-white text-slate-950" : "text-slate-500",
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

        <div className="min-h-0 flex-1 bg-[#f8fafc]">
          {!docActivo ? (
            <div className="flex h-full items-center justify-center">
              <div className="border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center backdrop-blur-xl">
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
