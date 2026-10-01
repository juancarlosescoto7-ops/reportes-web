import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import InformesMensualesAuditoria from "@/modules/informes-auditoria/components/InformesMensualesAuditoria";
import { obtenerMesesInformesServidor } from "@/modules/informes-auditoria/services/informes.server";

export default async function InformesAuditoriaPage() {
  const resultado = await obtenerMesesInformesServidor();
  if (!resultado.autorizado) redirect("/sin-acceso");

  return (
    <div className="mx-auto grid min-h-full w-full max-w-[1400px] content-start gap-3 p-1 text-slate-800">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#003331] text-white">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Informes institucionales</div>
            <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-slate-950">Informes de auditoría</h1>
            <p className="mt-1 text-[12px] text-slate-500">Consulte, genere y descargue el informe completo del mes seleccionado.</p>
          </div>
        </div>
        <Link href="/auditoria" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-[#005f48]/50 hover:text-[#005f48]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Órdenes y recomendaciones
        </Link>
      </header>
      <InformesMensualesAuditoria meses={resultado.meses} />
    </div>
  );
}
