import { obtenerPresupuesto } from "@/services/presupuesto";
import PresupuestoExplorer from "@/components/PresupuestoExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Page() {
  const data = await obtenerPresupuesto();

  console.log("REGISTROS PRESUPUESTO:", data?.length);
  console.log("PRIMER REGISTRO PRESUPUESTO:", data?.[0]);

  return (
    <div className="space-y-5">
      <PresupuestoExplorer data={data ?? []} />
    </div>
  );
}
