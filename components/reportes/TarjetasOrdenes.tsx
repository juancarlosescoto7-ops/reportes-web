"use client";

type Registro = {
  no_orden: string;
  fecha: string;
  descripcion: string;
  haber: string;
  monto_ejecutado: string;
  diferencia: string;
  tipo_fila: string;
};

type Orden = {
  no_orden: string;
  fecha: string;
  descripcion: string;
  total: number;
  ejecutado: number;
  diferencia: number;
};

export default function TarjetasOrdenes({ data }: { data: Registro[] }) {

  const map = new Map<string, Orden>();

  data.forEach((item) => {
    if (!map.has(item.no_orden)) {
      map.set(item.no_orden, {
        no_orden: item.no_orden,
        fecha: item.fecha,
        descripcion: item.descripcion,
        total: 0,
        ejecutado: 0,
        diferencia: 0,
      });
    }

    const orden = map.get(item.no_orden)!;

    if (item.tipo_fila === "TOTAL") {
      orden.total = Number(item.haber || 0);
      orden.ejecutado = Number(item.monto_ejecutado || 0);
      orden.diferencia = Number(item.diferencia || 0);
    }
  });

  const ordenes = Array.from(map.values());

  return (
    <div className="flex flex-col gap-4">

      {ordenes.map((orden) => {

        const estado = orden.diferencia === 0 ? "ok" : "alert";

        return (
          <div
            key={orden.no_orden}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer w-full"
          >

            {/* HEADER */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800 tracking-tight">
                  Orden {orden.no_orden}
                </h2>
                <p className="text-xs text-gray-400">
                  {orden.fecha}
                </p>
              </div>

              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  estado === "ok"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {estado === "ok" ? "Balanceado" : "Pendiente"}
              </span>
            </div>

            {/* DESCRIPCIÓN */}
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">
              {orden.descripcion}
            </p>

            {/* KPIs */}
            <div className="space-y-3 text-sm">

              <div className="flex justify-between">
                <span className="text-gray-500">Total asignado</span>
                <span className="font-medium text-gray-800">
                  L {orden.total.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Ejecutado</span>
                <span className="font-medium text-gray-800">
                  L {orden.ejecutado.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-600 font-medium">Diferencia</span>
                <span
                  className={`font-semibold ${
                    orden.diferencia === 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  L {orden.diferencia.toLocaleString()}
                </span>
              </div>

            </div>
          </div>
        );
      })}

    </div>
  );
}