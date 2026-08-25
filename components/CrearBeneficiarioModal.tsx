"use client";

import { LoaderCircle, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { crearBeneficiario } from "@/services/beneficiarios.service";

export default function CrearBeneficiarioModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [id, setId] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [creado, setCreado] = useState("");

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!open) return null;

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setGuardando(true);
      setError("");
      const beneficiario = await crearBeneficiario({ id, nombre });
      setCreado(`${beneficiario.nombre} · ${beneficiario.id}`);
      setId("");
      setNombre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el beneficiario.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[180] grid place-items-center bg-[#071a19]/65 p-4 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="crear-beneficiario-titulo" className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserPlus className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Acción rápida</p>
              <h2 id="crear-beneficiario-titulo" className="mt-0.5 text-lg font-bold tracking-tight text-slate-950">Nuevo beneficiario</h2>
              <p className="mt-1 text-xs text-slate-500">Registre el beneficiario sin abandonar la pantalla actual.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={guardar} className="grid gap-4 p-5">
          {creado && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span className="font-semibold">Beneficiario creado:</span> {creado}</div>}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">ID o identidad<input ref={inputRef} value={id} onChange={(event) => setId(event.target.value)} disabled={guardando} placeholder="Ej. RTN o número de identidad" className="h-11 rounded-lg border px-3 text-sm font-normal" /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Nombre del beneficiario<input value={nombre} onChange={(event) => setNombre(event.target.value)} disabled={guardando} placeholder="Nombre completo o razón social" className="h-11 rounded-lg border px-3 text-sm font-normal" /></label>
          <div className="mt-1 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={guardando} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={guardando || !id.trim() || !nombre.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#003331] px-5 text-xs font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40">{guardando && <LoaderCircle className="h-4 w-4 animate-spin" />}{guardando ? "Guardando" : "Crear beneficiario"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
