import { obtenerPresupuestoServidor } from "@/modules/presupuesto/services/presupuesto.server";
import PresupuestoExplorer from "@/modules/presupuesto/components/PresupuestoExplorer";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    buscar?: string | string[];
    accion?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const buscar = Array.isArray(params.buscar)
    ? params.buscar[0] ?? ""
    : params.buscar ?? "";
  const accion = Array.isArray(params.accion)
    ? params.accion[0]
    : params.accion;
  const data = await obtenerPresupuestoServidor();

  return (
    <div className="space-y-5">
      <PresupuestoExplorer
        key={buscar || "presupuesto"}
        data={data ?? []}
        initialSearch={buscar}
        initialModification={
          accion === "ampliar" && buscar
            ? { codigo: buscar, nombre: buscar, tipo: "ampliacion" }
            : null
        }
      />
    </div>
  );
}
