"use client";

import { useEffect, useState } from "react";
import { analizarResumenFinanciero, ResultadoIA } from "@/services/analisisIA";

export default function AnalisisIACard({ data }: { data: any[] }) {
  const [analisis, setAnalisis] = useState<ResultadoIA | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await analizarResumenFinanciero(data);
      setAnalisis(res);
      setLoading(false);
    }

    if (data?.length > 0) load();
  }, [data]);

  function getStyles(riesgo: string) {
    if (riesgo === "alto") return { border: "border-red-500", bg: "bg-red-50", badge: "bg-red-600 text-white", icon: "🔴" };
    if (riesgo === "medio") return { border: "border-yellow-500", bg: "bg-yellow-50", badge: "bg-yellow-500 text-white", icon: "🟡" };
    return { border: "border-emerald-500", bg: "bg-emerald-50", badge: "bg-emerald-600 text-white", icon: "🟢" };
  }

  if (loading) {
    return (
      <div className="p-4 text-xs text-gray-500 border rounded-md bg-white">
        Analizando información financiera...
      </div>
    );
  }

  if (!analisis) return null;

  const styles = getStyles(analisis.nivel_riesgo);

  const hallazgos = Array.isArray(analisis.hallazgos)
    ? analisis.hallazgos
    : [];

  return (
    <div className={`border-l-4 p-4 rounded-md text-sm ${styles.border} ${styles.bg}`}>

      <div className="flex justify-between mb-2">
        <div className="font-semibold flex items-center gap-2">
          {styles.icon} Análisis Inteligente
        </div>

        <div className={`text-xs px-2 py-1 rounded ${styles.badge}`}>
          {analisis.nivel_riesgo.toUpperCase()}
        </div>
      </div>

      <p className="text-gray-700 mb-3">
        {analisis.resumen}
      </p>

      {hallazgos.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            Puntos críticos:
          </div>

          <ul className="list-disc pl-4 space-y-1 text-gray-800">
            {hallazgos.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs font-semibold text-gray-600">
        Acción recomendada:
      </div>

      <p className="text-gray-800 font-medium">
        {analisis.recomendacion}
      </p>

    </div>
  );
}