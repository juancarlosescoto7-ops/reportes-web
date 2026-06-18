"use client";

import { useEffect, useMemo, useState } from "react";

import {
  obtenerBandejaDocumentosFaltantesOrdenesPago,
  subsanarDocumentoFaltanteOrdenPago,
  type DocumentoFaltanteBandeja,
} from "@/services/documentosFaltantesOrdenPago.service";

type GrupoOrdenDocumental = {
  noOrden: number;
  fechaOrden: string | null;
  descripcionOrden: string | null;
  totalEgreso: number;
  documentos: DocumentoFaltanteBandeja[];
};

export default function MiniControlDocumentosFaltantes() {
  const [data, setData] = useState<DocumentoFaltanteBandeja[]>([]);
  const [expandido, setExpandido] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError(null);

      const res = await obtenerBandejaDocumentosFaltantesOrdenesPago();
      setData(res);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el control documental.");
    } finally {
      setCargando(false);
    }
  }

  async function subsanarDocumento(documentoId: string) {
    const confirmar = window.confirm(
      "¿Confirmas que este documento ya fue subsanado?"
    );

    if (!confirmar) return;

    try {
      setProcesandoId(documentoId);
      setError(null);

      const res = await subsanarDocumentoFaltanteOrdenPago({
        documentoId,
        usuarioSubsana: null,
      });

      if (!res) {
        setError("No se pudo subsanar el documento.");
        return;
      }

      await cargar();
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al subsanar el documento.");
    } finally {
      setProcesandoId(null);
    }
  }

  const grupos = useMemo<GrupoOrdenDocumental[]>(() => {
    const map = new Map<number, GrupoOrdenDocumental>();

    data.forEach((item) => {
      const existente = map.get(item.noOrden);

      if (existente) {
        existente.documentos.push(item);
        return;
      }

      map.set(item.noOrden, {
        noOrden: item.noOrden,
        fechaOrden: item.fechaOrden,
        descripcionOrden: item.descripcionOrden,
        totalEgreso: item.totalEgreso,
        documentos: [item],
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.documentos.length !== a.documentos.length) {
        return b.documentos.length - a.documentos.length;
      }

      return b.noOrden - a.noOrden;
    });
  }, [data]);

  const totalDocumentos = data.length;
  const totalOrdenes = grupos.length;
  const ordenMasCritica = grupos[0] ?? null;

  const gruposVisibles = expandido ? grupos : grupos.slice(0, 3);

  return (
    <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* HEADER COMPACTO */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Mini-control documental
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">
                Documentos faltantes
              </h3>

              {totalDocumentos > 0 ? (
                <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                  Atención
                </span>
              ) : (
                <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Al día
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={cargar}
            disabled={cargando || procesandoId !== null}
            className="h-7 shrink-0 border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? "..." : "↻"}
          </button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-3 border-b border-slate-100">
        <MiniDato label="Órdenes" value={totalOrdenes} />
        <MiniDato
          label="Docs."
          value={totalDocumentos}
          valueClass={totalDocumentos > 0 ? "text-amber-700" : "text-slate-900"}
        />
        <MiniDato
          label="Crítica"
          value={ordenMasCritica ? `#${ordenMasCritica.noOrden}` : "—"}
          small
        />
      </div>

      {/* CUERPO */}
      <div className="px-4 py-3">
        {error && (
          <div className="mb-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
            {error}
          </div>
        )}

        {cargando ? (
          <EstadoCompacto
            titulo="Cargando..."
            descripcion="Consultando documentos pendientes."
            tono="neutral"
          />
        ) : totalDocumentos === 0 ? (
          <EstadoCompacto
            titulo="Sin documentos faltantes"
            descripcion="No hay órdenes pendientes de subsanación documental."
            tono="ok"
          />
        ) : (
          <div className="space-y-2">
            {gruposVisibles.map((grupo) => (
              <OrdenMiniCard
                key={grupo.noOrden}
                grupo={grupo}
                procesandoId={procesandoId}
                onSubsanar={subsanarDocumento}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      {grupos.length > 3 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
          <button
            type="button"
            onClick={() => setExpandido((prev) => !prev)}
            className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            {expandido
              ? "Mostrar menos"
              : `Ver ${grupos.length - 3} orden(es) más`}
          </button>
        </div>
      )}
    </section>
  );
}

type OrdenMiniCardProps = {
  grupo: GrupoOrdenDocumental;
  procesandoId: string | null;
  onSubsanar: (documentoId: string) => void;
};

function OrdenMiniCard({ grupo, procesandoId, onSubsanar }: OrdenMiniCardProps) {
  const primerDocumento = grupo.documentos[0];
  const tieneVarios = grupo.documentos.length > 1;

  return (
    <div className="border border-slate-200 bg-slate-50/70">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold tabular-nums text-slate-950">
              Orden #{grupo.noOrden}
            </span>

            <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {grupo.documentos.length} falt.
            </span>
          </div>

          <div className="mt-0.5 truncate text-[11px] text-slate-500">
            {grupo.descripcionOrden || "Sin descripción disponible."}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
            Fecha
          </div>

          <div className="text-[11px] font-semibold tabular-nums text-slate-700">
            {formatearFecha(grupo.fechaOrden)}
          </div>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-slate-900">
              {primerDocumento.nombreDocumento}
            </div>

            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              {primerDocumento.observacion || "Sin observación registrada."}
            </div>

            {tieneVarios && (
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700">
                +{grupo.documentos.length - 1} documento
                {grupo.documentos.length - 1 === 1 ? "" : "s"} adicional
                {grupo.documentos.length - 1 === 1 ? "" : "es"}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSubsanar(primerDocumento.documentoId)}
            disabled={procesandoId !== null}
            className="h-8 border border-emerald-600 bg-emerald-50 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {procesandoId === primerDocumento.documentoId
              ? "..."
              : "Subsanar"}
          </button>
        </div>

        {tieneVarios && (
          <div className="mt-2 space-y-1">
            {grupo.documentos.slice(1).map((doc) => (
              <div
                key={doc.documentoId}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-slate-200 pt-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-700">
                    {doc.nombreDocumento}
                  </div>

                  <div className="truncate text-[10px] text-slate-400">
                    {doc.observacion || "Sin observación."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSubsanar(doc.documentoId)}
                  disabled={procesandoId !== null}
                  className="h-6 border border-slate-300 bg-white px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-600 transition hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesandoId === doc.documentoId ? "..." : "OK"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type MiniDatoProps = {
  label: string;
  value: number | string;
  valueClass?: string;
  small?: boolean;
};

function MiniDato({
  label,
  value,
  valueClass = "text-slate-900",
  small = false,
}: MiniDatoProps) {
  return (
    <div className="border-r border-slate-100 px-4 py-2.5 last:border-r-0">
      <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-0.5 font-semibold tabular-nums",
          small ? "text-[12px]" : "text-[17px]",
          valueClass,
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

type EstadoCompactoProps = {
  titulo: string;
  descripcion: string;
  tono: "ok" | "neutral";
};

function EstadoCompacto({ titulo, descripcion, tono }: EstadoCompactoProps) {
  const className =
    tono === "ok"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className={`border px-3 py-4 text-center ${className}`}>
      <div className="text-[13px] font-semibold">{titulo}</div>
      <div className="mt-0.5 text-[11px] opacity-80">{descripcion}</div>
    </div>
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