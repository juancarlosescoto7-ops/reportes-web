"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import EditarIngresoModal from "@/components/EditarIngresoModal";
import FormIngresos from "@/components/FormIngresos";
import IngresosReport from "@/components/reportes/IngresosReport";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import type { IngresoReporte } from "@/services/ingresos.service";

export default function Page() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ingresoEditando, setIngresoEditando] =
    useState<IngresoReporte | null>(null);
  const [mensajeCorreccion, setMensajeCorreccion] = useState("");
  const { permisos } = usePermisosSistema();
  const puedeCorregirIngresos = permisos.includes("VER_INGRESOS");

  function cerrarModal() {
    setModalAbierto(false);
  }

  function registrarGuardado() {
    setRefreshKey((value) => value + 1);
    setModalAbierto(false);
  }

  function registrarCorreccion() {
    setRefreshKey((value) => value + 1);
    setIngresoEditando(null);
    setMensajeCorreccion(
      "El depósito fue corregido y el reporte se actualizó."
    );
  }

  function abrirCorreccion(ingreso: IngresoReporte) {
    setMensajeCorreccion("");
    setIngresoEditando(ingreso);
  }

  return (
    <div className="-mt-2 space-y-4">
      {mensajeCorreccion && (
        <div
          className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {mensajeCorreccion}
        </div>
      )}

      <IngresosReport
        refreshKey={refreshKey}
        onEditarIngreso={
          puedeCorregirIngresos ? abrirCorreccion : undefined
        }
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

      {ingresoEditando && (
        <EditarIngresoModal
          key={String(ingresoEditando.id_deposito)}
          ingreso={ingresoEditando}
          onGuardado={registrarCorreccion}
          onClose={() => setIngresoEditando(null)}
        />
      )}
    </div>
  );
}
