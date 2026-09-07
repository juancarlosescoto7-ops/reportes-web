import { redirect } from "next/navigation";

import ReporteOficinaMujer from "@/modules/oficina-mujer/components/ReporteOficinaMujer";
import { obtenerReporteOficinaMujerServidor } from "@/modules/oficina-mujer/services/oficinaMujer.server";

export default async function OficinaMujerPage() {
  const resultado = await obtenerReporteOficinaMujerServidor();

  if (!resultado.autorizado || !resultado.reporte) {
    redirect("/sin-acceso");
  }

  return <ReporteOficinaMujer reporte={resultado.reporte} />;
}
