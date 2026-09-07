"use client";

import { Landmark, Plus, ReceiptText, RefreshCw } from "lucide-react";
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

type Props = { anio: number; ejercicioBase: number };
type Area = "gastos" | "ingresos";

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
          <button type="button" onClick={() => void initialize()} disabled={busy} className="mt-5 inline-flex h-10 items-center gap-2 bg-[#005f48] px-4 text-sm font-semibold text-white disabled:opacity-60">
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
    <div className="flex min-h-0 flex-col bg-slate-100 xl:h-full">
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
        {error ? <div className="mb-2"><ErrorBanner text={error} /></div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700">Presupuesto · módulo interno</div>
            <div className="text-sm font-semibold text-slate-950">Borrador {anio}</div>
          </div>
          <div className="flex items-center gap-2">
            <AreaButton active={area === "gastos"} onClick={() => setArea("gastos")} icon={<ReceiptText className="h-4 w-4" />} label={`Gastos ${money(gastoTotal)}`} />
            <AreaButton active={area === "ingresos"} onClick={() => setArea("ingresos")} icon={<Landmark className="h-4 w-4" />} label={`Ingresos ${money(ingresoTotal)}`} />
            <button type="button" onClick={() => void load()} className="grid h-9 w-9 place-items-center border border-slate-300 bg-white text-slate-600" title="Recargar borrador">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {area === "gastos" ? (
          <BorradorGastosWorkspace data={data} onChanged={load} />
        ) : (
          <BorradorIngresosWorkspace data={data} onChanged={load} />
        )}
      </div>
    </div>
  );
}

function AreaButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-9 items-center gap-2 border px-3 text-[11px] font-semibold ${active ? "border-[#005f48] bg-[#005f48] text-white" : "border-slate-300 bg-white text-slate-700"}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-6"><h1 className="text-lg font-semibold">{title}</h1><div className="mt-3 text-sm text-slate-500">{children}</div></section>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div role="alert" className="border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">{text}</div>;
}
