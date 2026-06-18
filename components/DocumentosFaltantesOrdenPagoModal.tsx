"use client";

import { useEffect, useMemo, useState } from "react";

import {
  agregarDocumentoFaltanteOrdenPago,
  listarDocumentosFaltantesOrdenPago,
  subsanarDocumentoFaltanteOrdenPago,
  type DocumentoFaltanteOrdenPago,
} from "@/services/documentosFaltantesOrdenPago.service";

type DocumentosFaltantesOrdenPagoModalProps = {
  open: boolean;
  noOrden: number | null;
  ordenLabel?: string | null;
  onClose: () => void;
  onActualizado: () => void;
};

export default function DocumentosFaltantesOrdenPagoModal({
  open,
  noOrden,
  ordenLabel,
  onClose,
  onActualizado,
}: DocumentosFaltantesOrdenPagoModalProps) {
  const [documentos, setDocumentos] = useState<DocumentoFaltanteOrdenPago[]>(
    []
  );
  const [nombreDocumento, setNombreDocumento] = useState("");
  const [observacion, setObservacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalFaltantes = useMemo(() => {
    return documentos.filter((doc) => doc.estado === "FALTANTE").length;
  }, [documentos]);

  const totalSubsanados = useMemo(() => {
    return documentos.filter((doc) => doc.estado === "SUBSANADO").length;
  }, [documentos]);

  useEffect(() => {
    if (!open || !noOrden) return;

    cargarDocumentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noOrden]);

  async function cargarDocumentos() {
    if (!noOrden) return;

    try {
      setCargando(true);
      setError(null);

      const res = await listarDocumentosFaltantesOrdenPago(noOrden);
      setDocumentos(res);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los documentos de la orden.");
    } finally {
      setCargando(false);
    }
  }

  async function agregarDocumento() {
    if (!noOrden) return;

    const nombreLimpio = nombreDocumento.trim();
    const observacionLimpia = observacion.trim();

    if (!nombreLimpio) {
      setError("Debe escribir el nombre del documento faltante.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      const nuevo = await agregarDocumentoFaltanteOrdenPago({
        noOrden,
        nombreDocumento: nombreLimpio,
        observacion: observacionLimpia || null,
        usuarioRegistro: null,
      });

      if (!nuevo) {
        setError("No se pudo registrar el documento faltante.");
        return;
      }

      setNombreDocumento("");
      setObservacion("");

      await cargarDocumentos();
      onActualizado();
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al registrar el documento faltante.");
    } finally {
      setGuardando(false);
    }
  }

  async function subsanarDocumento(documentoId: string) {
    const confirmar = window.confirm(
      "¿Confirmas que este documento ya fue subsanado?"
    );

    if (!confirmar) return;

    try {
      setGuardando(true);
      setError(null);

      const actualizado = await subsanarDocumentoFaltanteOrdenPago({
        documentoId,
        usuarioSubsana: null,
      });

      if (!actualizado) {
        setError("No se pudo subsanar el documento.");
        return;
      }

      await cargarDocumentos();
      onActualizado();
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al subsanar el documento.");
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (guardando) return;

    setNombreDocumento("");
    setObservacion("");
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[820px] border border-slate-300 bg-white shadow-2xl">
        {/* HEADER */}
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Control documental
            </div>

            <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-slate-950">
              Documentos faltantes
            </h2>

            <div className="mt-1 text-[12px] text-slate-500">
              Orden{" "}
              <span className="font-semibold tabular-nums text-slate-800">
                {ordenLabel ?? noOrden ?? "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className="h-8 w-8 border border-slate-300 bg-white text-[18px] leading-none text-slate-600 transition hover:border-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
          <MiniMetric label="Total" value={documentos.length} />
          <MiniMetric
            label="Faltantes"
            value={totalFaltantes}
            valueClass={
              totalFaltantes > 0 ? "text-amber-700" : "text-slate-700"
            }
          />
          <MiniMetric
            label="Subsanados"
            value={totalSubsanados}
            valueClass={
              totalSubsanados > 0 ? "text-emerald-700" : "text-slate-700"
            }
          />
        </div>

        {/* FORMULARIO */}
        <div className="border-b border-slate-200 bg-[#f8fafc] px-5 py-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_auto] lg:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Documento
              </label>

              <input
                value={nombreDocumento}
                onChange={(e) => setNombreDocumento(e.target.value)}
                disabled={guardando}
                placeholder="Ej. Factura original"
                className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Observación
              </label>

              <input
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                disabled={guardando}
                placeholder="Detalle breve del faltante"
                className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={agregarDocumento}
              disabled={guardando || !noOrden}
              className="h-9 border border-slate-900 bg-slate-950 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando" : "Agregar"}
            </button>
          </div>

          {error && (
            <div className="mt-3 border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* LISTADO */}
        <div className="max-h-[390px] overflow-auto">
          {cargando ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-500">
              Cargando documentos...
            </div>
          ) : documentos.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[13px] font-medium text-slate-600">
                Esta orden no tiene documentos registrados.
              </div>

              <div className="mt-1 text-[12px] text-slate-400">
                Agrega un documento faltante desde el formulario superior.
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-2 font-semibold">Estado</th>
                  <th className="px-4 py-2 font-semibold">Documento</th>
                  <th className="px-4 py-2 font-semibold">Observación</th>
                  <th className="w-[150px] px-4 py-2 text-right font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {documentos.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-100 bg-white transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 align-top">
                      <EstadoDocumentoBadge estado={doc.estado} />
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-900">
                        {doc.nombreDocumento}
                      </div>

                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                        Registrado: {formatearFecha(doc.fechaRegistro)}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top text-slate-600">
                      {doc.observacion || (
                        <span className="text-slate-400">
                          Sin observación.
                        </span>
                      )}

                      {doc.estado === "SUBSANADO" && doc.fechaSubsanado && (
                        <div className="mt-1 text-[11px] font-medium text-emerald-700">
                          Subsanado: {formatearFecha(doc.fechaSubsanado)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right align-top">
                      {doc.estado === "FALTANTE" ? (
                        <button
                          type="button"
                          onClick={() => subsanarDocumento(doc.id)}
                          disabled={guardando}
                          className="border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Subsanar
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          Cerrado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[11px] text-slate-500">
            Los documentos subsanados se conservan como historial.
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className="h-8 border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

type MiniMetricProps = {
  label: string;
  value: number;
  valueClass?: string;
};

function MiniMetric({
  label,
  value,
  valueClass = "text-slate-900",
}: MiniMetricProps) {
  return (
    <div className="border-r border-slate-200 px-5 py-3 last:border-r-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div
        className={`mt-0.5 text-[18px] font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

type EstadoDocumentoBadgeProps = {
  estado: "FALTANTE" | "SUBSANADO";
};

function EstadoDocumentoBadge({ estado }: EstadoDocumentoBadgeProps) {
  if (estado === "FALTANTE") {
    return (
      <span className="inline-flex min-w-[92px] justify-center border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
        Faltante
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-[92px] justify-center border border-emerald-400 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
      Subsanado
    </span>
  );
}

function formatearFecha(value: string | null) {
  if (!value) return "—";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "—";

  return fecha.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}