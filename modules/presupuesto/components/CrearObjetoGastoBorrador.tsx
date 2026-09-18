"use client";

import { Check, X } from "lucide-react";
import { useRef, useState } from "react";

import SearchableSelectField from "@/shared/components/SearchableSelectField";
import { crearCodigoBorrador, type RespuestaBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";

export default function CrearObjetoGastoBorrador({ data, obraId, onChanged, onCreated, onClose, disabled: blocked = false }: {
  data: RespuestaBorrador;
  obraId: string;
  onChanged: () => Promise<void>;
  onCreated?: () => void;
  onClose?: () => void;
  disabled?: boolean;
}) {
  const [objeto, setObjeto] = useState("");
  const [fuente, setFuente] = useState("");
  const [tipo, setTipo] = useState("");
  const [monto, setMonto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const lock = useRef(false);
  const montoRef = useRef<HTMLInputElement>(null);
  const disabled = blocked || busy || !obraId || data.borrador?.estado !== "BORRADOR";

  async function guardar() {
    if (lock.current || disabled) return;
    setError("");
    setMensaje("");
    if (!data.borrador || !obraId || !objeto || !fuente || !tipo || !monto.trim()) {
      setError("Complete objeto, fuente, tipo y monto.");
      return;
    }
    const importe = Number(monto);
    if (!Number.isFinite(importe) || importe < 0) {
      setError("Monto inválido.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await crearCodigoBorrador({
        borradorId: data.borrador.id, obraId, objeto, fuente,
        tipoInversion: tipo, monto: importe,
      });
      await onChanged();
      setObjeto("");
      setMonto("");
      setMensaje("Objeto creado.");
      onCreated?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear el objeto del gasto.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void guardar(); }} onKeyDown={(event) => {
      if (event.key === "Escape" && !lock.current && onClose) { event.stopPropagation(); onClose(); }
    }} className="space-y-2 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
      <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_110px_110px_100px_auto]">
        <SearchableSelectField label="Objeto del gasto" value={objeto} options={data.objetosGasto} disabled={disabled} onChange={(value) => {
          setObjeto(value);
          if (value && fuente && tipo) requestAnimationFrame(() => montoRef.current?.focus());
        }} placeholder="Código o descripción…" />
        <label className="block"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Fuente</span>
          <select aria-label="Fuente de financiamiento" value={fuente} disabled={disabled} onChange={(event) => setFuente(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50">
            <option value="">Fuente…</option>
            {data.fuentes.map((item) => <option key={item.fuente} value={item.fuente}>{item.fuente} - {item.nombre_fuente || "Fuente"}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Tipo</span>
          <select value={tipo} disabled={disabled} onChange={(event) => setTipo(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50">
            <option value="">Tipo…</option><option value="10">10 - Corriente</option><option value="20">20 - Capital</option>
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Monto (L)</span>
          <input ref={montoRef} required type="number" min="0" step="0.01" value={monto} disabled={disabled} onChange={(event) => setMonto(event.target.value)} placeholder="0.00" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-right text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50" />
        </label>
        <div className="flex items-center gap-1">
          <button data-shortcut="212" type="submit" disabled={disabled || !objeto || !fuente || !tipo || !monto.trim()} title="Crear objeto del gasto · Enter" aria-label="Crear objeto del gasto" className="grid h-9 w-9 place-items-center rounded-lg bg-[#005f48] text-white transition hover:bg-[#003331] disabled:opacity-40"><Check className="h-4 w-4" /></button>
          {onClose ? <button type="button" disabled={busy} onClick={onClose} title="Cerrar · Esc" aria-label="Cerrar creador de objeto del gasto" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
        </div>
      </div>
      {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
      <span className="sr-only" aria-live="polite">{busy ? "Guardando…" : mensaje}</span>
    </form>
  );
}
