"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, Sparkles } from "lucide-react";
import { VERSION_INFORME_AUDITORIA, type ContextoMensualAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";

export default function ResumenMensualAuditoria({ mes, titulo, onGenerando, onGenerado }: {
  mes: string;
  titulo: string;
  onGenerando: (value: boolean) => void;
  onGenerado: () => void;
}) {
  const [contexto, setContexto] = useState<ContextoMensualAuditoria | null>(null);
  const [revisionCargada, setRevisionCargada] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const generacion = useRef<AbortController | null>(null);
  const datosPendientes = revisionCargada !== `${mes}:${recarga}`;
  const cargando = consultando || datosPendientes;
  const fuentes = contexto?.resumen?.fuentes ?? contexto?.fuentes ?? [];
  const formatoAnterior = Boolean(contexto?.resumen && (contexto.resumen.version_informe ?? 1) < VERSION_INFORME_AUDITORIA);

  useEffect(() => {
    const controller = new AbortController();
    const revisionActual = `${mes}:${recarga}`;
    async function cargar() {
      // La petición empieza tras el montaje. El HTML inicial no depende de su estado.
      setConsultando(true);
      try {
        const response = await fetch(`/api/informes-auditoria?mes=${encodeURIComponent(mes)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) throw new Error(data?.error ?? "No se pudo cargar el resumen mensual.");
        if (!controller.signal.aborted) { setContexto(data); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setContexto(null);
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen mensual.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setRevisionCargada(revisionActual);
          setConsultando(false);
        }
      }
    }
    void cargar();
    return () => controller.abort();
  }, [mes, recarga]);

  useEffect(() => () => generacion.current?.abort(), []);

  async function generar() {
    if (generacion.current || !contexto?.fuentes.length || cargando) return;
    const controller = new AbortController();
    generacion.current = controller;
    setGenerando(true);
    onGenerando(true);
    setError("");
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const response = await fetch("/api/informes-auditoria", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error ?? "No se pudo generar el resumen.");
      setContexto(data);
      onGenerado();
      // Vuelve a obtener la vigencia por si otra orden cambió al terminar la generación.
      setRecarga((value) => value + 1);
    } catch (cause) {
      setError(controller.signal.aborted
        ? "La generación tardó demasiado. Use Actualizar para consultar si el resumen quedó guardado."
        : cause instanceof Error ? cause.message : "No se pudo generar el resumen.");
    } finally {
      window.clearTimeout(timeout);
      generacion.current = null;
      setGenerando(false);
      onGenerando(false);
    }
  }

  function descargar() {
    const resumen = contexto?.resumen;
    if (!resumen) return;
    const contenido = [
      `Informe mensual de recomendaciones de auditoría — ${titulo}`,
      "Dirigido a: Corporación Municipal y Alcalde Municipal",
      `Generado: ${resumen.generado_en}`,
      `Órdenes con recomendaciones: ${resumen.fuentes.length} de ${resumen.total_ordenes}`,
      contexto.desactualizado ? "Estado: pendiente de actualización." : "Estado: vigente al consultar.",
      "", "1. TODAS LAS RECOMENDACIONES DEL MES", "",
      ...resumen.fuentes.map((fuente) => [
        `Orden #${fuente.no_orden} — ${fuente.fecha}`,
        `Descripción: ${fuente.descripcion}`,
        `Beneficiarios: ${fuente.proveedores.join(", ")}`,
        `Egreso: ${formatearMonto(fuente.monto_egreso)}`,
        "Recomendaciones:", fuente.recomendaciones, "",
      ].join("\n")),
      "2. RECOMENDACIONES GENERALES DEL AUDITOR", "", resumen.resumen,
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", contenido], { type: "text/plain;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `informe-recomendaciones-auditoria-${mes}.txt`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <div className="space-y-4 p-4 text-[12px]">
        <p className="text-slate-600">Recomendaciones de {titulo.toLocaleLowerCase("es-HN")} dirigidas a la Corporación Municipal y al Alcalde Municipal.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void generar()}
            disabled={generando || cargando || !contexto?.fuentes.length || Boolean(contexto.resumen && !contexto.desactualizado)}
            className="inline-flex items-center gap-2 rounded-md bg-[#005f48] px-3 py-2 font-semibold text-white hover:bg-[#004c39] disabled:cursor-not-allowed disabled:opacity-45">
            {generando ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {generando ? "Preparando recomendaciones…" : contexto?.resumen ? contexto.desactualizado ? "Regenerar informe" : "Informe actualizado" : "Generar informe"}
          </button>
          <button type="button" disabled={consultando || generando} onClick={() => {
            if (cargando || generando) return;
            setRecarga((value) => value + 1);
          }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-700 disabled:opacity-45">Actualizar</button>
          {contexto?.resumen && <button type="button" onClick={descargar} disabled={cargando || generando}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:opacity-45"><Download className="h-3.5 w-3.5" aria-hidden="true" />Descargar informe completo</button>}
          {cargando ? <span role="status" className="text-slate-500">Cargando recomendaciones…</span>
            : contexto && <span className="text-slate-600">{contexto.fuentes.length} de {contexto.total_ordenes} orden(es) tienen recomendaciones.</span>}
        </div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
        {!cargando && contexto && contexto.fuentes.length === 0 && <p className="text-slate-600">Aún no hay recomendaciones guardadas para este mes. Registre la primera en el formulario de una orden.</p>}
        {!cargando && contexto && (fuentes.length > 0 || contexto.resumen) && <article aria-label={`Informe de ${titulo}`} className="rounded-md border border-slate-300 bg-white">
          <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-[15px] font-semibold text-slate-950">Informe de recomendaciones · {titulo}</h3>
            <p className="mt-1 text-[12px] text-slate-700">A la Corporación Municipal y al Alcalde Municipal</p>
            <p className="mt-1 text-[11px] text-slate-500">{contexto.resumen
              ? `Generado el ${new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(contexto.resumen.generado_en))}`
              : "Vista previa de las recomendaciones guardadas; síntesis general pendiente."}
              {` · ${fuentes.length} de ${contexto.resumen?.total_ordenes ?? contexto.total_ordenes} orden(es) con recomendaciones`}
            </p>
          </header>
          {contexto.desactualizado && <p role="status" className="m-4 border-l-4 border-amber-400 bg-amber-50 p-3 text-amber-900">{formatoAnterior
            ? "Este informe usa la redacción anterior. Regenérelo para obtener recomendaciones directas del auditor a la Corporación Municipal y al Alcalde Municipal."
            : "Las recomendaciones o el contexto del mes cambiaron. Regenere el informe para incluir todos los cambios."} Se muestra la copia guardada con las recomendaciones utilizadas en esa generación.</p>}
          <section className="p-4" aria-label="Todas las recomendaciones del mes">
            <h4 className="border-l-2 border-[#005f48] pl-3 text-[13px] font-semibold text-slate-900">1. Todas las recomendaciones del mes</h4>
            <p className="mt-2 text-slate-500">Texto íntegro por orden de pago, sin excluir recomendaciones por su carácter positivo o negativo.</p>
            <ol className="mt-4 space-y-4">{fuentes.map((fuente) => <li key={fuente.no_orden} className="overflow-hidden rounded-md border border-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-[#005f48]">Orden #{fuente.no_orden}</p>
                <p className="text-[11px] text-slate-600">{fuente.fecha} · {formatearMonto(fuente.monto_egreso)}</p>
              </div>
              <div className="space-y-2 p-3">
                <p className="break-words text-slate-700">{fuente.descripcion}</p>
                <p className="break-words text-[11px] text-slate-500">Beneficiarios: {fuente.proveedores.join(", ")}</p>
                <div className="border-t border-slate-200 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recomendaciones registradas</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-slate-800">{fuente.recomendaciones}</p>
                </div>
              </div>
            </li>)}</ol>
          </section>
          <section className="border-t border-slate-300 bg-slate-50/70 p-4" aria-label="Recomendaciones generales del auditor">
            <h4 className="border-l-2 border-[#005f48] pl-3 text-[13px] font-semibold text-slate-900">2. Recomendaciones generales del auditor</h4>
            {contexto.resumen
              ? <div className="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-800">{contexto.resumen.resumen}</div>
              : <p className="mt-3 text-slate-600">Seleccione Generar informe para preparar las recomendaciones generales del auditor.</p>}
          </section>
        </article>}
    </div>
  );
}

function formatearMonto(value: number) {
  return Number(value).toLocaleString("es-HN", { style: "currency", currency: "HNL" });
}
