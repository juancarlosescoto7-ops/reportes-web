import CXPDashboard from "@/modules/cuentas-por-pagar/components/CXPDashboard";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    cxp?: string | string[];
    tipo?: string | string[];
    accion?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const cxp = Array.isArray(params.cxp) ? params.cxp[0] : params.cxp;
  const accion = Array.isArray(params.accion)
    ? params.accion[0]
    : params.accion;
  const tipo = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;

  return (
    <CXPDashboard
      focusCxp={cxp ?? null}
      focusCxpTipo={tipo ?? null}
      openCxpAction={
        accion === "comprometer" || accion === "documentos" ? accion : null
      }
      openNewCxp={accion === "nueva-cxp"}
    />
  );
}
