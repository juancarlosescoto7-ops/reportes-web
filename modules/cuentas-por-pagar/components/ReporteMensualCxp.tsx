"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { documentoMensualCxp, nombrePeriodo, periodosCerrados, prepararDocumentoMensualCxp, type ReporteMensualCxp as Reporte } from "../domain/reporte-mensual-cxp";
import { obtenerReportesMensualesCxp } from "../services/reporteMensualCxp";
import { cargarMembreteReporteMensualPdf } from "../services/membreteReporteMensual";

function VistaReporte({ reporte, anioEmision }: { reporte: Reporte; anioEmision: string }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => documentoMensualCxp(reporte, "", anioEmision), [reporte, anioEmision]);
  useEffect(() => {
    const iframe = marco.current;
    if (!iframe) return;
    let observer: ResizeObserver | undefined;
    const ajustar = () => {
      observer?.disconnect();
      const articulo = iframe.contentDocument?.querySelector("article");
      if (!articulo) return;
      const medir = () => { iframe.style.height = `${Math.ceil(articulo.getBoundingClientRect().height) + 2}px`; };
      medir();
      observer = new ResizeObserver(medir);
      observer.observe(articulo);
    };
    iframe.addEventListener("load", ajustar);
    ajustar();
    return () => { iframe.removeEventListener("load", ajustar); observer?.disconnect(); };
  }, [html]);
  return <iframe ref={marco} title={`Reporte de ${nombrePeriodo(reporte.periodo)}`} srcDoc={html} className="min-h-[750px] w-full border-0 bg-white" />;
}

export default function ReporteMensualCxp({ periodoInicial, anioEmisionInicial }: { periodoInicial: string; anioEmisionInicial: string }) {
  const [anio, setAnio] = useState(Number(periodoInicial.slice(0, 4)));
  const [anioEmision, setAnioEmision] = useState(anioEmisionInicial);
  const [carga, setCarga] = useState<{ anio: number; reportes: Reporte[]; error: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [descargando, setDescargando] = useState("");
  const [errorPdf, setErrorPdf] = useState("");
  const cargando = carga?.anio !== anio;
  const reportes = carga?.anio === anio ? carga.reportes : [];
  const anioValido = /^\d{4}$/.test(anioEmision) && Number(anioEmision) >= 1900;
  useEffect(() => {
    let activo = true;
    obtenerReportesMensualesCxp(periodosCerrados(anio, periodoInicial)).then(
      (reportes) => { if (activo) setCarga({ anio, reportes, error: "" }); },
      (error) => { if (activo) setCarga({ anio, reportes: [], error: error instanceof Error ? error.message : "No se pudieron cargar los reportes." }); },
    );
    return () => { activo = false; };
  }, [anio, periodoInicial, revision]);

  async function descargar(seleccion: Reporte[], clave: string) {
    setDescargando(clave);
    setErrorPdf("");
    try {
      const [{ generarReportesMensualesCxpPdf }, membrete] = await Promise.all([
        import("../domain/reporte-mensual-cxp-pdf"), cargarMembreteReporteMensualPdf(),
      ]);
      const bytes = await generarReportesMensualesCxpPdf(seleccion.map((reporte) => prepararDocumentoMensualCxp(reporte, anioEmision)), membrete);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `cuentas-por-pagar-${seleccion.length === 1 ? seleccion[0].periodo : anio}.pdf`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) { setErrorPdf(error instanceof Error ? error.message : "No se pudo descargar el PDF."); }
    finally { setDescargando(""); }
  }

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <header className="rounded-2xl border border-slate-200 bg-white p-5">
      <Link data-shortcut="360" href="/reportes/compromisos-presupuestarios" className="text-sm font-medium text-emerald-800">← Cuentas por pagar</Link>
      <div className="mt-4 flex items-center gap-3"><FileText className="h-7 w-7 text-emerald-800" aria-hidden="true" /><h1 className="text-xl font-semibold text-slate-950">Reportes mensuales por acreedor</h1></div>
      <p className="mt-2 text-sm text-slate-600">Todos los cierres del año seleccionado, con saldos agrupados por acreedor. Descargue cada mes por separado o todos juntos, separados por páginas.</p>
    </header>
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <label className="grid gap-1.5 text-sm font-medium">Año del reporte
        <select value={anio} onChange={(event) => setAnio(Number(event.target.value))} className="h-10 border bg-white px-3">
          {Array.from({ length: Number(periodoInicial.slice(0, 4)) - 1899 }, (_, i) => Number(periodoInicial.slice(0, 4)) - i).map((valor) => <option key={valor} value={valor}>{valor}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">Año de expedición
        <input type="number" min="1900" max="9999" value={anioEmision} onChange={(event) => setAnioEmision(event.target.value)} className="h-10 w-32 border bg-white px-3" />
      </label>
      <button data-shortcut="361" type="button" disabled={cargando} onClick={() => { setCarga(null); setRevision((valor) => valor + 1); }} className="h-10 border bg-white px-4 text-sm font-semibold disabled:opacity-50">Actualizar reportes</button>
      <button data-shortcut="362" type="button" disabled={!reportes.length || Boolean(descargando) || !anioValido} onClick={() => void descargar(reportes, "todos")} className="inline-flex h-10 items-center gap-2 bg-[#003331] px-4 text-sm font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4" aria-hidden="true" />{descargando === "todos" ? "Preparando PDF…" : "Descargar todos en PDF"}</button>
    </div>
    {(errorPdf || (!cargando && carga?.error)) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorPdf || carga?.error}</p>}
    {cargando && <p role="status" className="p-10 text-center text-slate-600">Cargando los reportes mensuales…</p>}
    <nav aria-label="Meses del reporte" className="flex flex-wrap gap-2">{reportes.map((reporte) => <a data-shortcut-ignore key={reporte.periodo} href={`#mes-${reporte.periodo}`} className="rounded-lg border bg-white px-3 py-2 text-sm capitalize text-emerald-900">{nombrePeriodo(reporte.periodo)}</a>)}</nav>
    {reportes.map((reporte) => <section key={reporte.periodo} id={`mes-${reporte.periodo}`} className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4">
        <h2 className="font-semibold capitalize text-slate-950">{nombrePeriodo(reporte.periodo)}</h2>
        <button data-shortcut-ignore type="button" disabled={Boolean(descargando) || !anioValido} onClick={() => void descargar([reporte], reporte.periodo)} className="inline-flex items-center gap-2 border bg-white px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-40"><Download className="h-4 w-4" aria-hidden="true" />{descargando === reporte.periodo ? "Preparando PDF…" : "Descargar PDF del mes"}</button>
      </div>
      <VistaReporte reporte={reporte} anioEmision={anioEmision} />
    </section>)}
  </div>;
}
