"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import FormIngresos from "@/components/FormIngresos";
import IngresosReport from "@/components/reportes/IngresosReport";

export default function Page() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);

  function cerrarModal() {
    setModalAbierto(false);
  }

  function registrarGuardado() {
    setRefreshKey((value) => value + 1);
    setModalAbierto(false);
  }

  return (
    <div className="-mt-2 space-y-4">
      <IngresosReport
        refreshKey={refreshKey}
        accionesPrincipales={
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-600/80 bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo ingreso
          </button>
        }
      />

      {modalAbierto && (
        <div className="fixed inset-0 z-[90] bg-slate-950/45 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={cerrarModal}
                className="inline-flex h-10 w-10 items-center justify-center border border-white/20 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto">
              <FormIngresos onGuardado={registrarGuardado} onClose={cerrarModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
