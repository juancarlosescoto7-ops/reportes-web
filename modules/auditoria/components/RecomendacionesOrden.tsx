"use client";

import { memo, useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { MAX_RECOMENDACIONES_AUDITORIA, type RecomendacionAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";
import { type BorradoresAuditoria } from "@/modules/auditoria/services/borradores-auditoria";

function RecomendacionesOrden({ noOrden, tieneFecha, borradores }: {
  noOrden: number;
  tieneFecha: boolean;
  borradores: BorradoresAuditoria;
}) {
  const suscribir = useCallback((notificar: () => void) => borradores.suscribirOrden(noOrden, notificar), [borradores, noOrden]);
  const obtenerEstado = useCallback(() => borradores.obtenerOrden(noOrden), [borradores, noOrden]);
  const obtenerEstadoInicial = useCallback(() => borradores.obtenerOrdenInicial(noOrden), [borradores, noOrden]);
  const { texto, guardada } = useSyncExternalStore(suscribir, obtenerEstado, obtenerEstadoInicial);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  const [versionCompartida, setVersionCompartida] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null);
  const modificado = texto.trim() !== (guardada?.recomendaciones ?? "");
  const inputId = `recomendaciones-orden-${noOrden}`;

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando || !modificado) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const response = await fetch("/api/auditoria/recomendaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noOrden, recomendaciones: texto, version: guardada?.version ?? 0 }),
        signal: AbortSignal.timeout(35_000),
      });
      const data = await response.json().catch(() => null) as {
        recomendacion?: RecomendacionAuditoria; error?: string;
      } | null;
      if (!response.ok || !data?.recomendacion) {
        if (response.status === 409) setConflicto(true);
        throw new Error(data?.error ?? "No se pudo guardar. Su texto permanece en el formulario.");
      }
      borradores.registrarGuardada(data.recomendacion);
      setConflicto(false);
      setVersionCompartida(null);
      setMensaje({ error: false, texto: "Recomendaciones guardadas." });
    } catch (error) {
      setMensaje({ error: true, texto: error instanceof Error && error.name !== "TimeoutError"
        ? error.message : "No se recibió confirmación del guardado. Su texto permanece en el formulario." });
    } finally {
      setGuardando(false);
    }
  }

  async function cargarVersion() {
    if (guardando) return;
    setGuardando(true);
    try {
      const response = await fetch(`/api/auditoria/recomendaciones?noOrden=${noOrden}`, {
        cache: "no-store", signal: AbortSignal.timeout(35_000),
      });
      const data = await response.json().catch(() => null) as { recomendacion?: RecomendacionAuditoria; error?: string } | null;
      if (!response.ok || !data?.recomendacion) throw new Error(data?.error ?? "No se pudo cargar la versión guardada.");
      borradores.registrarGuardada(data.recomendacion);
      setVersionCompartida(data.recomendacion.recomendaciones);
      setConflicto(false);
      setMensaje({ error: false, texto: "Se cargó la última versión sin reemplazar su borrador. Integre los cambios antes de guardar." });
    } catch (error) {
      setMensaje({ error: true, texto: error instanceof Error ? error.message : "No se pudo cargar la versión guardada." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="m-3 flex min-w-0 flex-col rounded-md border border-slate-300 bg-slate-100/80 p-4 xl:ml-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3">
        <label htmlFor={inputId} className="border-l-2 border-[#005f48] pl-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
          Recomendaciones de auditoría
        </label>
        <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${modificado ? "border-amber-300 bg-amber-50 text-amber-800" : guardada?.recomendaciones ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}>
          {modificado ? "Cambios sin guardar" : guardada?.recomendaciones ? "Registradas" : "Sin recomendaciones registradas"}
        </span>
      </div>
      <textarea
        id={inputId}
        value={texto}
        onChange={(event) => { borradores.editar(noOrden, event.target.value); setMensaje(null); }}
        rows={3}
        maxLength={MAX_RECOMENDACIONES_AUDITORIA}
        disabled={guardando}
        aria-describedby={`${inputId}-ayuda`}
        placeholder="Escriba las recomendaciones puntuales para esta orden de pago y las acciones de seguimiento sugeridas."
        className="min-h-[140px] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] leading-6 text-slate-800 outline-none placeholder:text-slate-500 focus:border-[#005f48] focus:ring-1 focus:ring-[#005f48]/20 disabled:bg-slate-50 xl:flex-1"
      />
      <div className="mt-3 flex flex-col items-start gap-3">
        <p id={`${inputId}-ayuda`} className="text-[11px] text-slate-500">
          {texto.length.toLocaleString("es-HN")} / 10,000 caracteres. {tieneFecha ? "Se incluirán en el informe del mes de la orden." : "Esta orden necesita una fecha para incluirse en un informe mensual."}
        </p>
        <button type="submit" disabled={guardando || !modificado || conflicto}
          className="inline-flex items-center gap-2 self-end rounded-md bg-[#003331] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#005f48] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
          {guardando ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {guardando ? "Guardando…" : "Guardar recomendaciones"}
        </button>
      </div>
      {mensaje && <p role={mensaje.error ? "alert" : "status"} className={`mt-2 text-[12px] ${mensaje.error ? "text-red-700" : "text-emerald-800"}`}>{mensaje.texto}</p>}
      {conflicto && <button type="button" onClick={() => void cargarVersion()} disabled={guardando}
        className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-2 text-[12px] font-semibold text-amber-900 disabled:opacity-45">
        Cargar versión guardada sin perder mi texto
      </button>}
      {versionCompartida !== null && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px]">
        <p className="font-semibold text-amber-900">Última versión guardada por el equipo</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{versionCompartida || "Sin recomendaciones."}</p>
      </div>}
    </form>
  );
}

export default memo(RecomendacionesOrden);
