import CXPDashboard from "@/components/CXPDashboard";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    cxp?: string | string[];
    accion?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const cxp = Array.isArray(params.cxp) ? params.cxp[0] : params.cxp;
  const accion = Array.isArray(params.accion)
    ? params.accion[0]
    : params.accion;

  return (
    <CXPDashboard
      focusCxp={cxp ?? null}
      openNewCxp={accion === "nueva-cxp"}
    />
  );
}
