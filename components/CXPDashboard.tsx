"use client";

import { useEffect, useState } from "react";
import { obtenerCXP } from "@/services/cxp";

type CXP = {
  cxp_id: number;
  fecha: string;
  descripcion: string;
  no_cxp: number;
  haber: number;
  monto_ejecutado: number;
  beneficiario_id: number;
  beneficiario_nombre: string;
  decision_pago: string;
  motivo_pago: string;
};

export default function CxpDashboard() {
  const [data, setData] = useState<CXP[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    obtenerCXP().then(setData);
  }, []);

  const getTone = (decision: string) => {
    switch (decision) {
      case "Pago total":
        return {
          dot: "bg-[#01FE8F]",
          label: "Óptimo",
          soft: "bg-[#01FE8F]/10",
          text: "text-[#003331]"
        };
      case "Pago parcial":
        return {
          dot: "bg-[#0e9263]",
          label: "Optimizar",
          soft: "bg-[#0e9263]/10",
          text: "text-[#003331]"
        };
      default:
        return {
          dot: "bg-red-500",
          label: "Riesgo",
          soft: "bg-red-500/10",
          text: "text-red-700"
        };
    }
  };

  return (
    <div className="p-6 bg-[#003331]/5 min-h-screen">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#003331]">
          Cuentas por Pagar
        </h1>
        <p className="text-sm text-gray-500">
          Vista analítica de obligaciones financieras
        </p>
      </div>

      {/* GRID */}
      <div className="grid gap-4">
        {data.map((c) => {
          const tone = getTone(c.decision_pago);

          return (
            <div
              key={c.cxp_id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition"
            >
              {/* HEADER */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-sm font-semibold text-[#003331]">
                    CXP #{c.no_cxp}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.descripcion}
                  </p>
                </div>

                {/* STATUS */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                  <span className="text-xs text-gray-600 font-medium">
                    {tone.label}
                  </span>
                </div>
              </div>

              {/* FINANCIAL ROW */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
                <div>
                  <p className="text-gray-400">Beneficiario</p>
                  <p className="font-medium text-[#003331]">
                    {c.beneficiario_nombre}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">ID</p>
                  <p className="font-medium">{c.beneficiario_id}</p>
                </div>

                <div>
                  <p className="text-gray-400">Compromiso</p>
                  <p className="font-semibold text-[#0e9263]">
                    L {c.haber.toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400">Ejecutado</p>
                  <p className="font-semibold text-[#003331]">
                    L {c.monto_ejecutado.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* PROGRESS BAR */}
              <div className="mt-4">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0e9263]"
                    style={{
                      width: `${(c.monto_ejecutado / (c.haber || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* ACTION */}
              <div className="mt-3 flex justify-between items-center">
                <button
                  onClick={() =>
                    setExpanded(expanded === c.cxp_id ? null : c.cxp_id)
                  }
                  className="text-xs text-[#0e9263] hover:underline"
                >
                  {expanded === c.cxp_id
                    ? "Ocultar análisis"
                    : "Ver análisis"}
                </button>

                <span className="text-[10px] text-gray-400">
                  ID: {c.cxp_id}
                </span>
              </div>

              {/* EXPANDED PANEL */}
              {expanded === c.cxp_id && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                  {c.motivo_pago}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}