"use client";

import { Save, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { guardarIngresoBorrador, type IngresoBorrador, type RespuestaBorrador, type RubroIngresoSaft } from "@/modules/presupuesto/services/borradorPresupuesto";

const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });

export default function BorradorIngresosWorkspace({ data, onChanged }: { data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("es-HN"));
  const projections = useMemo(() => new Map(data.ingresos.map((row) => [row.codigo_saft, row])), [data.ingresos]);
  const rows = useMemo(() => data.rubrosIngresos.filter((rubro) => {
    const projection = projections.get(rubro.codigo);
    if (onlyConfigured && !projection) return false;
    if (!deferredSearch) return true;
    return `${rubro.codigo} ${rubro.descripcion}`.toLocaleLowerCase("es-HN").includes(deferredSearch);
  }), [data.rubrosIngresos, deferredSearch, onlyConfigured, projections]);
  const total = data.ingresos.reduce((sum, row) => sum + Number(row.presupuesto_proyectado || 0), 0);

  return (
    <div className="flex h-full min-h-[640px] flex-col overflow-hidden bg-white">
      <section className="grid shrink-0 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-[1.2fr_1fr_1fr]">
        <Summary label="Ingreso proyectado 15-013-01" value={money(total)} tone="strong" />
        <Summary label="Rubros configurados" value={`${data.ingresos.length} de ${data.rubrosIngresos.length}`} />
        <Summary label="Cálculo" value="Negocios × monto a cobrar" />
      </section>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="relative block min-w-[260px] flex-1 max-w-xl"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cuenta SAFT…" className="h-9 w-full border border-slate-300 bg-white pl-9 pr-3 text-xs" /></label>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={onlyConfigured} onChange={(event) => setOnlyConfigured(event.target.checked)} />Solo rubros configurados</label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[980px] w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#003331] text-[10px] uppercase tracking-[0.12em] text-white">
            <tr><th className="px-3 py-2 text-left text-white">Cuenta SAFT</th><th className="w-36 px-3 py-2 text-right text-white">Cantidad negocios</th><th className="w-44 px-3 py-2 text-right text-white">Monto por negocio</th><th className="w-44 px-3 py-2 text-right text-white">Proyección</th><th className="w-20 px-3 py-2 text-center text-white">Guardar</th></tr>
          </thead>
          <tbody>
            {rows.map((rubro) => <IncomeRow key={rubro.codigo} rubro={rubro} projection={projections.get(rubro.codigo)} borradorId={data.borrador!.id} onChanged={onChanged} />)}
          </tbody>
        </table>
        {!rows.length ? <div className="p-10 text-center text-sm text-slate-400">No hay rubros que coincidan con la búsqueda.</div> : null}
      </div>
    </div>
  );
}

function IncomeRow({ rubro, projection, borradorId, onChanged }: { rubro: RubroIngresoSaft; projection?: IngresoBorrador; borradorId: string; onChanged: () => Promise<void> }) {
  const [quantity, setQuantity] = useState(String(projection?.cantidad_negocios ?? 0));
  const [rate, setRate] = useState(String(projection?.monto_por_negocio ?? 0));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setQuantity(String(projection?.cantidad_negocios ?? 0));
    setRate(String(projection?.monto_por_negocio ?? 0));
  }, [projection?.cantidad_negocios, projection?.monto_por_negocio]);

  const projected = (Number(quantity) || 0) * (Number(rate) || 0);
  const unchanged = Number(quantity) === Number(projection?.cantidad_negocios ?? 0) && Number(rate) === Number(projection?.monto_por_negocio ?? 0);

  async function save() {
    const quantityNumber = Number(quantity);
    const rateNumber = Number(rate);
    if (!Number.isSafeInteger(quantityNumber) || quantityNumber < 0 || !Number.isFinite(rateNumber) || rateNumber < 0) {
      setMessage("Valores inválidos");
      return;
    }
    setBusy(true); setMessage("");
    try {
      await guardarIngresoBorrador({ borradorId, codigoSaft: rubro.codigo, cantidadNegocios: quantityNumber, montoPorNegocio: rateNumber });
      await onChanged();
      setMessage("Guardado");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-emerald-50/30" style={{ contentVisibility: "auto", containIntrinsicSize: "44px" }}>
      <td className="px-3 py-2"><div className="font-semibold text-slate-900">{rubro.codigo}</div><div className="max-w-xl truncate text-[10px] text-slate-500" title={rubro.descripcion}>{rubro.descripcion}</div>{message ? <div className={`text-[10px] ${message === "Guardado" ? "text-emerald-600" : "text-rose-600"}`}>{message}</div> : null}</td>
      <td className="px-3 py-2"><input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-8 w-full border border-slate-300 px-2 text-right tabular-nums" aria-label={`Cantidad de negocios ${rubro.codigo}`} /></td>
      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className="h-8 w-full border border-slate-300 px-2 text-right tabular-nums" aria-label={`Monto por negocio ${rubro.codigo}`} /></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{money(projected)}</td>
      <td className="px-3 py-2 text-center"><button type="button" onClick={() => void save()} disabled={busy || unchanged} className="inline-grid h-8 w-8 place-items-center bg-[#005f48] text-white disabled:bg-slate-200 disabled:text-slate-400" title="Guardar proyección"><Save className="h-3.5 w-3.5" /></button></td>
    </tr>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "strong" }) {
  return <div className={`px-4 py-3 ${tone === "strong" ? "bg-emerald-50" : "bg-white"}`}><div className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</div><div className={`mt-1 text-sm font-semibold tabular-nums ${tone === "strong" ? "text-emerald-800" : "text-slate-900"}`}>{value}</div></div>;
}
