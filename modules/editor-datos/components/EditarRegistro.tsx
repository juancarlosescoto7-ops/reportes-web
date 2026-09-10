"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import Dialogo from "./Dialogo";
import { esNumero, validarValor, type Fila, type Tabla } from "../domain/editor-datos";
import { consultarEditor } from "../services/editor-datos";

export default function EditarRegistro({ tabla, original, cerrar, guardado }: { tabla: Tabla; original: Fila; cerrar: () => void; guardado: () => void }) {
  const [borrador, setBorrador] = useState<Fila>({ ...original });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambios = Object.fromEntries(Object.entries(borrador).filter(([campo, valor]) => campo !== "id" && valor !== original[campo]));
  const cantidad = Object.keys(cambios).length;
  useEffect(() => {
    if (!cantidad) return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cantidad]);

  function intentarCerrar() {
    if (!guardando && (!cantidad || window.confirm("Hay cambios sin guardar. ¿Desea descartarlos?"))) cerrar();
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (guardando || !cantidad) return;
    setError("");
    try {
      for (const columna of tabla.columnas) validarValor(columna, borrador[columna.nombre]);
      setGuardando(true);
      await consultarEditor(new URLSearchParams({ tabla: tabla.nombre }), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original, cambios }) });
      guardado();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }

  return <Dialogo titulo="Editar registro" cerrar={intentarCerrar}>
    <form onSubmit={guardar}>
      <div className="space-y-4 p-6">
        <p className="break-all font-mono text-xs text-slate-500">public.{tabla.nombre} · id: {original.id}</p>
        <p className="text-sm text-slate-600">Los cambios se guardan directamente en Supabase. La clave primaria identifica el registro y es de solo lectura.</p>
        {tabla.columnas.map((columna) => {
          const valor = borrador[columna.nombre];
          const modificado = Object.hasOwn(cambios, columna.nombre);
          return <div key={columna.nombre} className={`rounded-xl border p-3 ${modificado ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={`campo-${columna.nombre}`} className="font-mono text-xs font-semibold">{columna.nombre} <span className="font-normal text-slate-400">{columna.tipo}</span></label>
              {columna.nullable && columna.nombre !== "id" && <label className="flex items-center gap-1.5 text-xs text-slate-500"><input data-shortcut="298" type="checkbox" checked={valor === null} disabled={guardando} onChange={(event) => setBorrador({ ...borrador, [columna.nombre]: event.target.checked ? null : original[columna.nombre] ?? "" })} />NULL</label>}
            </div>
            {columna.tipo === "text" && columna.nombre !== "id" ? <textarea id={`campo-${columna.nombre}`} rows={2} value={valor ?? ""} placeholder={valor === null ? "NULL" : "Texto"} disabled={valor === null || guardando} onChange={(event) => setBorrador({ ...borrador, [columna.nombre]: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100" />
              : <input id={`campo-${columna.nombre}`} type={columna.tipo === "date" ? "date" : "text"} inputMode={esNumero(columna) ? "decimal" : undefined} value={valor ?? ""} placeholder={valor === null ? "NULL" : columna.tipo.startsWith("timestamp") ? "2026-09-10T08:30:00-06:00" : columna.tipo} readOnly={columna.nombre === "id"} disabled={valor === null || guardando} onChange={(event) => setBorrador({ ...borrador, [columna.nombre]: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm read-only:bg-slate-100 disabled:bg-slate-100" />}
            {modificado && <p className="mt-2 break-all text-xs text-amber-800">Antes: {original[columna.nombre] === null ? "NULL" : JSON.stringify(original[columna.nombre])}</p>}
          </div>;
        })}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </div>
      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
        <span className="text-xs text-slate-500">{cantidad} campo(s) modificado(s)</span>
        <div className="flex gap-2"><button data-shortcut="299" type="button" disabled={guardando} onClick={intentarCerrar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancelar</button><button data-shortcut="300" type="submit" disabled={!cantidad || guardando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save size={16} />{guardando ? "Guardando…" : "Guardar cambios"}</button></div>
      </footer>
    </form>
  </Dialogo>;
}
