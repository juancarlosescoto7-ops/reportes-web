"use client";

import { useEffect, useState } from "react";
import {
  obtenerDocumentosProyectos,
  DocumentoProyecto,
} from "@/services/documentacionProyectos";

export default function DocumentacionProyectos() {
  const [data, setData] = useState<DocumentoProyecto[]>([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] =
    useState<number | null>(null);

  const [docsAbiertos, setDocsAbiertos] = useState<string[]>([]);
  const [docActivo, setDocActivo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await obtenerDocumentosProyectos();
      setData(res);
    }

    load();
  }, []);

  // =========================
  // PROYECTOS (SLICER)
  // =========================
  const proyectos = Array.from(
    new Map(
      data.map((d) => [d.id_proyecto, d.nombre_proyecto])
    )
  );

  // =========================
  // FILTRADO
  // =========================
  const documentosProyecto = data.filter(
    (d) => d.id_proyecto === proyectoSeleccionado
  );

  // =========================
  // ABRIR DOCUMENTO
  // =========================
  function abrirDocumento(url: string | null) {
    if (!url) return;

    setDocsAbiertos((prev) =>
      prev.includes(url) ? prev : [...prev, url]
    );

    setDocActivo(url);
  }

  return (
    <div className="grid grid-cols-12 gap-4">

      {/* =========================
          SLICER PROYECTOS
      ========================= */}
      <div className="col-span-3 border rounded-lg p-3 bg-white">

        <h3 className="text-xs font-semibold text-[#003331] mb-3">
          PROYECTOS
        </h3>

        <div className="space-y-2">

          {proyectos.map(([id, nombre]) => (
            <button
              key={id}
              onClick={() => {
                setProyectoSeleccionado(id);
                setDocsAbiertos([]);
                setDocActivo(null);
              }}
              className={`w-full text-left text-xs px-3 py-2 rounded-md border transition
                ${
                  proyectoSeleccionado === id
                    ? "bg-[#003331] text-white border-[#003331]"
                    : "bg-white hover:bg-gray-100 text-gray-700"
                }
              `}
            >
              {nombre}
            </button>
          ))}

        </div>
      </div>

      {/* =========================
          REQUISITOS (CARDS)
      ========================= */}
      <div className="col-span-5 border rounded-lg p-3 bg-white">

        <h3 className="text-xs font-semibold text-[#003331] mb-3">
          REQUISITOS
        </h3>

        {!proyectoSeleccionado ? (
          <p className="text-xs text-gray-400">
            Seleccione un proyecto
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">

            {documentosProyecto.map((doc, i) => (
              <button
                key={i}
                onClick={() => abrirDocumento(doc.url_documento)}
                className={`p-3 border rounded-lg text-left text-xs transition
                  ${
                    doc.mensaje === "OK"
                      ? "border-green-300 hover:bg-green-50"
                      : "border-red-300 hover:bg-red-50"
                  }
                `}
              >
                <div className="font-semibold text-[#003331]">
                  {doc.nombre_requisito}
                </div>

                <div className="mt-1">
                  {doc.mensaje === "OK" ? (
                    <span className="text-green-600 font-medium">
                      Documento cargado
                    </span>
                  ) : (
                    <span className="text-red-500 font-medium">
                      Pendiente
                    </span>
                  )}
                </div>
              </button>
            ))}

          </div>
        )}
      </div>

      {/* =========================
          VISOR PRO
      ========================= */}
      <div
        className={`col-span-4 border rounded-lg bg-white flex flex-col transition-all duration-300 ${
          expandido ? "col-span-12 fixed inset-4 z-50 shadow-2xl" : ""
        }`}
      >

        {/* HEADER */}
        <div className="p-3 border-b text-xs font-semibold text-[#003331] flex justify-between items-center">

          <span>VISOR DOCUMENTAL PRO</span>

          <div className="flex gap-2">

            <button
              onClick={() => setExpandido(!expandido)}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
            >
              {expandido ? "Restaurar" : "Expandir"}
            </button>

            <button
              onClick={() => {
                setDocsAbiertos([]);
                setDocActivo(null);
              }}
              className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
            >
              Limpiar
            </button>

          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 overflow-x-auto border-b bg-gray-50">

          {docsAbiertos.map((url) => (
            <button
              key={url}
              onClick={() => setDocActivo(url)}
              className={`text-xs px-3 py-2 whitespace-nowrap border-r ${
                docActivo === url
                  ? "bg-white font-semibold text-[#003331]"
                  : "text-gray-500"
              }`}
            >
              Documento
            </button>
          ))}

        </div>

        {/* CONTENIDO */}
        <div className="flex-1 bg-gray-50">

          {!docActivo ? (
            <div className="p-4 text-xs text-gray-400">
              Seleccione un documento para visualizarlo
            </div>
          ) : (
            <iframe
              src={docActivo}
              className="w-full h-full min-h-[500px]"
            />
          )}

        </div>

      </div>

    </div>
  );
}