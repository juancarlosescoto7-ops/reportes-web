"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerPresupuesto } from "@/services/presupuesto";
import { buildHierarchy } from "@/lib/buildHierarchy";
import SelectorPresupuestoTree, {
  CodigoPresupuestarioSeleccionado,
} from "@/components/SelectorPresupuestoTree";
import { insertarEjecucionPresupuestaria } from "@/services/ejecucionesPresupuestarias";

type EjecutarOrdenPagoModalProps = {
  open: boolean;
  ordenPagoId: number | null;
  ordenLabel?: string | null;
  montoPendiente?: number;
  onClose: () => void;
  onInsertado: () => void;
};

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getAdvertenciaPresupuestaria(
  saldo: number,
  monto: number,
  codigoSeleccionado: boolean
) {
  if (!codigoSeleccionado) return null;

  if (saldo <= 0) {
    return "El código presupuestario seleccionado no tiene saldo disponible. La ejecución será registrada, pero quedará como ejecución sin disponibilidad presupuestaria suficiente.";
  }

  if (monto > saldo) {
    return `El monto a ejecutar supera el saldo disponible del código seleccionado. Saldo disponible: ${formatMoney(
      saldo
    )}.`;
  }

  return null;
}

export default function EjecutarOrdenPagoModal({
  open,
  ordenPagoId,
  ordenLabel,
  montoPendiente = 0,
  onClose,
  onInsertado,
}: EjecutarOrdenPagoModalProps) {
  const [presupuesto, setPresupuesto] = useState<any[]>([]);
  const [codigo, setCodigo] =
    useState<CodigoPresupuestarioSeleccionado | null>(null);

  const [monto, setMonto] = useState("");
  const [fechaEjecucion, setFechaEjecucion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => {
    return buildHierarchy(presupuesto);
  }, [presupuesto]);

  const montoActual = Number(monto);

  const advertenciaPresupuestaria = getAdvertenciaPresupuestaria(
    codigo?.saldo ?? 0,
    Number.isFinite(montoActual) ? montoActual : 0,
    Boolean(codigo)
  );

  useEffect(() => {
    if (!open) return;

    cargarPresupuesto();

    setCodigo(null);
    setMonto(montoPendiente > 0 ? montoPendiente.toFixed(2) : "");
    setFechaEjecucion(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [open, montoPendiente]);

  async function cargarPresupuesto() {
    try {
      setCargandoPresupuesto(true);

      const data = await obtenerPresupuesto();

      setPresupuesto(data);
    } catch (err: any) {
      setError(
        err?.message || "No se pudo cargar el presupuesto disponible."
      );
    } finally {
      setCargandoPresupuesto(false);
    }
  }

  async function guardar() {
    setError(null);

    if (!ordenPagoId) {
      setError("No se recibió la orden de pago.");
      return;
    }

    if (!codigo) {
      setError("Debe seleccionar un código presupuestario.");
      return;
    }

    const montoNumerico = Number(monto);

    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setError("Debe ingresar un monto válido mayor que cero.");
      return;
    }

    try {
      setGuardando(true);

      await insertarEjecucionPresupuestaria({
        orden_pago_id: ordenPagoId,
        codigo_presupuestario: codigo.codigo_presupuestario,
        actividad_id: codigo.actividad_id,
        proyecto_id: codigo.proyecto_id,
        monto_ejecutado: montoNumerico,
        fecha_ejecucion: fechaEjecucion || null,
        ejercicio_fiscal:
          codigo.ejercicio_fiscal ?? new Date().getFullYear(),
        usuario_registro: "sistema",
      });

      onInsertado();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          "No se pudo insertar la ejecución presupuestaria."
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-[2px]">
      <div className="absolute inset-4 grid grid-rows-[auto_1fr_auto] border border-slate-300 bg-[#eef1f5] shadow-2xl">
        {/* HEADER */}
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-white/75 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Acción presupuestaria
            </div>

            <div className="mt-0.5 text-[15px] font-semibold text-slate-950">
              Registrar ejecución de orden de pago
            </div>

            <div className="mt-0.5 text-[12px] text-slate-500">
              Orden:{" "}
              <span className="font-semibold text-slate-800">
                {ordenLabel ?? ordenPagoId ?? "—"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 border border-slate-300 bg-white px-3 text-[12px] text-slate-700 hover:border-slate-700"
          >
            Cerrar
          </button>
        </div>

        {/* BODY */}
        <div className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_330px]">
          <div className="min-h-0">
            {cargandoPresupuesto ? (
              <div className="flex h-full items-center justify-center border border-slate-300 bg-white/65 text-[12px] text-slate-500 backdrop-blur-xl">
                Cargando presupuesto...
              </div>
            ) : (
              <SelectorPresupuestoTree
                tree={tree}
                seleccionado={codigo?.codigo_presupuestario ?? null}
                onSelect={setCodigo}
              />
            )}
          </div>

          {/* PANEL DE REGISTRO */}
          <aside className="min-h-0 border border-slate-300 bg-white/70 backdrop-blur-xl">
            <div className="border-b border-slate-300 bg-white/75 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Registro
              </div>

              <div className="text-[13px] font-semibold text-slate-950">
                Datos de ejecución
              </div>
            </div>

            <div className="space-y-3 p-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Código seleccionado
                </label>

                <div className="min-h-[68px] border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                  {codigo ? (
                    <>
                      <div className="font-semibold text-slate-950">
                        {codigo.codigo_presupuestario}
                      </div>

                      <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                        {codigo.nombre}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        Saldo disponible:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatMoney(codigo.saldo)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">
                      Seleccione un código presupuestario.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Monto a ejecutar
                </label>

                <input
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-[#00be87]"
                  placeholder="0.00"
                />

                {montoPendiente > 0 && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Pendiente sugerido: {formatMoney(montoPendiente)}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fecha de ejecución
                </label>

                <input
                  value={fechaEjecucion}
                  onChange={(e) => setFechaEjecucion(e.target.value)}
                  type="date"
                  className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-[#00be87]"
                />
              </div>

              {advertenciaPresupuestaria && (
                <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                  {advertenciaPresupuestaria}
                </div>
              )}

              {error && (
                <div className="border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {error}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-300 bg-white/75 px-4 py-3 backdrop-blur-xl">
          <div className="text-[11px] text-slate-500">
            La ejecución será registrada en{" "}
            <span className="font-semibold text-slate-700">
              ejecuciones_presupuestarias
            </span>
            .
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-8 border border-slate-300 bg-white px-4 text-[12px] text-slate-700 hover:border-slate-700"
            >
              Cancelar
            </button>

            <button
              onClick={guardar}
              disabled={guardando}
              className="h-8 border border-[#00be87] bg-[#00be87] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Insertar ejecución"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}