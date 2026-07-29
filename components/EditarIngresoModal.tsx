"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, LockKeyhole, Save, X } from "lucide-react";
import {
  hayCambiosEnIngreso,
  normalizarFechaIngreso,
  TEXTO_CONFIRMACION_INGRESO,
  validarCorreccionIngreso,
  type DatosEditablesIngreso,
} from "@/lib/ingresos-edicion";
import {
  actualizarIngreso,
  CUENTAS_INGRESOS,
  TIPOS_INGRESO,
  type IngresoReporte,
} from "@/services/ingresos.service";

type Props = {
  ingreso: IngresoReporte;
  onGuardado: () => void;
  onClose: () => void;
};

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function opcionesConValorActual(
  opciones: readonly string[],
  valorActual: string
) {
  return valorActual && !opciones.includes(valorActual)
    ? [valorActual, ...opciones]
    : [...opciones];
}

export default function EditarIngresoModal({
  ingreso,
  onGuardado,
  onClose,
}: Props) {
  const idIngreso =
    ingreso.id_deposito === null || ingreso.id_deposito === undefined
      ? ""
      : String(ingreso.id_deposito);
  const original = useMemo<DatosEditablesIngreso>(
    () => ({
      cuenta: ingreso.cuenta?.trim() ?? "",
      tipo_ingreso: ingreso.tipo_ingreso?.trim() ?? "",
      monto: Number(ingreso.monto ?? 0),
      fecha_deposito: normalizarFechaIngreso(ingreso.fecha_deposito),
    }),
    [ingreso]
  );
  const [cuenta, setCuenta] = useState(original.cuenta);
  const [tipoIngreso, setTipoIngreso] = useState(original.tipo_ingreso);
  const [monto, setMonto] = useState(String(original.monto));
  const [fechaDeposito, setFechaDeposito] = useState(
    original.fecha_deposito
  );
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const montoNumerico = Number(monto.replace(",", "."));
  const actual: DatosEditablesIngreso = {
    cuenta,
    tipo_ingreso: tipoIngreso,
    monto: montoNumerico,
    fecha_deposito: fechaDeposito,
  };
  const hayCambios = hayCambiosEnIngreso(original, actual);
  const validacion = validarCorreccionIngreso({
    original,
    actual,
    motivo,
    confirmacion,
  });
  const cuentas = opcionesConValorActual(CUENTAS_INGRESOS, original.cuenta);
  const tiposIngreso = opcionesConValorActual(
    TIPOS_INGRESO,
    original.tipo_ingreso
  );

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const errorValidacion = validarCorreccionIngreso({
      original,
      actual,
      motivo,
      confirmacion,
    });

    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (!idIngreso) {
      setError(
        "Este depósito no tiene un identificador y no se puede corregir."
      );
      return;
    }

    try {
      setGuardando(true);
      await actualizarIngreso({
        id: idIngreso,
        ...actual,
        motivo,
        confirmacion,
      });
      onGuardado();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la corrección."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-ingreso-titulo"
    >
      <form
        onSubmit={guardar}
        className="mx-auto max-w-3xl border border-slate-300 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              Corrección controlada
            </div>
            <h2
              id="editar-ingreso-titulo"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              Editar depósito
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Registro {idIngreso || "sin identificador"} · arqueo{" "}
              {ingreso.id_arqueo ?? "sin identificar"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Cerrar sin guardar"
            aria-label="Cerrar sin guardar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Esta acción modifica un registro financiero. Se guardarán el
                valor anterior, el valor nuevo, el usuario y el motivo en la
                bitácora.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Valores actuales
            </div>
            <div className="mt-2 grid border border-slate-200 bg-slate-50 sm:grid-cols-2">
              <DatoActual label="Cuenta" value={original.cuenta || "Sin cuenta"} />
              <DatoActual
                label="Tipo de ingreso"
                value={original.tipo_ingreso || "Sin tipo"}
              />
              <DatoActual label="Monto" value={formatMoney(original.monto)} />
              <DatoActual
                label="Fecha de depósito"
                value={original.fecha_deposito || "Sin fecha"}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="editar-ingreso-cuenta"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Cuenta bancaria
              </label>
              <select
                id="editar-ingreso-cuenta"
                value={cuenta}
                onChange={(event) => setCuenta(event.target.value)}
                disabled={guardando}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
              >
                {cuentas.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="editar-ingreso-tipo"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Tipo de ingreso
              </label>
              <select
                id="editar-ingreso-tipo"
                value={tipoIngreso}
                onChange={(event) => setTipoIngreso(event.target.value)}
                disabled={guardando}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
              >
                {tiposIngreso.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="editar-ingreso-monto"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Monto
              </label>
              <input
                id="editar-ingreso-monto"
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                disabled={guardando}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="editar-ingreso-fecha"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Fecha de depósito
              </label>
              <input
                id="editar-ingreso-fecha"
                type="date"
                value={fechaDeposito}
                onChange={(event) => setFechaDeposito(event.target.value)}
                disabled={guardando}
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="editar-ingreso-motivo"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Motivo de la corrección
              </label>
              <textarea
                id="editar-ingreso-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                disabled={guardando}
                rows={3}
                maxLength={500}
                placeholder="Ej.: El depósito fue asociado a una cuenta bancaria incorrecta."
                className="w-full resize-y border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100"
              />
              <div className="mt-1 text-right text-[11px] tabular-nums text-slate-400">
                {motivo.trim().length}/500
              </div>
            </div>
          </div>

          <div className="mt-5 border border-slate-300 bg-slate-50 p-4">
            <label
              htmlFor="editar-ingreso-confirmacion"
              className="block text-xs font-semibold text-slate-800"
            >
              Para confirmar, escriba{" "}
              <span className="font-mono">{TEXTO_CONFIRMACION_INGRESO}</span>
            </label>
            <input
              id="editar-ingreso-confirmacion"
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              disabled={guardando}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm uppercase outline-none focus:border-amber-500 disabled:bg-slate-100"
              placeholder={TEXTO_CONFIRMACION_INGRESO}
            />
            <p className="mt-2 text-xs text-slate-500">
              El botón permanecerá bloqueado hasta que haya un cambio, un
              motivo suficiente y la confirmación sea exacta.
            </p>
          </div>

          {error && (
            <div
              className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {hayCambios ? "Hay cambios pendientes." : "Aún no hay cambios."}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="h-10 border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || Boolean(validacion) || !idIngreso}
              className="inline-flex h-10 items-center justify-center gap-2 border border-amber-600 bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              <Save className="h-4 w-4" />
              {guardando ? "Guardando..." : "Guardar corrección"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function DatoActual({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 px-3 py-2 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <div className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-sm text-slate-700">{value}</div>
    </div>
  );
}
