import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Landmark,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { redondearMoneda } from "@/lib/conversion-ingresos";
import {
  CUENTAS_INGRESOS,
  TIPOS_INGRESO,
} from "@/lib/catalogos-ingresos";
import type { DepositoArqueoInput } from "@/services/arqueos.service";
import ResumenMontoArqueo from "@/components/arqueos/ResumenMontoArqueo";
import {
  formatMoney,
  normalizarMonto,
  obtenerFechaLocal,
} from "@/components/arqueos/formato-arqueo";

type Props = {
  depositos: DepositoArqueoInput[];
  totalRecaudado: number;
  totalConvertidoSami: number;
  totalRegistroManual: number;
  totalDepositos: number;
  diferencia: number;
  arqueoCuadrado: boolean;
  guardando: boolean;
  onAgregar: (deposito: DepositoArqueoInput) => void;
  onEliminar: (index: number) => void;
  onMostrarError: (mensaje: string) => void;
  onAnterior: () => void;
  onGuardar: () => void;
};

export default function VentanaDepositosArqueo({
  depositos,
  totalRecaudado,
  totalConvertidoSami,
  totalRegistroManual,
  totalDepositos,
  diferencia,
  arqueoCuadrado,
  guardando,
  onAgregar,
  onEliminar,
  onMostrarError,
  onAnterior,
  onGuardar,
}: Props) {
  const [cuenta, setCuenta] = useState<string>(CUENTAS_INGRESOS[0]);
  const [tipoIngreso, setTipoIngreso] = useState<string>(TIPOS_INGRESO[0]);
  const [monto, setMonto] = useState("");
  const [fechaDeposito, setFechaDeposito] = useState(obtenerFechaLocal());

  function agregarDeposito() {
    const montoNumerico = normalizarMonto(monto);

    if (!cuenta || !tipoIngreso || !monto || !fechaDeposito) {
      onMostrarError(
        "Complete la cuenta, el tipo, el monto y la fecha del depósito."
      );
      return;
    }

    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      onMostrarError("El monto del depósito debe ser mayor que cero.");
      return;
    }

    onAgregar({
      cuenta,
      tipo_ingreso: tipoIngreso,
      monto: redondearMoneda(montoNumerico),
      fecha_deposito: fechaDeposito,
    });
    setMonto("");
  }

  return (
    <div className="space-y-5 p-5">
      <div className="border border-sky-200 bg-sky-50 px-4 py-3">
        <div className="text-sm font-semibold text-sky-900">
          ¿Qué debe hacer en esta ventana?
        </div>
        <p className="mt-1 text-sm leading-6 text-sky-800">
          Agregue cada depósito bancario por separado. El total de los
          depósitos debe ser exactamente igual al total del Excel, incluyendo
          los rubros señalados para registro manual.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ResumenMontoArqueo
          label="Convertido a SAMI"
          value={formatMoney(totalConvertidoSami)}
          tone="success"
        />
        <ResumenMontoArqueo
          label="Registro manual"
          value={formatMoney(totalRegistroManual)}
          tone={totalRegistroManual > 0 ? "warning" : "normal"}
        />
        <ResumenMontoArqueo
          label="Total que debe depositar"
          value={formatMoney(totalRecaudado)}
        />
        <ResumenMontoArqueo
          label="Total agregado"
          value={formatMoney(totalDepositos)}
          tone={arqueoCuadrado ? "success" : "normal"}
        />
      </div>

      <div className="border border-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <Landmark className="h-5 w-5 text-slate-700" />
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Agregar un depósito bancario
            </h3>
            <p className="text-xs text-slate-500">
              Repita este paso si el arqueo tiene más de un depósito.
            </p>
          </div>
        </div>

        <div className="p-4">
          <div className="grid gap-3 xl:grid-cols-[1.4fr_160px_150px_180px_auto] xl:items-end">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Cuenta bancaria
              </label>
              <select
                value={cuenta}
                onChange={(event) => setCuenta(event.target.value)}
                className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
              >
                {CUENTAS_INGRESOS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Tipo de ingreso
              </label>
              <select
                value={tipoIngreso}
                onChange={(event) => setTipoIngreso(event.target.value)}
                className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
              >
                {TIPOS_INGRESO.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Monto
              </label>
              <input
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    agregarDeposito();
                  }
                }}
                placeholder="0.00"
                className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Fecha del depósito
              </label>
              <input
                type="date"
                value={fechaDeposito}
                onChange={(event) => setFechaDeposito(event.target.value)}
                className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={agregarDeposito}
              className="inline-flex h-11 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-5 text-base font-semibold text-white hover:bg-slate-700"
            >
              <Plus className="h-5 w-5" />
              Agregar
            </button>
          </div>

          <div className="mt-4 overflow-auto border border-slate-200 bg-white">
            {depositos.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Todavía no ha agregado depósitos
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Complete los datos anteriores y presione “Agregar”.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Cuenta</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {depositos.map((deposito, index) => (
                    <tr
                      key={`${deposito.cuenta}-${deposito.fecha_deposito}-${index}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-700">
                        {deposito.cuenta}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {deposito.tipo_ingreso}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-600">
                        {deposito.fecha_deposito}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                        {formatMoney(deposito.monto)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onEliminar(index)}
                          className="inline-flex h-9 w-9 items-center justify-center border border-red-200 text-red-600 hover:bg-red-50"
                          title="Quitar depósito"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td
                      colSpan={3}
                      className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-600"
                    >
                      Total de depósitos
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-950">
                      {formatMoney(totalDepositos)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>

      <div
        className={`flex items-start gap-3 border px-4 py-4 ${
          arqueoCuadrado
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
        role="status"
      >
        {arqueoCuadrado ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
        )}
        <div>
          <div className="text-base font-semibold">
            {arqueoCuadrado
              ? "El arqueo está cuadrado y listo para guardar"
              : depositos.length === 0
                ? "Agregue los depósitos para comprobar el arqueo"
                : "Los depósitos todavía no cuadran"}
          </div>
          <div className="mt-1 text-sm">
            Total requerido: {formatMoney(totalRecaudado)} · Total agregado:{" "}
            {formatMoney(totalDepositos)} · Diferencia:{" "}
            {formatMoney(diferencia)}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onAnterior}
          className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 hover:border-slate-500"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver al informe
        </button>
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando || !arqueoCuadrado}
          className="inline-flex h-11 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          <Save className="h-5 w-5" />
          {guardando ? "Guardando..." : "Guardar arqueo"}
        </button>
      </div>
    </div>
  );
}
