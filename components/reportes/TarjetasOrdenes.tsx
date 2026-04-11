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

  // 🔹 Agrupar por orden
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

      {ordenes.map((orden) => (
        <div
          key={orden.no_orden}
          className="bg-white border rounded-xl p-5 shadow hover:shadow-lg cursor-pointer transition"
        >
          <h2 className="text-lg font-semibold">
            Orden #{orden.no_orden}
          </h2>

          <p className="text-sm text-gray-500 mb-2">
            {orden.fecha}
          </p>

          <p className="text-sm text-gray-600 mb-4">
            {orden.descripcion}
          </p>

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total</span>
              <span>L {orden.total.toLocaleString()}</span>
            </div>

            <div className="flex justify-between">
              <span>Ejecutado</span>
              <span>L {orden.ejecutado.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-semibold">
              <span>Diferencia</span>
              <span>L {orden.diferencia.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}