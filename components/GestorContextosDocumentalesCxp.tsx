"use client";

import { useEffect, useState } from "react";
import {
  crearCodigoCatalogo,
  type ContextoDocumentalCxp,
  type RequisitoDocumentoContexto,
} from "@/lib/requisitos-documentales-cxp";
import {
  guardarContextoDocumentalCxp,
  listarContextosDocumentalesCxp,
} from "@/services/contextosDocumentalesCxp.service";

type Props = {
  descripcionActual: string;
  onGuardado?: (contexto: ContextoDocumentalCxp) => void;
};

export default function GestorContextosDocumentalesCxp({
  descripcionActual,
  onGuardado,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [contextos, setContextos] = useState<ContextoDocumentalCxp[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [palabrasClave, setPalabrasClave] = useState("");
  const [documentos, setDocumentos] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!abierto || contextos.length > 0 || cargando) return;
    void cargarContextos();
    // La apertura controla cuándo se consulta el catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  async function cargarContextos() {
    try {
      setCargando(true);
      setError("");
      setContextos(await listarContextosDocumentalesCxp());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el catálogo documental."
      );
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const requisitos = convertirDocumentos(documentos);
      const contexto = await guardarContextoDocumentalCxp({
        nombre,
        descripcion,
        palabrasClave: palabrasClave.split(","),
        ejemplos: descripcionActual.trim() ? [descripcionActual.trim()] : [],
        requisitos,
        origen: "USUARIO",
      });

      setContextos((actuales) => [
        contexto,
        ...actuales.filter((item) => item.codigo !== contexto.codigo),
      ]);
      setNombre("");
      setDescripcion("");
      setPalabrasClave("");
      setDocumentos("");
      setMensaje("Contexto guardado. La IA lo usará en el próximo análisis.");
      onGuardado?.(contexto);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el contexto."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
        aria-expanded={abierto}
      >
        <span>Enseñar o consultar contextos documentales</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-700">
          {abierto ? "Cerrar" : "Configurar"}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-slate-200 p-3">
          <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Catálogo activo
              </div>
              {cargando ? (
                <p className="mt-2 text-[12px] text-slate-500">Cargando...</p>
              ) : (
                <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto">
                  {contextos.map((contexto) => (
                    <div
                      key={contexto.codigo}
                      className="border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <div className="text-[11px] font-semibold text-slate-800">
                        {contexto.nombre}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        {contexto.requisitos.length} requisito(s) · {contexto.origen}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Nombre del contexto
                </label>
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ejemplo: Mantenimiento de vehículos"
                  className="h-9 w-full border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="text-[11px] font-medium text-slate-600">
                    Cómo reconocerlo
                  </label>
                  {descripcionActual.trim() && (
                    <button
                      type="button"
                      onClick={() => setDescripcion(descripcionActual.trim())}
                      className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Usar descripción actual
                    </button>
                  )}
                </div>
                <textarea
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={2}
                  placeholder="Describe cuándo se aplica esta regla"
                  className="w-full resize-none border border-slate-200 px-2.5 py-2 text-[12px] outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Palabras clave, separadas por coma
                </label>
                <input
                  value={palabrasClave}
                  onChange={(event) => setPalabrasClave(event.target.value)}
                  placeholder="vehículo, reparación, taller"
                  className="h-9 w-full border border-slate-200 px-2.5 text-[12px] outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Documentos, uno por línea
                </label>
                <textarea
                  value={documentos}
                  onChange={(event) => setDocumentos(event.target.value)}
                  rows={4}
                  placeholder={
                    "Solicitud | Solicitud del área responsable\nActa de entrega | Constancia de recepción"
                  }
                  className="w-full resize-none border border-slate-200 px-2.5 py-2 text-[12px] outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="border border-slate-900 bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {guardando ? "Guardando..." : "Guardar contexto"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
          {mensaje && (
            <div className="mt-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              {mensaje}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function convertirDocumentos(value: string): RequisitoDocumentoContexto[] {
  return value
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const [nombre = "", ...detalle] = linea.split("|");
      const nombreLimpio = nombre.trim();

      return {
        codigo: crearCodigoCatalogo(nombreLimpio),
        nombre: nombreLimpio,
        descripcion: detalle.join("|").trim(),
      };
    })
    .filter((item) => item.codigo && item.nombre);
}
