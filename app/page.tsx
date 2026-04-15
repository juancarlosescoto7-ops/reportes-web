import ResumenPresupuesto from "@/components/ResumenPresupuesto";
import ResumenPorGrupoCard from "@/components/ResumenPorGrupoCard";

export default function Home() {
  return (
    <div className="p-10 space-y-6">

      {/* NUEVO MÓDULO CENTRAL (RPC principal) */}
      <ResumenPorGrupoCard />

      {/* MÓDULO EXISTENTE */}
      <ResumenPresupuesto />

    </div>
  );
}