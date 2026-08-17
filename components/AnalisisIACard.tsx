"use client";

import { useState } from "react";
import {
  AlertTriangle,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { analizarResumenFinanciero, ResultadoIA } from "@/services/analisisIA";

type ResultadoVinculado = {
  fuente: unknown[];
  analisis: ResultadoIA;
};

type ErrorVinculado = {
  fuente: unknown[];
  mensaje: string;
};

export default function AnalisisIACard({ data }: { data: unknown[] }) {
  const [resultado, setResultado] = useState<ResultadoVinculado | null>(null);
  const [errorGeneracion, setErrorGeneracion] =
    useState<ErrorVinculado | null>(null);
  const [loading, setLoading] = useState(false);
  const analisis = resultado?.fuente === data ? resultado.analisis : null;
  const error = errorGeneracion?.fuente === data ? errorGeneracion.mensaje : "";

  async function generarAnalisis() {
    if (data.length === 0 || loading) return;

    const fuente = data;
    setLoading(true);
    setErrorGeneracion(null);

    try {
      const res = await analizarResumenFinanciero(fuente);

      if (!res) {
        setErrorGeneracion({
          fuente,
          mensaje: "No se pudo generar el resumen con IA.",
        });
        return;
      }

      setResultado({ fuente, analisis: res });
    } finally {
      setLoading(false);
    }
  }

  function getStyles(riesgo: string) {
    if (riesgo === "alto") {
      return {
        border: "border-red-500",
        bg: "bg-red-50",
        badge: "bg-red-600 text-white",
      };
    }

    if (riesgo === "medio") {
      return {
        border: "border-yellow-500",
        bg: "bg-yellow-50",
        badge: "bg-yellow-500 text-white",
      };
    }

    return {
      border: "border-emerald-500",
      bg: "bg-emerald-50",
      badge: "bg-emerald-600 text-white",
    };
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-violet-200 bg-violet-50 p-4 text-xs text-violet-800">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        Generando el resumen financiero solicitado...
      </div>
    );
  }

  if (!analisis) {
    return (
      <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Resumen IA en modo manual
            </div>
            <p className="mt-1 text-xs leading-5 text-violet-800/80">
              La IA no recibe estos datos al cargar la página. Genere el resumen
              únicamente cuando lo necesite.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void generarAnalisis()}
            disabled={data.length === 0}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Generar resumen IA
          </button>
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  const styles = getStyles(analisis.nivel_riesgo);
  const hallazgos = Array.isArray(analisis.hallazgos)
    ? analisis.hallazgos
    : [];

  return (
    <div
      className={`rounded-md border-l-4 p-4 text-sm ${styles.border} ${styles.bg}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Análisis inteligente
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void generarAnalisis()}
            className="inline-flex items-center gap-1.5 rounded border border-current px-2 py-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
            title="Volver a generar el resumen con los datos actuales"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Actualizar con IA
          </button>
          <div className={`rounded px-2 py-1 text-xs ${styles.badge}`}>
            {analisis.nivel_riesgo.toUpperCase()}
          </div>
        </div>
      </div>

      <p className="mb-3 text-gray-700">{analisis.resumen}</p>

      {hallazgos.length > 0 ? (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-gray-600">
            Puntos críticos:
          </div>

          <ul className="list-disc space-y-1 pl-4 text-gray-800">
            {hallazgos.map((hallazgo, index) => (
              <li key={`${hallazgo}-${index}`}>{hallazgo}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="text-xs font-semibold text-gray-600">
        Acción recomendada:
      </div>

      <p className="font-medium text-gray-800">{analisis.recomendacion}</p>
    </div>
  );
}
