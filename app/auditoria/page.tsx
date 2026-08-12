import { redirect } from "next/navigation";

import AuditoriaEgresos from "@/components/AuditoriaEgresos";
import { obtenerReporteAuditoriaServidor } from "@/services/auditoria.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AuditoriaPage() {
  const reporte = await obtenerReporteAuditoriaServidor();

  if (!reporte.autorizado) {
    redirect("/sin-acceso");
  }

  return <AuditoriaEgresos egresos={reporte.egresos} />;
}
