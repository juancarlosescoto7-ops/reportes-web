import EgresosReport from "@/components/reportes/EgresosReport";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    orden?: string | string[];
    documentos?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const orden = obtenerParametro(params.orden);
  const documentos = obtenerParametro(params.documentos);

  return (
    <EgresosReport
      focusOrder={orden}
      focusDocuments={Boolean(orden && documentos === orden)}
    />
  );
}

function obtenerParametro(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}
