import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Printer,
} from "lucide-react";

import ResumenMontoArqueo from "@/components/arqueos/ResumenMontoArqueo";
import { formatMoney } from "@/components/arqueos/formato-arqueo";
import type { ResultadoConversionIngresos } from "@/lib/conversion-ingresos";

type Props = {
  modo?: "arqueo" | "conversor";
  conversion: ResultadoConversionIngresos;
  onAnterior: () => void;
  onImprimir: () => void;
  onContinuar?: () => void;
  onFinalizar?: () => void;
};

export default function VentanaInformeSami({
  modo = "arqueo",
  conversion,
  onAnterior,
  onImprimir,
  onContinuar,
  onFinalizar,
}: Props) {
  const tieneRubrosManuales = conversion.sinEquivalencia.length > 0;
  const esConversor = modo === "conversor";

  return (
    <div className="space-y-5 p-5">
      <div className="border border-sky-200 bg-sky-50 px-4 py-3">
        <div className="text-sm font-semibold text-sky-900">
          ¿Qué debe hacer en esta ventana?
        </div>
        <p className="mt-1 text-sm leading-6 text-sky-800">
          {esConversor
            ? "Revise los rubros SAMI y sus montos. Puede imprimir este resultado sin registrar depósitos ni crear un arqueo."
            : "Revise los rubros SAMI y sus montos. Si hay una inconsistencia, el sistema la señalará antes de continuar."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumenMontoArqueo
          label="Total SAMI"
          value={formatMoney(conversion.totalSami)}
          tone="success"
        />
        <ResumenMontoArqueo
          label="Pendiente manual"
          value={formatMoney(conversion.totalSinEquivalencia)}
          tone={tieneRubrosManuales ? "warning" : "success"}
        />
        <ResumenMontoArqueo
          label={esConversor ? "Total SAFT" : "Total del arqueo"}
          value={formatMoney(conversion.totalSaft)}
        />
      </div>

      <div className="border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <h3 className="text-sm font-semibold text-emerald-900">
            Rubros SAMI
          </h3>
        </div>

        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">SAMI</th>
                <th className="px-3 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {conversion.detallesSami.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No hay rubros SAMI disponibles.
                  </td>
                </tr>
              ) : (
                conversion.detallesSami.map((detalle) => (
                  <tr
                    key={detalle.codigo}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 text-slate-700">
                      <span className="font-semibold text-slate-950">
                        {detalle.codigo}
                      </span>
                      <span className="ml-2">{detalle.descripcion}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                      {formatMoney(detalle.valorRecaudado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {tieneRubrosManuales ? (
        <div className="border-2 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3 border-b border-amber-300 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-800" />
            <div>
              <h3 className="text-base font-bold uppercase text-amber-950">
                Inconsistencia: registro manual
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {conversion.sinEquivalencia.length} rubro(s) no tienen
                equivalencia. Consulte este detalle únicamente para completar
                el registro manual.
              </p>
            </div>
          </div>

          <div className="max-h-[240px] overflow-auto bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-amber-100 text-xs uppercase text-amber-900">
                <tr>
                  <th className="px-3 py-2">Código pendiente</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {conversion.sinEquivalencia.map((rubro) => (
                  <tr
                    key={rubro.codigo}
                    className="border-t border-amber-200"
                  >
                    <td className="px-3 py-2 font-bold text-amber-950">
                      {rubro.codigo}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {rubro.descripcion}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-amber-950">
                      {formatMoney(rubro.valorRecaudado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          No hay rubros pendientes de registro manual.
        </div>
      )}

      <div className="border border-slate-300 bg-slate-50 px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Informe listo para imprimir
            </div>
            <p className="mt-1 text-xs text-slate-500">
              El PDF mostrará los rubros SAMI y, en una sección separada, el
              código, descripción y monto de cada ingreso con inconsistencia.
            </p>
          </div>
          <button
            type="button"
            onClick={onImprimir}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-6 text-base font-semibold text-white hover:bg-slate-700"
          >
            <Printer className="h-5 w-5" />
            Imprimir informe
          </button>
        </div>
      </div>

      <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onAnterior}
          className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 hover:border-slate-500"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver a la conversión
        </button>
        {onContinuar && (
          <button
            type="button"
            onClick={onContinuar}
            className="inline-flex h-11 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-700"
          >
            Continuar: agregar depósitos
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
        {onFinalizar && (
          <button
            type="button"
            onClick={onFinalizar}
            className="inline-flex h-11 items-center justify-center gap-2 border border-emerald-700 bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800"
          >
            <CheckCircle2 className="h-5 w-5" />
            Finalizar y limpiar conversión
          </button>
        )}
      </div>
    </div>
  );
}
