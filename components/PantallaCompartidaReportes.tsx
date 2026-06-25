"use client";

import CxpDashboard from "@/components/CXPDashboard";
import EgresosReport from "@/components/reportes/EgresosReport";

export default function PantallaCompartidaReportes() {
  return (
    <div className="grid h-full min-h-[760px] grid-cols-1 grid-rows-2 gap-3 bg-[#eef1f5] xl:grid-cols-2 xl:grid-rows-1">
      <section className="min-h-0 overflow-hidden border border-slate-300 bg-white shadow-sm">
        <EgresosReport sharedView />
      </section>

      <section className="min-h-0 overflow-hidden border border-slate-300 bg-white shadow-sm">
        <CxpDashboard containerClassName="h-full" sharedView />
      </section>
    </div>
  );
}
