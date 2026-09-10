"use client";

import { useEffect, useState } from "react";
import { obtenerResumenPresupuesto } from "@/modules/dashboard/services/presupuestoResumen";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Row = {
  clasificacion_fuente: string;
  clasificacion_tipo_inversion: string;
  total_ejecutado: number;
};

type ResumenFuente = Record<string, number> & {
  total: number;
};

type ResumenPorFuente = Record<string, ResumenFuente>;

function transformar(rows: Row[]): ResumenPorFuente {
  const resultado: ResumenPorFuente = {};

  rows.forEach((row) => {
    if (!resultado[row.clasificacion_fuente]) {
      resultado[row.clasificacion_fuente] = { total: 0 };
    }

    resultado[row.clasificacion_fuente][row.clasificacion_tipo_inversion] =
      row.total_ejecutado;
    resultado[row.clasificacion_fuente].total += row.total_ejecutado;
  });

  return resultado;
}

export default function ResumenPresupuesto() {
  const [pivot, setPivot] = useState<ResumenPorFuente>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const res = await obtenerResumenPresupuesto();
      setPivot(transformar(res));
    }

    fetchData();
  }, []);

  const columnas = [
    "Gastos de funcionamiento",
    "Gastos de inversión",
    "Otros",
  ];

  const totalGeneral = Object.values(pivot).reduce(
    (acc, curr) => acc + (curr.total || 0),
    0
  );

  const chartData = Object.keys(pivot).map((fuente) => ({
    fuente,
    funcionamiento:
      pivot[fuente]["Gastos de funcionamiento"] || 0,
    inversion:
      pivot[fuente]["Gastos de inversión"] || 0,
    otros: pivot[fuente]["Otros"] || 0,
  }));

  return (
    <div className="max-w-4xl">

      {/* CARD PRINCIPAL */}
      <div data-shortcut="109"
        onClick={() => setOpen(!open)}
        className="border rounded-xl p-5 cursor-pointer bg-white shadow-sm hover:shadow-md transition"
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-base text-[#003331]">
              Resumen Presupuestario
            </h2>
            <p className="text-xs text-gray-500">
              Clasificación por fuente y tipo de inversión
            </p>
          </div>

          <span className="text-[#003331]">
            {open ? "−" : "+"}
          </span>
        </div>

        {/* KPI GENERAL */}
        <div className="mt-4">
          <div className="text-xs text-gray-500">
            Total ejecutado
          </div>
          <div className="text-lg font-semibold text-[#003331]">
            L {totalGeneral.toLocaleString()}
          </div>
        </div>
      </div>

      {/* DETALLE */}
      {open && (
        <div className="mt-4 space-y-4">

          {/* GRÁFICO */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-xs font-semibold text-[#003331] mb-3">
              Distribución por fuente
            </h3>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartData}
                barCategoryGap="30%"
              >
                <XAxis
                  dataKey="fuente"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "8px",
                  }}
                />

                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                />

                <Bar
                  dataKey="funcionamiento"
                  fill="#003331"
                  barSize={10}
                  name="Funcionamiento"
                />

                <Bar
                  dataKey="inversion"
                  fill="#42c172"
                  barSize={10}
                  name="Inversión"
                />

                <Bar
                  dataKey="otros"
                  fill="#94a3b8"
                  barSize={10}
                  name="Otros"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* DETALLE POR FUENTE */}
          {Object.keys(pivot).map((fuente) => (
            <div
              key={fuente}
              className="border rounded-lg p-4 bg-gray-50"
            >
              <div className="font-semibold text-sm text-[#003331] mb-2">
                {fuente}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {columnas.map((col) => (
                  <div
                    key={col}
                    className="bg-white p-2 rounded border"
                  >
                    <div className="text-gray-400 text-[10px]">
                      {col}
                    </div>
                    <div className="font-medium text-[#003331]">
                      L{" "}
                      {(pivot[fuente][col] || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 text-right text-xs font-semibold text-[#003331]">
                Total: L {pivot[fuente].total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
