"use client";

import { useEffect, useState } from "react";
import { obtenerOrdenesEstructuradas, Orden } from "@/services/ordenes.service";

export default function OrdenesReport() {
  const [data, setData] = useState<Orden[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const res = await obtenerOrdenesEstructuradas();
    setData(res);
  }

  function toggle(id: string) {
    setOpen(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  // 📊 KPIs
  const totalHaber = data.reduce((acc, o) => acc + o.total_haber, 0);
  const totalEjecutado = data.reduce((acc, o) => acc + o.total_ejecutado, 0);
  const totalDif = totalHaber - totalEjecutado;
  const porcentajeEjecucion =
    totalHaber > 0 ? (totalEjecutado / totalHaber) * 100 : 0;

  function getDiffStyle(value: number) {
    if (value > 0) return "text-red-600 font-semibold";
    if (value < 0) return "text-yellow-600 font-semibold";
    return "text-gray-700";
  }

    const filtered = data.filter(o => {
      const matchOrden =
        o.no_orden.toLowerCase().includes(search.toLowerCase()) ||
        o.descripcion.toLowerCase().includes(search.toLowerCase());

      const matchBeneficiario = o.beneficiarios.some(b =>
        b.nombre.toLowerCase().includes(search.toLowerCase())
      );

      return matchOrden || matchBeneficiario;
    });

  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* 📌 HEADER FIJO (KPIs + BUSCADOR) */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 space-y-4 p-4 md:p-6">

        {/* 📊 KPIs RESPONSIVE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

          <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-3 md:p-4">
            <div className="text-xs text-gray-500">Egreso total</div>
            <div className="text-sm md:text-lg font-semibold text-gray-800">
              {totalHaber.toFixed(2)}
            </div>
          </div>

          <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-3 md:p-4">
            <div className="text-xs text-gray-500">Ejecutado total</div>
            <div className="text-sm md:text-lg font-semibold text-gray-800">
              {totalEjecutado.toFixed(2)}
            </div>
          </div>

          <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-3 md:p-4">
            <div className="text-xs text-gray-500">Diferencia</div>
            <div className={`text-sm md:text-lg ${getDiffStyle(totalDif)}`}>
              {totalDif.toFixed(2)}
            </div>
          </div>

          <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-3 md:p-4">
            <div className="text-xs text-gray-500">% Ejecución</div>
            <div className="text-sm md:text-lg font-semibold text-gray-800">
              {porcentajeEjecucion.toFixed(1)}%
            </div>
          </div>

        </div>

        {/* 🔎 BUSCADOR */}
        <input
          className="w-full p-3 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Buscar orden o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      {/* 📦 WORKSPACE SCROLLABLE */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

        {filtered.map(order => (
          <div
            key={order.no_orden}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >

            {/* 🧾 CABECERA RESPONSIVE */}
            <div
              onClick={() => toggle(order.no_orden)}
              className="p-4 md:p-5 cursor-pointer border-b border-gray-100 bg-white"
            >

              {/* TITULO + BADGE */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">

                <div className="flex items-center gap-2">
                  <div className="text-lg md:text-xl font-semibold text-[#003331]">
                    {order.no_orden}
                  </div>

                  {order.diferencia !== 0 && (
                    <span
                      className={`text-[10px] md:text-xs px-2 py-1 rounded-full ${
                        order.diferencia > 0
                          ? "bg-red-100 text-red-600"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {order.diferencia > 0
                        ? "Subejecución"
                        : "Sobreejecución"}
                    </span>
                  )}
                </div>

              </div>

              {/* DESCRIPCIÓN */}
              <div className="text-xs md:text-sm text-gray-500 mt-1 line-clamp-2 md:line-clamp-none">
                {order.descripcion}
              </div>

              {/* 📊 KPIs INTERNOS DESKTOP */}
              <div className="hidden md:flex mt-3 justify-between text-xs text-gray-500">

                <span>{order.fecha}</span>

                <div className="flex gap-4">

                  <span>
                    Egreso:{" "}
                    <b className="text-gray-800">
                      {order.total_haber.toFixed(2)}
                    </b>
                  </span>

                  <span>
                    Ejecutado:{" "}
                    <b className="text-gray-800">
                      {order.total_ejecutado.toFixed(2)}
                    </b>
                  </span>

                  <span className={getDiffStyle(order.diferencia)}>
                    Dif: <b>{order.diferencia.toFixed(2)}</b>
                  </span>

                </div>
              </div>

              {/* 📱 KPIs MÓVIL (COMPACTO) */}
              <div className="md:hidden text-[11px] text-gray-600 mt-2">
                E:{order.total_haber.toFixed(0)} |
                Ej:{order.total_ejecutado.toFixed(0)} |
                Dif:
                <span className={getDiffStyle(order.diferencia)}>
                  {order.diferencia.toFixed(0)}
                </span>
              </div>

            </div>

            {/* 📊 DETALLE (DRILL DOWN) */}
            {open.includes(order.no_orden) && (
              <div className="p-5 space-y-5 bg-gray-50">

                {order.beneficiarios.map(b => (
                  <div
                    key={b.id}
                    className="border-l-4 border-gray-200 pl-4"
                  >

                    <div className="text-sm font-semibold text-gray-800">
                      {b.nombre}
                      <span className="text-xs text-gray-400 ml-2">
                        ID: {b.id}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 mt-1">
                      Egreso bancario:{" "}
                      <span className="text-[#003331] font-medium">
                        {b.haber.toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1">

                      {b.ejecuciones.map(e => (
                        <div
                          key={e.id}
                          className="flex justify-between text-xs text-gray-600 pl-2 border-l border-gray-200"
                        >
                          <span className="truncate">
                            {e.codigo_presupuestario}
                          </span>

                          <span className="font-medium text-[#003331]">
                            {e.monto_ejecutado.toFixed(2)}
                          </span>
                        </div>
                      ))}

                    </div>

                  </div>
                ))}

              </div>
            )}

          </div>
        ))}

      </div>

    </div>
  );
}