import ResumenPresupuesto from "@/components/ResumenPresupuesto";
import ResumenPorGrupoCard from "@/components/ResumenPorGrupoCard";
import BandejaDocumentosFaltantesOrdenes from "@/components/BandejaDocumentosFaltantesOrdenes";

export default function Home() {
  return (
    <div className="p-10 space-y-6">

      {/* NUEVO MÓDULO CENTRAL (RPC principal) */}
      <ResumenPorGrupoCard />

      {/* MÓDULO EXISTENTE */}
      <ResumenPresupuesto />

      <div className="max-w-[520px]">
      <BandejaDocumentosFaltantesOrdenes />
      </div>

    </div>
  )
}