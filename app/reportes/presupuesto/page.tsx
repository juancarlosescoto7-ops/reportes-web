import { obtenerPresupuesto } from "@/services/presupuesto";
import PresupuestoExplorer from "@/components/PresupuestoExplorer";

export default async function Page() {
  const data = await obtenerPresupuesto();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4">
        Reporte Presupuestario
      </h1>

      <PresupuestoExplorer data={data} />
    </div>
  );
}