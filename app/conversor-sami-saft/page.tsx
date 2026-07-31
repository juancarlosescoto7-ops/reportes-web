"use client";

import { FileSpreadsheet, ShieldAlert } from "lucide-react";

import ConversorSamiSaft from "@/components/arqueos/ConversorSamiSaft";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import { puedeGestionarArqueos } from "@/lib/acceso-arqueos";

export default function ConversorSamiSaftPage() {
  const { cargandoPermisos, permisos, rolCodigo } = usePermisosSistema();

  if (cargandoPermisos) {
    return (
      <div
        className="flex min-h-56 items-center justify-center border border-slate-200 bg-white text-sm text-slate-500"
        role="status"
      >
        Verificando acceso al conversor SAFT–SAMI...
      </div>
    );
  }

  if (!puedeGestionarArqueos(permisos, rolCodigo)) {
    return (
      <section className="mx-auto max-w-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <ShieldAlert className="h-8 w-8" />
        <h1 className="mt-4 text-xl font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm leading-6">
          El conversor está disponible para Tesorería, Presupuesto y
          Administración.
        </p>
      </section>
    );
  }

  return (
    <div className="-mt-2 space-y-4">
      <header className="flex items-center gap-3 border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <span className="grid h-10 w-10 place-items-center bg-[#003331] text-white">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Herramienta de conversión
          </div>
          <h1 className="text-xl font-semibold text-slate-950">
            Conversor SAFT–SAMI
          </h1>
        </div>
      </header>

      <ConversorSamiSaft />
    </div>
  );
}
