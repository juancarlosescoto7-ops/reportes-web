"use client";

import { useEffect, useState } from "react";

import {
  obtenerDocumentosProyectos,
  DocumentoProyecto,
} from "@/services/documentacionProyectos";

import {
  obtenerOrdenesPago,
  OrdenPago,
} from "@/services/ordenesPago";

import PresupuestoExplorer from "@/components/PresupuestoExplorer";
import { obtenerPresupuesto } from "@/services/presupuesto";

import { SUPABASE_URL } from "@/lib/supabase";

import RequisitoDocumentoCard from "@/components/RequisitoDocumentoCard";

export default function DocumentacionProyectos() {
  const [documentos, setDocumentos] = useState<DocumentoProyecto[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenPago[]>([]);
  const [presupuesto, setPresupuesto] = useState<any[]>([]);

  const [proyectoSeleccionado, setProyectoSeleccionado] =
    useState<number | null>(null);

  const [docsAbiertos, setDocsAbiertos] = useState<string[]>([]);
  const [docActivo, setDocActivo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    const [docs, ords, pres] = await Promise.all([
      obtenerDocumentosProyectos(),
      obtenerOrdenesPago(),
      obtenerPresupuesto(),
    ]);

    setDocumentos(docs);
    setOrdenes(ords);
    setPresupuesto(pres);

    setProyectoSeleccionado((actual) =>
      actual ?? (docs.length > 0 ? docs[0].id_proyecto : null)
    );
  }

  const proyectosUnicos = Array.from(
    new Map(
      documentos.map((d) => [d.id_proyecto, d.nombre_proyecto])
    )
  ).map(([id_proyecto, nombre_proyecto]) => ({
    id_proyecto,
    nombre_proyecto,
  }));

  const documentosProyecto = documentos.filter(
    (d) => d.id_proyecto === proyectoSeleccionado
  );

  const codigosProyecto = documentosProyecto
    .map((d) => d.codigo_presupuestario)
    .filter(Boolean)
    .map((c) => c.toUpperCase().trim());

  const codigoObraActivo = codigosProyecto[0] || null;

  const ordenesFiltradas = ordenes.filter((o) =>
    codigosProyecto.includes(
      o.codigo_obra?.toUpperCase().trim()
    )
  );

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-sm">
      <div className="md:col-span-2 border rounded-lg p-3 bg-white">
        <div className="font-semibold mb-2">Proyectos</div>

        <div className="space-y-1">
          {proyectosUnicos.map((p) => (
            <button
              key={p.id_proyecto}
              onClick={() => {
                setProyectoSeleccionado(p.id_proyecto);
                setDocsAbiertos([]);
                setDocActivo(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();

                if (proyectoSeleccionado !== p.id_proyecto) {
                  setProyectoSeleccionado(p.id_proyecto);
                  setDocsAbiertos([]);
                  setDocActivo(null);
                }
              }}
              className={`w-full text-left p-2 border rounded transition ${
                proyectoSeleccionado === p.id_proyecto
                  ? "bg-blue-100 border-blue-300"
                  : "hover:bg-gray-50"
              }`}
            >
              {p.nombre_proyecto}
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-5 border rounded-lg p-3 bg-white">
        <div className="font-semibold mb-2">
          Requisitos Documentales
        </div>

        <div className="grid grid-cols-2 gap-2">
          {documentosProyecto.map((d, i) => (
            <RequisitoDocumentoCard
              key={`${d.id_proyecto}-${d.id_requisito}-${i}`}
              documento={d}
              onAbrir={abrir}
              onActualizado={cargarDatos}
            />
          ))}
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="font-semibold mb-2">
            Órdenes de Pago
          </div>

          {ordenesFiltradas.length === 0 ? (
            <div className="text-xs text-gray-400">
              Sin órdenes registradas
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ordenesFiltradas.map((o, i) => (
                <button
                  key={i}
                  onClick={() => abrir(o.url)}
                  className="p-3 border rounded bg-gray-50 hover:bg-gray-100 text-left transition"
                >
                  <div className="font-medium">
                    Orden #{o.orden_pago_id}
                  </div>

                  <div className="text-xs text-gray-400">
                    Abrir documento
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={`
          md:col-span-5 border rounded-lg bg-white flex flex-col
          ${expandido ? "fixed inset-4 z-50 shadow-2xl" : ""}
        `}
      >
        <div className="p-3 border-b flex justify-between text-xs font-semibold">
          VISOR DOCUMENTAL

          <button
            onClick={() => setExpandido(!expandido)}
            className="text-xs border px-2 py-1 rounded"
          >
            {expandido ? "Restaurar" : "Expandir"}
          </button>
        </div>

        <div className="flex-1 bg-gray-50">
          {!docActivo ? (
            <div className="p-3 text-xs text-gray-400">
              Seleccione un documento o una orden
            </div>
          ) : (
            <iframe
              src={docActivo}
              className="w-full h-[70vh]"
            />
          )}
        </div>
      </div>
    </div>
  );
}