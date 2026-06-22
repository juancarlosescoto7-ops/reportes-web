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
      "Confirmas que este documento ya fue subsanado?"
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
      setError("Ocurrio un error al subsanar el documento.");
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
    <section className="overflow-hidden border border-slate-200 bg-[#eef1f5] shadow-sm">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-300 bg-white/80 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Control documental
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-950">
              Documentos faltantes
            </h3>

            <EstadoBandeja totalDocumentos={totalDocumentos} />
          </div>
        </div>

        <button
          type="button"
          onClick={cargar}
          disabled={cargando || procesandoId !== null}
          className="h-8 shrink-0 border border-slate-300 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cargando ? "..." : "Refrescar"}
        </button>
      </div>

      <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
        <MiniDato label="Ordenes" value={totalOrdenes} />
        <MiniDato
          label="Docs."
          value={totalDocumentos}
          valueClass={totalDocumentos > 0 ? "text-amber-700" : "text-slate-900"}
        />
        <MiniDato
          label="Critica"
          value={ordenMasCritica ? ordenMasCritica.noOrden : "-"}
          small
        />
      </div>

      <div className="p-3">
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
            descripcion="No hay ordenes pendientes de subsanacion documental."
            tono="ok"
          />
        ) : (
          <div className="space-y-3">
            {gruposVisibles.map((grupo) => (
              <OrdenDocumentalRow
                key={grupo.noOrden}
                grupo={grupo}
                procesandoId={procesandoId}
                onSubsanar={subsanarDocumento}
              />
            ))}
          </div>
        )}
      </div>

      {grupos.length > 3 && (
        <div className="border-t border-slate-200 bg-white/80 px-4 py-2">
          <button
            type="button"
            onClick={() => setExpandido((prev) => !prev)}
            className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-950"
          >
            {expandido ? "Mostrar menos" : `Ver ${grupos.length - 3} ordenes mas`}
          </button>
        </div>
      )}
    </section>
  );
}

type OrdenDocumentalRowProps = {
  grupo: GrupoOrdenDocumental;
  procesandoId: string | null;
  onSubsanar: (documentoId: string) => void;
};

function OrdenDocumentalRow({
  grupo,
  procesandoId,
  onSubsanar,
}: OrdenDocumentalRowProps) {
  return (
    <article className="grid grid-cols-1 overflow-hidden border border-slate-300 bg-white/75 backdrop-blur-xl sm:grid-cols-[145px_1fr]">
      <div className="border-b border-slate-200 bg-white px-3 py-3 sm:border-b-0 sm:border-r">
        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Orden
        </div>

        <div className="mt-1 break-words text-[22px] font-semibold leading-none tabular-nums text-slate-950">
          {grupo.noOrden}
        </div>

        <div className="mt-3 text-[9px] uppercase tracking-[0.14em] text-slate-400">
          Fecha
        </div>

        <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
          {formatearFecha(grupo.fechaOrden)}
        </div>

        <div className="mt-3 inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
          {grupo.documentos.length} falt.
        </div>
      </div>

      <div className="min-w-0">
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="line-clamp-2 text-[11px] leading-4 text-slate-500">
            {grupo.descripcionOrden || "Sin descripcion disponible."}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {grupo.documentos.map((doc) => (
            <DocumentoFaltanteRow
              key={doc.documentoId}
              doc={doc}
              procesandoId={procesandoId}
              onSubsanar={onSubsanar}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

type DocumentoFaltanteRowProps = {
  doc: DocumentoFaltanteBandeja;
  procesandoId: string | null;
  onSubsanar: (documentoId: string) => void;
};

function DocumentoFaltanteRow({
  doc,
  procesandoId,
  onSubsanar,
}: DocumentoFaltanteRowProps) {
  const procesando = procesandoId === doc.documentoId;

  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold leading-4 text-slate-900">
          {doc.nombreDocumento}
        </div>

        <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
          {doc.observacion || "Sin observacion registrada."}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSubsanar(doc.documentoId)}
        disabled={procesandoId !== null}
        className="h-7 justify-self-start border border-emerald-600 bg-emerald-50 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 sm:justify-self-end"
      >
        {procesando ? "..." : "Subsanar"}
      </button>
    </div>
  );
}

type EstadoBandejaProps = {
  totalDocumentos: number;
};

function EstadoBandeja({ totalDocumentos }: EstadoBandejaProps) {
  if (totalDocumentos > 0) {
    return (
      <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
        Atencion
      </span>
    );
  }

  return (
    <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
      Al dia
    </span>
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
    <div className="border-r border-slate-200 px-3 py-2.5 last:border-r-0">
      <div className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
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
  if (!value) return "-";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "-";

  return fecha.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
