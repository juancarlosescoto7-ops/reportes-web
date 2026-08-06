import { obtenerPresupuestoServidor } from "@/services/presupuesto.server";
import PresupuestoExplorer from "@/components/PresupuestoExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Page() {
  const data = await obtenerPresupuestoServidor();

  return (
    <div className="space-y-5">
      <PresupuestoExplorer data={data ?? []} />
    </div>
  );
}
