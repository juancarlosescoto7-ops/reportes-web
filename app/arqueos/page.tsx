"use client";

import { Landmark, ShieldAlert } from "lucide-react";

import AsistenteArqueo from "@/components/arqueos/AsistenteArqueo";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import { puedeGestionarArqueos } from "@/lib/acceso-arqueos";

export default function ArqueosPage() {
  const { cargandoPermisos, permisos, rolCodigo } = usePermisosSistema();

  if (cargandoPermisos) {
    return (
      <div
        className="flex min-h-56 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500"
        role="status"
      >
        Verificando acceso al módulo de arqueos...
      </div>
    );
  }

  if (!puedeGestionarArqueos(permisos, rolCodigo)) {
    return (
      <section className="mx-auto max-w-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <ShieldAlert className="h-8 w-8" />
        <h1 className="mt-4 text-xl font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm leading-6">
          Arqueos está disponible para Tesorería, Presupuesto y
          Administración.
        </p>
      </section>
    );
  }

  return (
    <div className="-mt-2 space-y-4">
      <header className="flex items-center gap-3 border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <span className="grid h-10 w-10 place-items-center bg-[#003331] text-white">
          <Landmark className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Módulo de arqueos
          </div>
          <h1 className="text-xl font-semibold text-slate-950">
            Arqueos de ingresos
          </h1>
        </div>
      </header>

      <AsistenteArqueo />
    </div>
  );
}
