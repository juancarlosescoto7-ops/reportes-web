import DocumentacionProyectos from "@/modules/proyectos/components/DocumentacionProyectos";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    accion?: string | string[];
    proyecto?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const accion = Array.isArray(params.accion)
    ? params.accion[0]
    : params.accion;
  const proyecto = Array.isArray(params.proyecto)
    ? params.proyecto[0]
    : params.proyecto;

  return (
    <div className="h-full min-h-0">
      <DocumentacionProyectos
        focusProject={proyecto ?? null}
        openNewProject={accion === "nuevo-proyecto"}
      />
    </div>
  );
}
