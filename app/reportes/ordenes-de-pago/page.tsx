import EgresosReport from "@/components/reportes/EgresosReport";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    orden?: string | string[];
    documentos?: string | string[];
    accion?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const orden = obtenerParametro(params.orden);
  const documentos = obtenerParametro(params.documentos);
  const accion = obtenerParametro(params.accion);

  return (
    <EgresosReport
      focusOrder={orden}
      focusDocuments={Boolean(orden && documentos === orden)}
      openNewEgreso={accion === "nuevo-egreso"}
    />
  );
}

function obtenerParametro(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}
