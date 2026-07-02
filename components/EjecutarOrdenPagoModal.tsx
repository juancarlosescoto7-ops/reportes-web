"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerPresupuesto } from "@/services/presupuesto";
import { buildHierarchy } from "@/lib/buildHierarchy";
import SelectorPresupuestoTree, {
  CodigoPresupuestarioSeleccionado,
} from "@/components/SelectorPresupuestoTree";
import {
  actualizarAsignacionEjecucionOrden,
  insertarEjecucionPresupuestaria,
  obtenerAsignacionesEjecucionOrden,
  type AsignacionEjecucionPresupuestaria,
} from "@/services/ejecucionesPresupuestarias";

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

function totalAsignaciones(asignaciones: AsignacionEjecucionPresupuestaria[]) {
  return asignaciones.reduce(
    (acc, item) => acc + Number(item.monto_ejecutado || 0),
    0
  );
}

function getAdvertenciaPresupuestaria(
  saldo: number,
  monto: number,
  codigoSeleccionado: boolean
) {
  if (!codigoSeleccionado) return null;

  if (saldo <= 0) {
    return "El codigo presupuestario seleccionado no tiene saldo disponible.";
  }

  if (monto > saldo) {
    return `El monto supera el saldo disponible del codigo seleccionado: ${formatMoney(
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
  const [presupuesto, setPresupuesto] = useState<Record<string, unknown>[]>([]);
  const [codigo, setCodigo] =
    useState<CodigoPresupuestarioSeleccionado | null>(null);
  const [monto, setMonto] = useState("");
  const [fechaEjecucion, setFechaEjecucion] = useState("");
  const [asignaciones, setAsignaciones] = useState<
    AsignacionEjecucionPresupuestaria[]
  >([]);
  const [indiceEditando, setIndiceEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [cargandoAsignaciones, setCargandoAsignaciones] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildHierarchy(presupuesto), [presupuesto]);
  const montoActual = Number(monto);
  const totalAsignado = totalAsignaciones(asignaciones);
  const asignacionEditando =
    indiceEditando === null ? null : asignaciones[indiceEditando] ?? null;

  const advertenciaPresupuestaria = getAdvertenciaPresupuestaria(
    codigo?.saldo ?? 0,
    Number.isFinite(montoActual) ? montoActual : 0,
    Boolean(codigo)
  );

  useEffect(() => {
    if (!open) return;

    void cargarPresupuesto();
    setCodigo(null);
    setMonto(montoPendiente > 0 ? montoPendiente.toFixed(2) : "");
    setFechaEjecucion(new Date().toISOString().slice(0, 10));
    setAsignaciones([]);
    setIndiceEditando(null);
    setError(null);

    if (ordenPagoId) {
      void cargarAsignaciones(ordenPagoId);
    }
  }, [open, montoPendiente, ordenPagoId]);

  async function cargarPresupuesto() {
    try {
      setCargandoPresupuesto(true);
      setPresupuesto(await obtenerPresupuesto());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el presupuesto disponible."
      );
    } finally {
      setCargandoPresupuesto(false);
    }
  }

  async function cargarAsignaciones(idOrden: number) {
    try {
      setCargandoAsignaciones(true);
      const actuales = await obtenerAsignacionesEjecucionOrden(idOrden);

      setAsignaciones(
        actuales.map((item) => ({
          ...item,
          monto_ejecutado: Number(item.monto_ejecutado || 0),
        }))
      );

      const primeraFecha = actuales.find((item) => item.fecha_ejecucion)
        ?.fecha_ejecucion;

      if (primeraFecha) {
        setFechaEjecucion(String(primeraFecha).slice(0, 10));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las asignaciones."
      );
    } finally {
      setCargandoAsignaciones(false);
    }
  }

  function limpiarFormulario() {
    setCodigo(null);
    setMonto(montoPendiente > 0 ? montoPendiente.toFixed(2) : "");
    setIndiceEditando(null);
    setError(null);
  }

  function editarAsignacion(index: number) {
    const asignacion = asignaciones[index];

    if (!asignacion) return;

    setIndiceEditando(index);
    setCodigo(null);
    setMonto(String(Number(asignacion.monto_ejecutado || 0).toFixed(2)));
    setFechaEjecucion(
      asignacion.fecha_ejecucion
        ? String(asignacion.fecha_ejecucion).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setError(null);
  }

  function construirAsignacionFormulario() {
    const montoNumerico = Number(monto);

    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      throw new Error("Debe ingresar un monto valido mayor que cero.");
    }

    if (codigo) {
      return {
        codigo_presupuestario: codigo.codigo_presupuestario,
        actividad_id: codigo.actividad_id,
        proyecto_id: codigo.proyecto_id,
        monto_ejecutado: montoNumerico,
        fecha_ejecucion: fechaEjecucion || null,
        ejercicio_fiscal: codigo.ejercicio_fiscal ?? new Date().getFullYear(),
        usuario_registro: "sistema",
      };
    }

    if (asignacionEditando) {
      return {
        ...asignacionEditando,
        monto_ejecutado: montoNumerico,
        fecha_ejecucion:
          fechaEjecucion || asignacionEditando.fecha_ejecucion || null,
        usuario_registro: asignacionEditando.usuario_registro ?? "sistema",
      };
    }

    throw new Error("Debe seleccionar un codigo presupuestario.");
  }

  async function agregarAsignacion() {
    setError(null);

    if (!ordenPagoId) {
      setError("No se recibio la orden de pago.");
      return;
    }

    if (!codigo) {
      setError("Debe seleccionar un codigo presupuestario.");
      return;
    }

    try {
      setGuardando(true);
      const nueva = construirAsignacionFormulario();

      await insertarEjecucionPresupuestaria({
        orden_pago_id: ordenPagoId,
        codigo_presupuestario: nueva.codigo_presupuestario,
        actividad_id: nueva.actividad_id,
        proyecto_id: nueva.proyecto_id,
        monto_ejecutado: nueva.monto_ejecutado,
        fecha_ejecucion: nueva.fecha_ejecucion,
        ejercicio_fiscal: nueva.ejercicio_fiscal,
        usuario_registro: nueva.usuario_registro,
      });

      await cargarAsignaciones(ordenPagoId);
      limpiarFormulario();
      onInsertado();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo agregar la asignacion presupuestaria."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCambioSeleccionado() {
    setError(null);

    if (!ordenPagoId) {
      setError("No se recibio la orden de pago.");
      return;
    }

    if (!asignacionEditando?.id) {
      setError("Seleccione una ejecucion existente para modificar.");
      return;
    }

    try {
      setGuardando(true);
      const actualizada = construirAsignacionFormulario();

      await actualizarAsignacionEjecucionOrden({
        id: asignacionEditando.id,
        orden_pago_id: ordenPagoId,
        asignacion: actualizada,
      });

      await cargarAsignaciones(ordenPagoId);
      limpiarFormulario();
      onInsertado();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la asignacion seleccionada."
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-[2px]">
      <div className="absolute inset-4 grid grid-rows-[auto_1fr_auto] border border-slate-300 bg-[#eef1f5] shadow-2xl">
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-white/75 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Accion presupuestaria
            </div>

            <div className="mt-0.5 text-[15px] font-semibold text-slate-950">
              Asignar o cambiar ejecucion de orden de pago
            </div>

            <div className="mt-0.5 text-[12px] text-slate-500">
              Orden:{" "}
              <span className="font-semibold text-slate-800">
                {ordenLabel ?? ordenPagoId ?? "-"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 bg-white px-3 text-[12px] text-slate-700 hover:border-slate-700"
          >
            Cerrar
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_410px]">
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

          <aside className="min-h-0 overflow-auto border border-slate-300 bg-white/70 backdrop-blur-xl">
            <div className="border-b border-slate-300 bg-white/75 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Registro
              </div>

              <div className="text-[13px] font-semibold text-slate-950">
                Ejecuciones de la orden
              </div>
            </div>

            <div className="space-y-3 p-3">
              {cargandoAsignaciones && (
                <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                  Cargando ejecuciones actuales...
                </div>
              )}

              <div className="border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Ejecuciones existentes
                </div>

                <div className="max-h-[210px] overflow-auto">
                  {asignaciones.length > 0 ? (
                    asignaciones.map((item, index) => {
                      const active = indiceEditando === index;

                      return (
                        <div
                          key={`${item.id ?? item.codigo_presupuestario}-${index}`}
                          className={[
                            "grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0",
                            active ? "bg-[#e6f5ef]" : "bg-white",
                          ].join(" ")}
                        >
                          <div className="min-w-0">
                            <div className="break-words text-[11px] font-semibold text-slate-800">
                              {item.codigo_presupuestario}
                            </div>
                            <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-950">
                              {formatMoney(Number(item.monto_ejecutado || 0))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => editarAsignacion(index)}
                            className="h-7 border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55]"
                          >
                            Editar
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-5 text-center text-[12px] text-slate-400">
                      Sin ejecuciones presupuestarias.
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white px-3 py-2 text-right text-[12px] text-slate-500">
                  Total ejecutado:{" "}
                  <span className="font-semibold tabular-nums text-slate-950">
                    {formatMoney(totalAsignado)}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Codigo seleccionado
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
                    </>
                  ) : asignacionEditando ? (
                    <>
                      <div className="font-semibold text-slate-950">
                        {asignacionEditando.codigo_presupuestario}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Codigo actual. Seleccione otro codigo para cambiarlo.
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">
                      Seleccione un codigo presupuestario.
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
                  onChange={(event) => setMonto(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-[#00be87]"
                  placeholder="0.00"
                />

                {montoPendiente > 0 && indiceEditando === null && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Pendiente sugerido: {formatMoney(montoPendiente)}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fecha de ejecucion
                </label>

                <input
                  value={fechaEjecucion}
                  onChange={(event) => setFechaEjecucion(event.target.value)}
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

        <div className="flex items-center justify-between border-t border-slate-300 bg-white/75 px-4 py-3 backdrop-blur-xl">
          <div className="text-[11px] text-slate-500">
            {asignacionEditando
              ? "Se actualizara solo la ejecucion seleccionada."
              : "Seleccione codigo y monto para agregar una nueva ejecucion."}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={limpiarFormulario}
              className="h-8 border border-slate-300 bg-white px-4 text-[12px] text-slate-700 hover:border-slate-700"
            >
              Limpiar
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 border border-slate-300 bg-white px-4 text-[12px] text-slate-700 hover:border-slate-700"
            >
              Cerrar
            </button>

            {asignacionEditando ? (
              <button
                type="button"
                onClick={guardarCambioSeleccionado}
                disabled={guardando}
                className="h-8 border border-[#00be87] bg-[#00be87] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar cambio"}
              </button>
            ) : (
              <button
                type="button"
                onClick={agregarAsignacion}
                disabled={guardando}
                className="h-8 border border-[#00be87] bg-[#00be87] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Agregar ejecucion"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
