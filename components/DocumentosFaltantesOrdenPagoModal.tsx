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

  const ordenMostrada = useMemo(() => {
    const value = ordenLabel ?? noOrden ?? "-";
    return String(value).replace(/#/g, "").trim();
  }, [noOrden, ordenLabel]);

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
      setError("Ocurrio un error al registrar el documento faltante.");
    } finally {
      setGuardando(false);
    }
  }

  async function subsanarDocumento(documentoId: string) {
    const confirmar = window.confirm(
      "Confirmas que este documento ya fue subsanado?"
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
      setError("Ocurrio un error al subsanar el documento.");
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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 px-3 py-4 backdrop-blur-sm sm:px-6">
      <div className="grid h-[92vh] w-full max-w-[1180px] grid-rows-[auto_1fr_auto] border border-slate-300 bg-[#eef1f5] shadow-2xl lg:h-[86vh]">
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Control documental
            </div>

            <h2 className="mt-1 text-[16px] font-semibold tracking-tight text-slate-950">
              Documentos faltantes de orden de pago
            </h2>
          </div>

          <button
            type="button"
            onClick={cerrar}
            disabled={guardando}
            className="h-8 w-8 border border-slate-300 bg-white text-[18px] leading-none text-slate-600 transition hover:border-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Cerrar"
          >
            x
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          <div className="grid min-h-full grid-cols-1 gap-3 lg:grid-cols-[290px_1fr]">
            <aside className="border border-slate-300 bg-white/75 backdrop-blur-xl">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Orden de pago
                </div>

                <div className="mt-2 break-words text-[28px] font-semibold leading-none tabular-nums text-slate-950">
                  {ordenMostrada}
                </div>
              </div>

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
                    totalSubsanados > 0
                      ? "text-emerald-700"
                      : "text-slate-700"
                  }
                />
              </div>

              <div className="space-y-3 p-4">
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
                    Observacion
                  </label>

                  <textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    disabled={guardando}
                    placeholder="Detalle breve del faltante"
                    className="min-h-[86px] w-full resize-none border border-slate-300 bg-white px-3 py-2 text-[13px] leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={agregarDocumento}
                  disabled={guardando || !noOrden}
                  className="h-9 w-full border border-slate-900 bg-slate-950 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardando ? "Guardando" : "Agregar"}
                </button>

                {error && (
                  <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                    {error}
                  </div>
                )}
              </div>
            </aside>

            <section className="grid min-h-[420px] grid-rows-[auto_1fr] border border-slate-300 bg-white/75 backdrop-blur-xl lg:min-h-0">
              <div className="grid grid-cols-1 gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Documentos
                  </div>

                  <div className="text-[14px] font-semibold text-slate-950">
                    Pendientes y subsanados
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Los documentos subsanados se conservan como historial.
                </div>
              </div>

              <div className="min-h-0 overflow-auto">
                {cargando ? (
                  <div className="flex min-h-[260px] items-center justify-center px-5 py-8 text-center text-[13px] text-slate-500">
                    Cargando documentos...
                  </div>
                ) : documentos.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center px-5 py-8 text-center">
                    <div className="text-[13px] font-medium text-slate-600">
                      Esta orden no tiene documentos registrados.
                    </div>

                    <div className="mt-1 text-[12px] text-slate-400">
                      Agrega un documento faltante desde el panel de la orden.
                    </div>
                  </div>
                ) : (
                  <>
                    <table className="hidden w-full min-w-[760px] border-collapse text-[12px] md:table">
                      <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                          <th className="px-4 py-2 font-semibold">Estado</th>
                          <th className="px-4 py-2 font-semibold">
                            Documento
                          </th>
                          <th className="px-4 py-2 font-semibold">
                            Observacion
                          </th>
                          <th className="w-[150px] px-4 py-2 text-right font-semibold">
                            Accion
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {documentos.map((doc) => (
                          <DocumentoTableRow
                            key={doc.id}
                            doc={doc}
                            guardando={guardando}
                            onSubsanar={subsanarDocumento}
                          />
                        ))}
                      </tbody>
                    </table>

                    <div className="space-y-2 p-3 md:hidden">
                      {documentos.map((doc) => (
                        <DocumentoMobileCard
                          key={doc.id}
                          doc={doc}
                          guardando={guardando}
                          onSubsanar={subsanarDocumento}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-300 bg-white/80 px-4 py-3 backdrop-blur-xl">
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

type DocumentoRowProps = {
  doc: DocumentoFaltanteOrdenPago;
  guardando: boolean;
  onSubsanar: (documentoId: string) => void;
};

function DocumentoTableRow({ doc, guardando, onSubsanar }: DocumentoRowProps) {
  return (
    <tr className="border-b border-slate-100 bg-white transition hover:bg-slate-50">
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
          <span className="text-slate-400">Sin observacion.</span>
        )}

        {doc.estado === "SUBSANADO" && doc.fechaSubsanado && (
          <div className="mt-1 text-[11px] font-medium text-emerald-700">
            Subsanado: {formatearFecha(doc.fechaSubsanado)}
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-right align-top">
        <DocumentoAccion doc={doc} guardando={guardando} onSubsanar={onSubsanar} />
      </td>
    </tr>
  );
}

function DocumentoMobileCard({ doc, guardando, onSubsanar }: DocumentoRowProps) {
  return (
    <article className="border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-slate-950">
            {doc.nombreDocumento}
          </div>

          <div className="mt-1 text-[11px] tabular-nums text-slate-400">
            Registrado: {formatearFecha(doc.fechaRegistro)}
          </div>
        </div>

        <EstadoDocumentoBadge estado={doc.estado} />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 text-[12px] leading-5 text-slate-600">
        {doc.observacion || (
          <span className="text-slate-400">Sin observacion.</span>
        )}

        {doc.estado === "SUBSANADO" && doc.fechaSubsanado && (
          <div className="mt-1 text-[11px] font-medium text-emerald-700">
            Subsanado: {formatearFecha(doc.fechaSubsanado)}
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <DocumentoAccion doc={doc} guardando={guardando} onSubsanar={onSubsanar} />
      </div>
    </article>
  );
}

function DocumentoAccion({ doc, guardando, onSubsanar }: DocumentoRowProps) {
  if (doc.estado !== "FALTANTE") {
    return (
      <span className="text-[11px] font-medium text-slate-400">Cerrado</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSubsanar(doc.id)}
      disabled={guardando}
      className="border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Subsanar
    </button>
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
    <div className="border-r border-slate-200 px-3 py-3 last:border-r-0">
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
  if (!value) return "-";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "-";

  return fecha.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
