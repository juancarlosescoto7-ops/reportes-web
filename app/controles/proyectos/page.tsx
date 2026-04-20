import DocumentacionProyectos from "@/components/DocumentacionProyectos";

export default function Home() {
  return (
    <div className="p-6 space-y-6">

      {/* TÍTULO DEL MÓDULO */}
      <div>
        <h1 className="text-xl font-semibold text-[#003331]">
          Sistema de Control Institucional
        </h1>

        <p className="text-xs text-gray-500">
          Gestión de documentación por proyecto
        </p>
      </div>

      {/* COMPONENTE PRINCIPAL */}
      <DocumentacionProyectos />

    </div>
  );
}