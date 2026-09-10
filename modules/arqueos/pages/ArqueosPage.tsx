"use client";

import { Landmark, Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";

import AsistenteArqueo from "@/modules/arqueos/components/AsistenteArqueo";
import { usePermisosSistema } from "@/modules/autenticacion/hooks/usePermisosSistema";
import { puedeGestionarArqueos } from "@/modules/arqueos/domain/acceso-arqueos";

export default function ArqueosPage() {
  const [formularioOpen, setFormularioOpen] = useState(false);
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
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
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
        </div>
        <button data-shortcut="020" type="button" onClick={() => setFormularioOpen((actual) => !actual)} aria-expanded={formularioOpen} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#003331] px-4 text-xs font-semibold text-white hover:bg-emerald-900">
          <Plus className="h-4 w-4" />
          {formularioOpen ? "Cerrar formulario" : "Nuevo arqueo"}
        </button>
      </header>

      {formularioOpen ? (
        <AsistenteArqueo onGuardado={() => setFormularioOpen(false)} />
      ) : (
        <section className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/75 p-8 text-center">
          <div className="max-w-md">
            <Landmark className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-4 text-base font-semibold text-slate-800">Gestión de arqueos</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Inicie un nuevo arqueo cuando necesite registrar depósitos e ingresos. El formulario permanecerá oculto mientras no esté en uso.</p>
          </div>
        </section>
      )}
    </div>
  );
}
