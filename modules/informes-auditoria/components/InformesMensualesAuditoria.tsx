"use client";

import { useState } from "react";
import { tituloMesAuditoria, type MesInformeAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";
import ResumenMensualAuditoria from "@/modules/informes-auditoria/components/ResumenMensualAuditoria";

export default function InformesMensualesAuditoria({ meses }: {
  meses: MesInformeAuditoria[];
}) {
  const [mes, setMes] = useState(() => meses.find((periodo) => periodo.tiene_informe)?.mes ?? meses[0]?.mes ?? "");
  const [generando, setGenerando] = useState(false);
  const [generados, setGenerados] = useState<string[]>([]);

  return (
    <section className="glass-panel overflow-hidden" aria-labelledby="titulo-informes-auditoria">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <h2 id="titulo-informes-auditoria" className="text-[14px] font-semibold text-slate-950">Informe mensual de recomendaciones</h2>
          <p className="mt-1 text-[12px] text-slate-500">Recomendaciones por orden y síntesis del auditor dirigida a la Corporación Municipal y al Alcalde Municipal.</p>
        </div>
        <label className="grid gap-1 text-[12px] text-slate-700">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mes del informe</span>
          <select value={mes} onChange={(event) => setMes(event.target.value)} disabled={generando || !meses.length}
            className="h-10 min-w-[240px] max-w-full rounded-md border border-slate-300 bg-white px-3 text-[12px] outline-none focus:border-[#005f48] disabled:opacity-50">
            {!meses.length && <option value="">Sin meses disponibles</option>}
            {meses.map((periodo) => <option key={periodo.mes} value={periodo.mes}>
              {tituloMesAuditoria(periodo.mes)}{periodo.tiene_informe || generados.includes(periodo.mes) ? " · Informe generado" : " · Sin generar"}
            </option>)}
          </select>
        </label>
      </div>
      {mes ? <ResumenMensualAuditoria key={mes}
        mes={mes} titulo={tituloMesAuditoria(mes)}
        onGenerando={setGenerando}
        onGenerado={() => setGenerados((actuales) => actuales.includes(mes) ? actuales : [...actuales, mes])}
      /> : <p className="p-4 text-[12px] text-slate-500">Los meses aparecerán cuando existan órdenes con fecha o informes guardados.</p>}
    </section>
  );
}
