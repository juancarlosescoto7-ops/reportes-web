"use client";

import { useState } from "react";
import EditarIngresoModal from "@/components/EditarIngresoModal";
import IngresosReport from "@/components/reportes/IngresosReport";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import type { IngresoReporte } from "@/services/ingresos.service";

export default function Page() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [ingresoEditando, setIngresoEditando] =
    useState<IngresoReporte | null>(null);
  const [mensajeCorreccion, setMensajeCorreccion] = useState("");
  const { permisos } = usePermisosSistema();
  const puedeCorregirIngresos = permisos.includes("VER_INGRESOS");

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
      />

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
