import { redirect } from "next/navigation";

import ReporteOficinaMujer from "@/components/ReporteOficinaMujer";
import { obtenerReporteOficinaMujerServidor } from "@/services/oficinaMujer.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OficinaMujerPage() {
  const resultado = await obtenerReporteOficinaMujerServidor();

  if (!resultado.autorizado || !resultado.reporte) {
    redirect("/sin-acceso");
  }

  return <ReporteOficinaMujer reporte={resultado.reporte} />;
}
