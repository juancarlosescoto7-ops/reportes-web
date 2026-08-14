"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  Info,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import {
  resumirContextosPresupuesto,
  type NivelUbicacionPresupuestaria,
  type RenglonContextoPresupuesto,
} from "@/lib/contextualizador-presupuesto";
import { actualizarContextoCodigoPresupuesto } from "@/services/presupuesto";

const MAX_CONTEXTO = 2000;

type Props = {
  data: Record<string, unknown>[];
  onContextoGuardado: (codigo: string, contexto: string) => void;
  onVolverAlArbol: () => void;
};

export default function ContextualizadorPresupuesto({
  data,
  onContextoGuardado,
  onVolverAlArbol,
}: Props) {
  const resumen = useMemo(
    () => resumirContextosPresupuesto(data),
    [data]
  );
  const [ordenPendientes, setOrdenPendientes] = useState<string[]>([]);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ultimoGuardado, setUltimoGuardado] = useState("");

  const pendientes = useMemo(() => {
    if (ordenPendientes.length === 0) return resumen.pendientes;

    const porCodigo = new Map(
      resumen.pendientes.map((item) => [item.codigoPresupuestario, item])
    );
    const ordenados = ordenPendientes
      .map((codigo) => porCodigo.get(codigo))
      .filter(
        (item): item is RenglonContextoPresupuesto => Boolean(item)
      );
    const conocidos = new Set(ordenPendientes);

    return [
      ...ordenados,
      ...resumen.pendientes.filter(
        (item) => !conocidos.has(item.codigoPresupuestario)
      ),
    ];
  }, [ordenPendientes, resumen.pendientes]);

  const actual = pendientes[0] ?? null;
  const texto = actual ? borradores[actual.codigoPresupuestario] ?? "" : "";
  const porcentaje = resumen.total
    ? Math.round((resumen.configurados / resumen.total) * 100)
    : 100;

  function actualizarBorrador(value: string) {
    if (!actual) return;

    setBorradores((current) => ({
      ...current,
      [actual.codigoPresupuestario]: value.slice(0, MAX_CONTEXTO),
    }));
    setError("");
  }

  function omitirPorAhora() {
    if (pendientes.length < 2 || guardando) return;

    setOrdenPendientes([
      ...pendientes.slice(1).map((item) => item.codigoPresupuestario),
      pendientes[0].codigoPresupuestario,
    ]);
    setError("");
    setUltimoGuardado("");
  }

  async function guardarYContinuar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!actual || guardando) return;

    const contexto = texto.trim();

    if (!contexto) {
      setError("Escriba el contexto que debe usar la IA antes de continuar.");
      return;
    }

    setGuardando(true);
    setError("");
    setUltimoGuardado("");

    try {
      await actualizarContextoCodigoPresupuesto({
        codigo: actual.codigoPresupuestario,
        contexto,
      });

      onContextoGuardado(actual.codigoPresupuestario, contexto);
      setBorradores((current) => {
        const next = { ...current };
        delete next[actual.codigoPresupuestario];
        return next;
      });
      setUltimoGuardado(
        `${actual.objeto ?? actual.codigoPresupuestario}${
          actual.descripcionObjeto ? ` · ${actual.descripcionObjeto}` : ""
        }`
      );
    } catch (guardarError) {
      setError(
        guardarError instanceof Error
          ? guardarError.message
          : "No se pudo guardar el contexto presupuestario."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-10 xl:h-full xl:overflow-y-auto xl:px-1">
      <header className="glass-shell overflow-hidden">
        <div className="grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_320px] lg:items-center lg:px-8 lg:py-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Presupuesto · Contexto para IA
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Contextualizar renglones
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">
              Complete un renglón a la vez. Al guardar, el sistema abrirá
              automáticamente el siguiente que todavía no tiene contexto.
            </p>
          </div>

          <ProgressSummary
            configurados={resumen.configurados}
            pendientes={pendientes.length}
            total={resumen.total}
            porcentaje={porcentaje}
          />
        </div>
      </header>

      {ultimoGuardado && actual && (
        <div
          className="mt-3 flex items-start gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800"
          role="status"
          aria-live="polite"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Guardado <strong>{ultimoGuardado}</strong>. Ya está listo el
            siguiente renglón.
          </span>
        </div>
      )}

      {actual ? (
        <form
          onSubmit={guardarYContinuar}
          className="glass-shell mt-3 overflow-hidden"
        >
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  <CircleDot className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                  Renglón pendiente
                </div>
                <h2 className="mt-1 break-words text-lg font-bold text-slate-950 sm:text-xl">
                  {actual.descripcionObjeto ?? "Renglón sin descripción"}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                  {actual.objeto && (
                    <span className="font-mono text-slate-700">{actual.objeto}</span>
                  )}
                  {actual.objeto && <span aria-hidden="true">·</span>}
                  <span className="break-all font-mono">
                    {actual.codigoPresupuestario}
                  </span>
                </div>
              </div>

              <span className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                {pendientes.length} por completar
              </span>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <section className="border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center bg-[#003331] text-white">
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Ubicación presupuestaria
                  </h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Esta ruta completa acompañará el contexto cuando la IA
                    analice una cuenta por pagar.
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-2" aria-label="Ruta presupuestaria completa">
                {actual.niveles.map((nivel, index) => (
                  <BudgetLevel
                    key={nivel.tipo}
                    nivel={nivel}
                    index={index}
                    ultimo={index === actual.niveles.length - 1}
                  />
                ))}
              </ol>
            </section>

            <section className="flex min-w-0 flex-col p-4 sm:p-6">
              <div className="flex items-start gap-2 border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11px] leading-4 text-sky-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                <p>
                  No necesita repetir el programa, la actividad o la obra.
                  Describa qué pagos sí corresponden; la IA recibirá la
                  ubicación mostrada a la izquierda junto con su texto.
                </p>
              </div>

              <label
                htmlFor="contexto-presupuestario"
                className="mt-5 text-[12px] font-bold text-slate-800"
              >
                ¿Qué tipos de cuentas por pagar corresponden aquí?
              </label>
              <textarea
                id="contexto-presupuestario"
                value={texto}
                onChange={(event) => actualizarBorrador(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={MAX_CONTEXTO}
                rows={8}
                disabled={guardando}
                placeholder={crearPlaceholder(
                  actual.descripcionObjeto,
                  actual.niveles
                )}
                className="mt-2 min-h-48 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-[16px] leading-6 text-slate-800 outline-none disabled:cursor-wait disabled:opacity-70 sm:text-[13px] sm:leading-5"
              />
              <div className="mt-1.5 flex items-start justify-between gap-4 text-[10px] leading-4 text-slate-400">
                <span>Incluya usos válidos y, si ayuda, exclusiones importantes.</span>
                <span className="shrink-0 tabular-nums">
                  {texto.length}/{MAX_CONTEXTO}
                </span>
              </div>

              {error && (
                <div
                  className="mt-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="mt-auto grid grid-cols-1 gap-2 pt-5 sm:grid-cols-[auto_1fr]">
                <button
                  type="button"
                  onClick={omitirPorAhora}
                  disabled={guardando || pendientes.length < 2}
                  className="order-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 sm:order-1 sm:min-h-11"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Omitir por ahora
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="order-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-5 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 sm:order-2 sm:min-h-11"
                >
                  {guardando ? "Guardando contexto..." : "Guardar y continuar"}
                  {!guardando && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </section>
          </div>
        </form>
      ) : (
        <CompletionState total={resumen.total} onVolverAlArbol={onVolverAlArbol} />
      )}
    </div>
  );
}

function ProgressSummary({
  configurados,
  pendientes,
  total,
  porcentaje,
}: {
  configurados: number;
  pendientes: number;
  total: number;
  porcentaje: number;
}) {
  return (
    <div className="border border-slate-200 bg-white/80 px-4 py-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Avance general
          </div>
          <div className="mt-1 text-[12px] font-semibold text-slate-700">
            {configurados} de {total} configurados
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums text-[#003331]">
            {porcentaje}%
          </div>
          <div className="text-[10px] font-semibold text-amber-700">
            {pendientes} pendientes
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden bg-slate-200" aria-hidden="true">
        <div
          className="h-full bg-emerald-600 transition-[width] duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

function BudgetLevel({
  nivel,
  index,
  ultimo,
}: {
  nivel: NivelUbicacionPresupuestaria;
  index: number;
  ultimo: boolean;
}) {
  const codigoRepetido = nivel.codigo && nivel.codigo === nivel.nombre;
  const sinDetalle = !nivel.codigo && !nivel.nombre;

  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      {!ultimo && (
        <span
          className="absolute left-[13px] top-7 h-[calc(100%+0.5rem)] w-px bg-emerald-200"
          aria-hidden="true"
        />
      )}
      <span
        className={[
          "relative z-10 grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black tabular-nums",
          ultimo
            ? "border-emerald-700 bg-emerald-700 text-white"
            : "border-emerald-200 bg-emerald-50 text-emerald-800",
        ].join(" ")}
      >
        {index + 1}
      </span>
      <div
        className={[
          "min-w-0 border px-3 py-2",
          ultimo
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-slate-200 bg-white/80",
        ].join(" ")}
      >
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {nivel.etiqueta}
        </div>
        {sinDetalle ? (
          <div className="mt-0.5 text-[11px] italic text-slate-400">
            No especificado
          </div>
        ) : (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {nivel.codigo && (
              <span className="font-mono text-[10px] font-bold text-slate-600">
                {nivel.codigo}
              </span>
            )}
            {nivel.nombre && !codigoRepetido && (
              <span className="min-w-0 break-words text-[12px] font-semibold text-slate-900">
                {nivel.nombre}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function crearPlaceholder(
  descripcionObjeto: string | null,
  niveles: NivelUbicacionPresupuestaria[]
) {
  const ubicacion = [...niveles]
    .reverse()
    .find((nivel) => nivel.tipo !== "renglon" && nivel.nombre)?.nombre;
  const renglon = descripcionObjeto ?? "este renglón";

  return `Ejemplo: Pagos de ${renglon.toLocaleLowerCase("es")}${
    ubicacion ? ` utilizados en ${ubicacion}` : ""
  }; aplica a facturas de proveedores autorizados y excluye gastos de uso personal.`;
}

function CompletionState({
  total,
  onVolverAlArbol,
}: {
  total: number;
  onVolverAlArbol: () => void;
}) {
  const sinRenglones = total === 0;

  return (
    <section className="glass-shell mt-3 px-5 py-12 text-center sm:px-8 sm:py-16">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        {sinRenglones ? (
          <ListChecks className="h-7 w-7" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        )}
      </span>
      <h2 className="mt-4 text-xl font-bold text-slate-950">
        {sinRenglones
          ? "No hay renglones presupuestarios"
          : "Todos los renglones tienen contexto"}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-slate-500">
        {sinRenglones
          ? "La consulta presupuestaria no devolvió códigos para contextualizar."
          : "La IA ya cuenta con una orientación específica para cada código presupuestario disponible."}
      </p>
      <button
        type="button"
        onClick={onVolverAlArbol}
        className="mt-6 inline-flex min-h-11 items-center justify-center border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-800"
      >
        Volver al árbol
      </button>
    </section>
  );
}
