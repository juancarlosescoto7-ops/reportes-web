import DocumentacionProyectos from "@/components/DocumentacionProyectos";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string | string[] }>;
}) {
  const params = await searchParams;
  const accion = Array.isArray(params.accion)
    ? params.accion[0]
    : params.accion;

  return (
    <div className="h-full min-h-0">
      <DocumentacionProyectos openNewProject={accion === "nuevo-proyecto"} />
    </div>
  );
}
