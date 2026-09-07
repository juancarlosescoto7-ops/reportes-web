import { redirect } from "next/navigation";

import AuditoriaEgresos from "@/modules/auditoria/components/AuditoriaEgresos";
import { obtenerReporteAuditoriaServidor } from "@/modules/auditoria/services/auditoria.server";

export default async function AuditoriaPage() {
  const reporte = await obtenerReporteAuditoriaServidor();

  if (!reporte.autorizado) {
    redirect("/sin-acceso");
  }

  return <AuditoriaEgresos egresos={reporte.egresos} />;
}
