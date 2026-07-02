"use client";

import { useCallback, useState } from "react";
import CxpDashboard from "@/components/CXPDashboard";
import EgresosReport from "@/components/reportes/EgresosReport";

export default function PantallaCompartidaReportes() {
  const [egresosRefreshKey, setEgresosRefreshKey] = useState(0);
  const [cxpRefreshKey, setCxpRefreshKey] = useState(0);
  const [ordenRecienRegistrada, setOrdenRecienRegistrada] = useState<
    string | null
  >(null);

  const refrescarEgresos = useCallback(
    (contexto?: { noOrden?: number | string | null }) => {
      if (contexto?.noOrden) {
        setOrdenRecienRegistrada(String(contexto.noOrden));
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
          focusOrder={ordenRecienRegistrada}
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
