"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import {
  crearArqueoCompleto,
  CUENTAS_INGRESOS,
  TIPOS_INGRESO,
  type IngresoDepositoInput,
} from "@/services/ingresos.service";

type Props = {
  onGuardado?: (idArqueo: string) => void;
  onClose?: () => void;
};

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizarMonto(value: string) {
  return Number(value.replace(",", "."));
}

export default function FormIngresos({ onGuardado, onClose }: Props) {
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [descripcion, setDescripcion] = useState("");
  const [cuenta, setCuenta] = useState(CUENTAS_INGRESOS[0]);
  const [tipoIngreso, setTipoIngreso] = useState(TIPOS_INGRESO[0]);
  const [monto, setMonto] = useState("");
  const [fechaDeposito, setFechaDeposito] = useState(obtenerFechaLocal());
  const [depositos, setDepositos] = useState<IngresoDepositoInput[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => {
    return depositos.reduce((acc, deposito) => acc + deposito.monto, 0);
  }, [depositos]);

  function agregarDeposito() {
    setError("");
    setMensaje("");

    const montoNumerico = normalizarMonto(monto);

    if (!cuenta || !tipoIngreso || !monto || !fechaDeposito) {
      setError("Campos incompletos.");
      return;
    }

    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setError("Monto invalido.");
      return;
    }

    setDepositos((prev) => [
      ...prev,
      {
        cuenta,
        tipo_ingreso: tipoIngreso,
        monto: Number(montoNumerico.toFixed(2)),
        fecha_deposito: fechaDeposito,
      },
    ]);

    setMonto("");
  }

  function eliminarDeposito(index: number) {
    setDepositos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function limpiarFormulario() {
    setDescripcion("");
    setDepositos([]);
    setMonto("");
    setFecha(obtenerFechaLocal());
    setFechaDeposito(obtenerFechaLocal());
  }

  async function guardarArqueo() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (!fecha) {
        setError("La fecha del arqueo es obligatoria.");
        return;
      }

      if (depositos.length === 0) {
        setError("Debe agregar al menos un deposito.");
        return;
      }

      const idArqueo = await crearArqueoCompleto({
        fecha,
        descripcion,
        depositos,
      });

      if (!idArqueo) {
        setError("No se recibio el identificador del arqueo.");
        return;
      }

      setMensaje(`Arqueo registrado: ${idArqueo}`);
      limpiarFormulario();
      onGuardado?.(idArqueo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el arqueo."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase text-slate-400">
              Registro operativo
            </div>

            <h2 className="mt-1 text-[18px] font-semibold text-slate-950">
              Nuevo ingreso
            </h2>
          </div>

          <div className="flex items-start gap-3">
            <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-right">
              <div className="text-[10px] font-medium uppercase text-slate-500">
                Total agregado
              </div>
              <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-950">
                {formatMoney(total)}
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Descripcion
            </label>
            <input
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              placeholder="Detalle general del arqueo"
              className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_160px_150px_170px_auto] lg:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Cuenta
              </label>
              <select
                value={cuenta}
                onChange={(event) => setCuenta(event.target.value)}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                {CUENTAS_INGRESOS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Tipo ingreso
              </label>
              <select
                value={tipoIngreso}
                onChange={(event) => setTipoIngreso(event.target.value)}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                {TIPOS_INGRESO.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Monto
              </label>
              <input
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                placeholder="0.00"
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Fecha deposito
              </label>
              <input
                type="date"
                value={fechaDeposito}
                onChange={(event) => setFechaDeposito(event.target.value)}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={agregarDeposito}
              className="inline-flex h-10 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          <div className="mt-4 overflow-hidden border border-slate-200 bg-white">
            {depositos.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No hay depositos agregados.
              </div>
            ) : (
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Cuenta</th>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Monto
                    </th>
                    <th className="px-3 py-2 font-semibold">Deposito</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Accion
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {depositos.map((deposito, index) => (
                    <tr key={`${deposito.cuenta}-${index}`} className="border-t">
                      <td className="px-3 py-2 text-slate-700">
                        {deposito.cuenta}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {deposito.tipo_ingreso}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                        {formatMoney(deposito.monto)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">
                        {deposito.fecha_deposito}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => eliminarDeposito(index)}
                          className="inline-flex h-8 w-8 items-center justify-center border border-red-200 text-red-600 transition hover:bg-red-50"
                          title="Quitar deposito"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t bg-slate-50">
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-400"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                      {formatMoney(total)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mr-3 h-10 border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            onClick={guardarArqueo}
            disabled={guardando || depositos.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            {guardando ? "Guardando..." : "Guardar arqueo"}
          </button>
        </div>
      </div>
    </section>
  );
}
