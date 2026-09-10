"use client";

import { Plus, Save, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { crearRubroIngresoBorrador, guardarIngresoBorrador, type IngresoBorrador, type RespuestaBorrador, type RubroIngresoSaft } from "@/modules/presupuesto/services/borradorPresupuesto";
import { validarRubroIngresoSaft } from "@/modules/presupuesto/domain/rubro-ingreso-saft";

const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });

export default function BorradorIngresosWorkspace({ data, onChanged }: { data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [onlyConfigured, setOnlyConfigured] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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
  const total = data.ingresos.reduce((sum, row) => sum + Number(row.presupuesto_proyectado || 0), 0);

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
    <div className="flex h-full min-h-[640px] flex-col overflow-hidden bg-white">
      <section className="grid shrink-0 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-[1.2fr_1fr_1fr]">
        <Summary label="Ingreso proyectado 15-013-01" value={money(total)} tone="strong" />
        <Summary label="Rubros configurados" value={`${data.ingresos.length} de ${data.rubrosIngresos.length}`} />
        <Summary label="Cálculo" value="Negocios × monto a cobrar" />
      </section>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="relative block min-w-[260px] flex-1 max-w-xl"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cuenta SAFT…" className="h-9 w-full border border-slate-300 bg-white pl-9 pr-3 text-xs" /></label>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"><input data-shortcut="213" type="checkbox" checked={onlyConfigured} onChange={(event) => setOnlyConfigured(event.target.checked)} />Solo rubros configurados</label>
        <button data-shortcut="214" type="button" disabled={creating || data.borrador?.estado !== "BORRADOR"} aria-expanded={showCreate} aria-controls="crear-rubro-saft" onClick={() => { setShowCreate(!showCreate); setCreateError(""); setCreatedMessage(""); }} className="inline-flex h-9 items-center gap-2 bg-[#005f48] px-3 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Nuevo rubro SAFT</button>
      </div>

      {showCreate ? (
        <form id="crear-rubro-saft" onSubmit={createRubro} className="shrink-0 space-y-3 border-b border-emerald-200 bg-emerald-50/50 p-4">
          <div><h2 className="text-sm font-semibold text-slate-900">Nuevo rubro de ingreso SAFT</h2><p className="mt-1 text-xs text-slate-600">Se agregará al catálogo SAFT y a este borrador. No necesitas vincular una cuenta SAMI para crearlo o proyectar ingresos.</p></div>
          <fieldset disabled={creating} className="flex flex-wrap items-end gap-3 disabled:opacity-60">
            <label className="block text-xs font-medium text-slate-700">Código SAFT<input autoFocus required maxLength={100} value={newCode} onChange={(event) => setNewCode(event.target.value)} className="mt-1 block h-9 w-48 border border-slate-300 bg-white px-3" /></label>
            <label className="block min-w-60 flex-1 text-xs font-medium text-slate-700">Descripción<input required maxLength={500} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className="mt-1 block h-9 w-full border border-slate-300 bg-white px-3" /></label>
            <button data-shortcut="215" type="submit" className="h-9 bg-[#005f48] px-4 text-xs font-semibold text-white">{creating ? "Creando…" : "Crear rubro"}</button>
            <button data-shortcut="216" type="button" onClick={() => { setShowCreate(false); setCreateError(""); }} className="h-9 border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700">Cancelar</button>
          </fieldset>
          {createError ? <p role="alert" className="text-xs text-rose-700">{createError}</p> : null}
        </form>
      ) : null}
      {createdMessage ? <p role="status" className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">{createdMessage}</p> : null}

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
      <td className="px-3 py-2 text-center"><button data-shortcut="217" type="button" onClick={() => void save()} disabled={busy || unchanged} className="inline-grid h-8 w-8 place-items-center bg-[#005f48] text-white disabled:bg-slate-200 disabled:text-slate-400" title="Guardar proyección"><Save className="h-3.5 w-3.5" /></button></td>
    </tr>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "strong" }) {
  return <div className={`px-4 py-3 ${tone === "strong" ? "bg-emerald-50" : "bg-white"}`}><div className="text-[9px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</div><div className={`mt-1 text-sm font-semibold tabular-nums ${tone === "strong" ? "text-emerald-800" : "text-slate-900"}`}>{value}</div></div>;
}
