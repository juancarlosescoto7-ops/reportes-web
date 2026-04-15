import { obtenerEgresosConEjecucion } from "@/services/ordenes";
import TarjetasOrdenes from "@/components/reportes/TarjetasOrdenes";

export default async function Page() {

  // 🔹 Aquí se consumen los datos
  const data = await obtenerEgresosConEjecucion();

  return (
    <div className="p-8">

      <h1 className="text-2xl font-semibold mb-6">
        Reporte de Órdenes de Pago
      </h1>

      <TarjetasOrdenes data={data} />

    </div>
  );
}