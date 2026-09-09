"use client";

import { useCallback, useState } from "react";
import CxpDashboard from "@/modules/cuentas-por-pagar/components/CXPDashboard";
import EgresosReport from "@/modules/ordenes-pago/components/EgresosReport";

export default function PantallaCompartidaReportes() {
  const [egresosRefreshKey, setEgresosRefreshKey] = useState(0);
  const [cxpRefreshKey, setCxpRefreshKey] = useState(0);

  const refrescarEgresos = useCallback(
    (contexto?: { noOrden?: number | string | null }) => {
      if (contexto?.noOrden) {
        // El aviso de registro actualiza Egresos también en otras pestañas.
        return;
      }

      setEgresosRefreshKey((current) => current + 1);
    },
    []
  );

  const refrescarCxp = useCallback(() => {
    setCxpRefreshKey((current) => current + 1);
  }, []);

  return (
    <div className="grid h-full min-h-[760px] grid-cols-1 grid-rows-2 gap-3 bg-[#eef1f5] xl:grid-cols-2 xl:grid-rows-1">
      <section className="min-h-0 overflow-hidden border border-slate-300 bg-white shadow-sm">
        <EgresosReport
          refreshKey={egresosRefreshKey}
          sharedView
          onDataChange={refrescarCxp}
        />
      </section>

      <section className="min-h-0 overflow-hidden border border-slate-300 bg-white shadow-sm">
        <CxpDashboard
          containerClassName="h-full"
          refreshKey={cxpRefreshKey}
          sharedView
          onDataChange={refrescarEgresos}
        />
      </section>
    </div>
  );
}
