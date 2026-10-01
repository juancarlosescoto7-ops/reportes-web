"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type BorradoresAuditoria } from "@/modules/auditoria/services/borradores-auditoria";

export default function EstadoRecomendacionesAuditoria({ borradores }: {
  borradores: BorradoresAuditoria;
}) {
  const estado = useSyncExternalStore(
    borradores.suscribirResumen,
    borradores.obtenerResumen,
    borradores.obtenerResumenInicial
  );
  const tienePendientes = estado.totalPendientes > 0;

  useEffect(() => {
    if (!tienePendientes) return;
    function avisarCambios(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarCambios);
    return () => window.removeEventListener("beforeunload", avisarCambios);
  }, [tienePendientes]);

  return <>
    {tienePendientes && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
      Hay {estado.totalPendientes} orden(es) con recomendaciones sin guardar, incluidas las ocultas por los filtros. Sus borradores se conservan al cambiar los filtros de esta página.
    </p>}
  </>;
}
