import type { ChangeEvent, RefObject } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { ResultadoConversionIngresos } from "@/lib/conversion-ingresos";
import type { ReporteRecaudacionSaft } from "@/lib/importar-recaudacion-saft";
import ResumenMontoArqueo from "@/components/arqueos/ResumenMontoArqueo";
import { formatMoney } from "@/components/arqueos/formato-arqueo";

type Props = {
  modo?: "arqueo" | "conversor";
  fecha: string;
  descripcion: string;
  cargandoCatalogos: boolean;
  errorCatalogos: string;
  catalogosDisponibles: boolean;
  procesandoArchivo: boolean;
  reporte: ReporteRecaudacionSaft | null;
  conversion: ResultadoConversionIngresos | null;
  inputArchivoRef: RefObject<HTMLInputElement | null>;
  onCambiarFecha: (value: string) => void;
  onCambiarDescripcion: (value: string) => void;
  onSeleccionarArchivo: (event: ChangeEvent<HTMLInputElement>) => void;
  onLimpiarArchivo: () => void;
  onRecargarCatalogos: () => void;
  onContinuar: () => void;
  onSolicitarEquivalencia?: (codigo: string, descripcion: string) => void;
};

export default function VentanaConversionSaft({
  modo = "arqueo",
  fecha,
  descripcion,
  cargandoCatalogos,
  errorCatalogos,
  catalogosDisponibles,
  procesandoArchivo,
  reporte,
  conversion,
  inputArchivoRef,
  onCambiarFecha,
  onCambiarDescripcion,
  onSeleccionarArchivo,
  onLimpiarArchivo,
  onRecargarCatalogos,
  onContinuar,
  onSolicitarEquivalencia,
}: Props) {
  const tieneRubrosManuales = Boolean(conversion?.sinEquivalencia.length);
  const esConversor = modo === "conversor";

  return (
    <div className="space-y-5 p-5">
      <div className="border border-sky-200 bg-sky-50 px-4 py-3">
        <div className="text-sm font-semibold text-sky-900">
          ¿Qué debe hacer en esta ventana?
        </div>
        <p className="mt-1 text-sm leading-6 text-sky-800">
          {esConversor
            ? "Seleccione el archivo Excel entregado por el cajero. La fecha y la descripción se usarán únicamente en el informe impreso; no se registrará ningún arqueo ni depósito."
            : "Indique la fecha, escriba una descripción y seleccione el archivo Excel entregado por el cajero. El sistema leerá el archivo y hará la conversión automáticamente."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[190px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            1. {esConversor ? "Fecha del informe" : "Fecha del arqueo"}
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(event) => onCambiarFecha(event.target.value)}
            className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            2. {esConversor ? "Descripción del informe" : "Descripción del arqueo"}
          </label>
          <input
            value={descripcion}
            onChange={(event) => onCambiarDescripcion(event.target.value)}
            placeholder="Ejemplo: Recaudación correspondiente al 30 de abril"
            className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="border border-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              3. Seleccione el reporte Excel de SAFT
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Debe ser el archivo .xlsx generado por el cajero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {reporte && (
              <button
                type="button"
                onClick={onLimpiarArchivo}
                className="inline-flex h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-500"
              >
                <RefreshCw className="h-4 w-4" />
                Cambiar archivo
              </button>
            )}

            <label
              className={`inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-semibold ${
                cargandoCatalogos ||
                !catalogosDisponibles ||
                procesandoArchivo
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "cursor-pointer border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {procesandoArchivo ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {procesandoArchivo ? "Leyendo el archivo..." : "Buscar archivo"}
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onSeleccionarArchivo}
                disabled={
                  cargandoCatalogos ||
                  !catalogosDisponibles ||
                  procesandoArchivo
                }
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {cargandoCatalogos && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Preparando los catálogos SAMI y SAFT...
          </div>
        )}

        {!cargandoCatalogos && errorCatalogos && (
          <div className="m-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>{errorCatalogos}</p>
                <button
                  type="button"
                  onClick={onRecargarCatalogos}
                  className="mt-3 inline-flex h-9 items-center gap-2 border border-red-300 bg-white px-3 text-sm font-semibold text-red-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Volver a intentar
                </button>
              </div>
            </div>
          </div>
        )}

        {!cargandoCatalogos &&
          !errorCatalogos &&
          !reporte &&
          !procesandoArchivo && (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
              <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
              <p className="mt-3 text-base font-semibold text-slate-800">
                Todavía no ha seleccionado ningún archivo
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                Presione el botón “Buscar archivo”. No necesita borrar los
                encabezados del Excel: el sistema encontrará los datos.
              </p>
            </div>
          )}

        {reporte && conversion && (
          <div>
            <div className="grid gap-3 border-b border-slate-200 px-4 py-4 lg:grid-cols-[1fr_180px_180px] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Archivo leído correctamente
                </div>
                <div className="mt-1 truncate text-sm font-medium text-slate-900">
                  {reporte.nombreArchivo}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {reporte.registros.length} registros encontrados
                  {reporte.periodo ? ` · Período: ${reporte.periodo}` : ""}
                </div>
              </div>
              <ResumenMontoArqueo
                label="Total del Excel"
                value={formatMoney(conversion.totalSaft)}
              />
              <ResumenMontoArqueo
                label="Rubros sin equivalencia"
                value={String(conversion.sinEquivalencia.length)}
                tone={tieneRubrosManuales ? "warning" : "success"}
              />
            </div>

            {tieneRubrosManuales ? (
              <div className="m-4 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      La conversión tiene{" "}
                      {conversion.sinEquivalencia.length} rubro(s) para
                      registro manual.
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      Puede continuar. Estos rubros aparecerán separados y
                      claramente identificados en el informe impreso.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="m-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Todos los rubros fueron convertidos automáticamente a SAMI.
              </div>
            )}

            <div className="px-4 pb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos que se leyeron del Excel
              </div>
              <div className="max-h-[330px] overflow-auto border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Código SAFT</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2">Resultado</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      {onSolicitarEquivalencia && (
                        <th className="px-3 py-2 text-center">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {conversion.registros.map((registro) => (
                      <tr
                        key={`${registro.fila}-${registro.codigo}`}
                        className={
                          registro.codigoSami
                            ? "border-t border-slate-100"
                            : "border-t border-amber-200 bg-amber-50"
                        }
                      >
                        <td className="px-3 py-2 tabular-nums text-slate-500">
                          {registro.fila}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {registro.codigo}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {registro.descripcion}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {registro.codigoSami ? (
                            <span className="text-emerald-700">
                              SAMI {registro.codigoSami}
                            </span>
                          ) : (
                            <span className="text-amber-800">
                              Registro manual
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                          {formatMoney(registro.valorRecaudado)}
                        </td>
                        {onSolicitarEquivalencia && (
                          <td className="px-3 py-2 text-center">
                            {!registro.codigoSami ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onSolicitarEquivalencia(
                                    registro.codigo,
                                    registro.descripcion
                                  )
                                }
                                className="inline-flex h-8 items-center justify-center border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                              >
                                Vincular
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">Vinculado</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinuar}
          disabled={!reporte || !conversion}
          className="inline-flex h-11 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          {esConversor
            ? "Ver resultado de la conversión"
            : "Continuar: revisar el informe"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
