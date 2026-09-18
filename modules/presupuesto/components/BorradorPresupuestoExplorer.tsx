"use client";

import { Landmark, Plus, Presentation, ReceiptText, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import BorradorGastosWorkspace from "@/modules/presupuesto/components/BorradorGastosWorkspace";
import {
  generarBorradorPresupuesto,
  obtenerBorradorPresupuesto,
  type RespuestaBorrador,
} from "@/modules/presupuesto/services/borradorPresupuesto";

const BorradorIngresosWorkspace = dynamic(
  () => import("@/modules/presupuesto/components/BorradorIngresosWorkspace"),
  {
    loading: () => (
      <div className="p-6 text-sm text-slate-400">
        Cargando catálogo de ingresos…
      </div>
    ),
  },
);

const PresentacionBorrador = dynamic(() => import("./PresentacionBorrador"), {
  loading: () => <div className="p-6 text-sm text-slate-400">Preparando presentación…</div>,
});

type Props = { anio: number; ejercicioBase: number };
type Area = "gastos" | "ingresos" | "presentacion";

const EMPTY: RespuestaBorrador = {
  borrador: null,
  programas: [],
  subprogramas: [],
  proyectos: [],
  actividades: [],
  obras: [],
  codigos: [],
  topes: [],
  fuentes: [],
  controlTechos: [],
  objetosGasto: [],
  rubrosIngresos: [],
  ingresos: [],
};

const money = (value: unknown) =>
  (Number(value) || 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
  });

export default function BorradorPresupuestoExplorer({ anio, ejercicioBase }: Props) {
  const [data, setData] = useState<RespuestaBorrador>(EMPTY);
  const [area, setArea] = useState<Area>("gastos");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showInitialLoading = false) => {
    if (showInitialLoading) setLoading(true);
    setError("");
    try {
      setData(await obtenerBorradorPresupuesto(anio));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el borrador.");
    } finally {
      if (showInitialLoading) setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      await generarBorradorPresupuesto({ anio, ejercicioBase });
      await load();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "No se pudo iniciar el presupuesto.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <StatePanel title={`Borrador - Presupuesto ${anio}`}>Cargando formulación presupuestaria…</StatePanel>;
  }

  if (!data.borrador) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {error ? <ErrorBanner text={error} /> : null}
        <section className="border border-slate-200 bg-white p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Subsistema interno</div>
          <h1 className="mt-1 text-xl font-semibold">Borrador - Presupuesto {anio}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Inicia vacíos los presupuestos de gastos e ingresos. Se conservan las reglas de techo, pero la estructura y las proyecciones se formulan desde cero.
          </p>
          <button data-shortcut="218" type="button" onClick={() => void initialize()} disabled={busy} className="mt-5 inline-flex h-10 items-center gap-2 bg-[#005f48] px-4 text-sm font-semibold text-white disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {busy ? "Iniciando…" : `Iniciar presupuesto ${anio}`}
          </button>
        </section>
      </div>
    );
  }

  const gastoTotal = data.codigos.reduce((total, row) => total + Number(row.monto || 0), 0);
  const ingresoTotal = data.ingresos.reduce((total, row) => total + Number(row.presupuesto_proyectado || 0), 0);

  return (
    <div className="flex min-h-0 flex-col bg-white xl:h-full">
      <header className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2.5 sm:px-4">
        {error ? <div className="mb-2"><ErrorBanner text={error} /></div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-1 rounded-full bg-[#2fae68]" aria-hidden="true" />
            <h1 className="text-sm font-semibold tracking-tight text-[#003331]">Borrador {anio}</h1>
            <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100 sm:inline">{data.borrador.estado}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Áreas del borrador" className="flex flex-wrap items-center gap-0.5 rounded-xl bg-slate-100 p-1">
              <AreaButton active={area === "gastos"} onClick={() => setArea("gastos")} icon={<ReceiptText className="h-4 w-4" />} label="Gastos" total={money(gastoTotal)} />
              <AreaButton active={area === "ingresos"} onClick={() => setArea("ingresos")} icon={<Landmark className="h-4 w-4" />} label="Ingresos" total={money(ingresoTotal)} />
              <button data-shortcut="355" type="button" aria-pressed={area === "presentacion"} onClick={() => setArea("presentacion")} className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${area === "presentacion" ? "bg-[#003331] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#003331]"}`}><Presentation className="h-4 w-4" aria-hidden="true" />Presentación</button>
            </nav>
            <button data-shortcut="219" type="button" onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" title="Recargar borrador" aria-label="Recargar borrador">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {area === "gastos" ? (
          <BorradorGastosWorkspace data={data} onChanged={load} />
        ) : area === "ingresos" ? (
          <BorradorIngresosWorkspace data={data} onChanged={load} />
        ) : (
          <PresentacionBorrador data={data} />
        )}
      </div>
    </div>
  );
}

function AreaButton({ active, onClick, icon, label, total }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; total: string }) {
  return (
    <button data-shortcut="220" type="button" onClick={onClick} aria-label={`${label} ${total}`} aria-pressed={active} className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${active ? "bg-[#003331] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#003331]"}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span><span className={`hidden tabular-nums md:inline ${active ? "text-emerald-100" : "text-slate-400"}`}>{total}</span>
    </button>
  );
}

function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-6"><h1 className="text-lg font-semibold">{title}</h1><div className="mt-3 text-sm text-slate-500">{children}</div></section>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div role="alert" className="border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">{text}</div>;
}
