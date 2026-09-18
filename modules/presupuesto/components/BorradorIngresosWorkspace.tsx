"use client";

import { Plus, Save, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { crearRubroIngresoBorrador, guardarIngresoBorrador, type IngresoBorrador, type RespuestaBorrador, type RubroIngresoSaft } from "@/modules/presupuesto/services/borradorPresupuesto";
import { validarRubroIngresoSaft } from "@/modules/presupuesto/domain/rubro-ingreso-saft";
import BorradorPresupuestoLayout from "./BorradorPresupuestoLayout";
import PegarRubrosSaft from "./PegarRubrosSaft";

const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });

export default function BorradorIngresosWorkspace({ data, onChanged }: { data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"manual" | "excel">("manual");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("es-HN"));
  const projections = useMemo(() => new Map(data.ingresos.map((row) => [row.codigo_saft, row])), [data.ingresos]);
  const rows = useMemo(() => data.rubrosIngresos.filter((rubro) => {
    const projection = projections.get(rubro.codigo);
    if (onlyConfigured && !projection) return false;
    if (!deferredSearch) return true;
    return `${rubro.codigo} ${rubro.descripcion}`.toLocaleLowerCase("es-HN").includes(deferredSearch);
  }), [data.rubrosIngresos, deferredSearch, onlyConfigured, projections]);

  async function createRubro(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || !data.borrador) return;
    setCreateError("");
    setCreatedMessage("");
    const rubro = validarRubroIngresoSaft(newCode, newDescription);
    if (rubro.error) { setCreateError(rubro.error); return; }
    if (data.rubrosIngresos.some((row) => row.codigo === rubro.codigoSaft)) {
      setCreateError("Ya existe un rubro con ese código SAFT. Búscalo en la tabla para configurar su proyección.");
      return;
    }
    setCreating(true);
    try {
      await crearRubroIngresoBorrador({ borradorId: data.borrador.id, codigoSaft: rubro.codigoSaft, descripcionSaft: rubro.descripcionSaft });
      setSearch(rubro.codigoSaft);
      setOnlyConfigured(false);
      setNewCode("");
      setNewDescription("");
      setShowCreate(false);
      setCreatedMessage(`Rubro ${rubro.codigoSaft} creado. Ya puedes configurar su proyección.`);
      await onChanged();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "No se pudo crear el rubro.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden bg-white">
      <BorradorPresupuestoLayout data={data}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2 sm:px-4">
        <label className="relative block min-w-[180px] max-w-xl flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Buscar cuenta SAFT" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cuenta SAFT…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" /></label>
        <label className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"><input data-shortcut="213" type="checkbox" checked={onlyConfigured} onChange={(event) => setOnlyConfigured(event.target.checked)} className="accent-[#005f48]" />Configurados {data.ingresos.length}/{data.rubrosIngresos.length}</label>
        <button data-shortcut="214" type="button" disabled={creating || data.borrador?.estado !== "BORRADOR"} aria-expanded={showCreate} aria-controls="crear-rubro-saft" onClick={() => { setShowCreate(!showCreate); setCreateError(""); setCreatedMessage(""); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#005f48] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#003331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"><Plus className="h-4 w-4" />Nuevo rubro</button>
      </div>

      <section id="crear-rubro-saft" hidden={!showCreate} className="max-h-[65vh] shrink-0 space-y-3 overflow-auto border-b border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex flex-wrap gap-2" aria-label="Forma de crear rubros">
          <button data-shortcut="331" type="button" disabled={creating} aria-pressed={createMode === "manual"} onClick={() => setCreateMode("manual")} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${createMode === "manual" ? "border-emerald-700 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}>Ingreso manual</button>
          <button data-shortcut="332" type="button" disabled={creating} aria-pressed={createMode === "excel"} onClick={() => setCreateMode("excel")} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${createMode === "excel" ? "border-emerald-700 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}>Pegar desde Excel</button>
        </div>
        <form hidden={createMode !== "manual"} onSubmit={createRubro} className="space-y-3">
          <h2 className="text-xs font-semibold text-[#003331]">Nuevo rubro SAFT</h2>
          <fieldset disabled={creating} className="flex flex-wrap items-end gap-3 disabled:opacity-60">
            <label className="block text-xs font-medium text-slate-700">Código SAFT<input required maxLength={100} value={newCode} onChange={(event) => setNewCode(event.target.value)} className="mt-1 block h-9 w-48 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <label className="block min-w-60 flex-1 text-xs font-medium text-slate-700">Descripción<input required maxLength={500} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <button data-shortcut="215" type="submit" className="h-9 rounded-lg bg-[#005f48] px-4 text-xs font-semibold text-white transition hover:bg-[#003331]">{creating ? "Creando…" : "Crear rubro"}</button>
            <button data-shortcut="216" type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          </fieldset>
          {createError ? <p role="alert" className="text-xs text-rose-700">{createError}</p> : null}
        </form>
        <div hidden={createMode !== "excel"}>
          {data.borrador ? <PegarRubrosSaft key={data.borrador.id} borradorId={data.borrador.id} rubrosExistentes={data.rubrosIngresos} editable={data.borrador.estado === "BORRADOR"} onChanged={onChanged} onBusyChange={setCreating} /> : null}
        </div>
      </section>
      {createdMessage ? <p role="status" className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">{createdMessage}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto bg-[#f7f9f8] p-2 sm:p-3">
        <div className="min-w-[740px] overflow-clip rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
            <tr><th className="px-3 py-2.5 text-left font-semibold">Cuenta SAFT</th><th className="w-28 px-3 py-2.5 text-right font-semibold">Negocios</th><th className="w-36 px-3 py-2.5 text-right font-semibold">Monto / negocio</th><th className="w-36 px-3 py-2.5 text-right font-semibold">Proyección</th><th className="w-14 px-3 py-2.5 text-center"><span className="sr-only">Guardar</span></th></tr>
          </thead>
          <tbody>
            {rows.map((rubro) => <IncomeRow key={rubro.codigo} rubro={rubro} projection={projections.get(rubro.codigo)} borradorId={data.borrador!.id} onChanged={onChanged} />)}
          </tbody>
        </table>
        {!rows.length ? <div className="p-10 text-center text-sm text-slate-400">No hay rubros que coincidan con la búsqueda.</div> : null}
        </div>
      </div>
      </BorradorPresupuestoLayout>
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
    <tr className="border-t border-slate-100 transition-colors hover:bg-emerald-50/40" style={{ contentVisibility: "auto", containIntrinsicSize: "44px" }}>
      <td className="px-3 py-2"><div className="font-semibold text-slate-900">{rubro.codigo}</div><div className="max-w-xl truncate text-[10px] text-slate-500" title={rubro.descripcion}>{rubro.descripcion}</div>{message ? <div className={`text-[10px] ${message === "Guardado" ? "text-emerald-600" : "text-rose-600"}`}>{message}</div> : null}</td>
      <td className="px-3 py-2"><input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-right tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" aria-label={`Cantidad de negocios ${rubro.codigo}`} /></td>
      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-right tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" aria-label={`Monto por negocio ${rubro.codigo}`} /></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{money(projected)}</td>
      <td className="px-3 py-2 text-center"><button data-shortcut="217" type="button" onClick={() => void save()} disabled={busy || unchanged} className="inline-grid h-8 w-8 place-items-center rounded-md bg-[#005f48] text-white transition hover:bg-[#003331] disabled:bg-slate-100 disabled:text-slate-400" title="Guardar proyección"><Save className="h-3.5 w-3.5" /></button></td>
    </tr>
  );
}
