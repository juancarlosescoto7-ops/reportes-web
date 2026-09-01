"use client";

import { ChevronDown, ChevronRight, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import SearchableSelectField from "@/components/SearchableSelectField";
import {
  actualizarMontoCodigoBorrador,
  crearCodigoBorrador,
  crearNivelBorrador,
  retirarCodigoBorrador,
  type CodigoBorrador,
  type NivelBorrador,
  type RegistroNivelBorrador,
  type RespuestaBorrador,
} from "@/services/borradorPresupuesto";

const LEVELS: NivelBorrador[] = ["Programa", "SubPrograma", "Proyecto", "Actividad", "Obra"];
const LABELS: Record<NivelBorrador, string> = { Programa: "Programa", SubPrograma: "Subprograma", Proyecto: "Proyecto", Actividad: "Actividad", Obra: "Obra" };
const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });

export default function BorradorGastosWorkspace({ data, onChanged }: { data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [formOpen, setFormOpen] = useState(false);
  const tree = useMemo(() => makeTree(data), [data]);

  return (
    <div className="relative flex h-full min-h-[640px] flex-col overflow-hidden">
      <CeilingColumns data={data} />
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <div className="sticky top-0 z-10 grid min-w-[760px] grid-cols-[1fr_180px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          <span>Árbol presupuestario del borrador</span><span className="text-right">Monto formulado</span>
        </div>
        <div className="min-w-[760px]">
          {tree.length ? tree.map((node) => <TreeRow key={node.id} node={node} depth={0} onChanged={onChanged} />) : <div className="p-10 text-center text-sm text-slate-400">No hay estructura. Utilice el botón flotante para crear el primer programa.</div>}
        </div>
      </div>
      <button type="button" onClick={() => setFormOpen(true)} className="absolute bottom-5 right-5 z-20 inline-flex h-11 items-center gap-2 rounded-full bg-[#005f48] px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20">
        <Plus className="h-4 w-4" /> Crear
      </button>
      {formOpen ? <FloatingBudgetForm data={data} onChanged={onChanged} onClose={() => setFormOpen(false)} /> : null}
    </div>
  );
}

function CeilingColumns({ data }: { data: RespuestaBorrador }) {
  return (
    <section aria-label="Techos disponibles" className="shrink-0 border-b border-slate-200 bg-[#003331] p-2">
      <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200">Techos disponibles</div>
      <div className="grid auto-cols-[minmax(145px,1fr)] grid-flow-col gap-px overflow-x-auto bg-emerald-900">
        {data.controlTechos.map((row) => (
          <div key={`${row.fuente}-${row.nivel_aplicacion}-${row.id_nivel}`} className="bg-[#004c43] px-3 py-2 text-white">
            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-200" title={`${row.fuente} · ${row.nivel_aplicacion} ${row.id_nivel}`}>
              {row.fuente} · {row.nivel_aplicacion === "programa" ? "Programa" : "Tipo"} {row.id_nivel}
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums">{money(row.monto_disponible)}</div>
            <div className="mt-0.5 text-[9px] text-emerald-200">de {money(row.monto_permitido)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

type TreeNode = { id: string; code: string; name: string; level: string; amount: number; children: TreeNode[]; codigo?: CodigoBorrador };

function makeTree(data: RespuestaBorrador) {
  const programs: TreeNode[] = data.programas.map((row) => ({ id: row.id, code: row.codigo, name: row.nombre, level: "Programa", amount: 0, children: [] }));
  const nodes = new Map<string, TreeNode>(programs.map((node) => [node.id, node]));
  const add = (rows: RegistroNivelBorrador[], parentKey: keyof RegistroNivelBorrador, level: string) => {
    for (const row of rows) {
      const node: TreeNode = { id: row.id, code: row.codigo, name: row.nombre, level, amount: 0, children: [] };
      nodes.set(row.id, node);
      nodes.get(String(row[parentKey]))?.children.push(node);
    }
  };
  add(data.subprogramas, "programa_id", "Subprograma");
  add(data.proyectos, "subprograma_id", "Proyecto");
  add(data.actividades, "proyecto_id", "Actividad");
  add(data.obras, "actividad_id", "Obra");
  for (const code of data.codigos) {
    nodes.get(code.obra_id)?.children.push({ id: code.id, code: code.codigo, name: code.objeto, level: "Código", amount: Number(code.monto) || 0, children: [], codigo: code });
  }
  const total = (node: TreeNode): number => {
    if (node.codigo) return node.amount;
    node.amount = node.children.reduce((sum, child) => sum + total(child), 0);
    node.children.sort((a, b) => a.code.localeCompare(b.code, "es-HN", { numeric: true }));
    return node.amount;
  };
  programs.forEach(total);
  return programs.sort((a, b) => a.code.localeCompare(b.code, "es-HN", { numeric: true }));
}

function TreeRow({ node, depth, onChanged }: { node: TreeNode; depth: number; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(depth < 1);
  const [value, setValue] = useState(String(node.amount));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setValue(String(node.amount)), [node.amount]);

  async function save() {
    if (!node.codigo) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return setMessage("Monto inválido");
    setBusy(true); setMessage("");
    try { await actualizarMontoCodigoBorrador({ codigoId: node.id, monto: amount }); await onChanged(); setMessage("Guardado"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!node.codigo) return;
    setBusy(true); setMessage("");
    try { await retirarCodigoBorrador(node.id); await onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo retirar"); setBusy(false); }
  }

  return (
    <>
      <div className="grid min-h-12 grid-cols-[1fr_180px] items-center border-b border-slate-100 px-3 hover:bg-emerald-50/30" style={{ paddingLeft: 12 + depth * 18 }}>
        <div className="flex min-w-0 items-center gap-2">
          {node.codigo ? <span className="h-1.5 w-1.5 shrink-0 bg-emerald-500" /> : <button type="button" onClick={() => setOpen((current) => !current)} className="grid h-7 w-7 shrink-0 place-items-center text-slate-500" aria-label={open ? "Contraer nivel" : "Expandir nivel"}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>}
          <div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-900">{node.code} - {node.name}</div><div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">{node.level}{node.codigo ? ` · ${node.codigo.fuente} · tipo ${node.codigo.tipo_inversion}` : ""}</div>{message ? <div className={`text-[10px] ${message === "Guardado" ? "text-emerald-600" : "text-rose-600"}`}>{message}</div> : null}</div>
        </div>
        <div className="flex justify-end gap-1">
          {node.codigo ? <><input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} className="h-8 w-28 border border-slate-300 px-2 text-right text-xs" aria-label={`Monto ${node.code}`} /><button type="button" onClick={() => void save()} disabled={busy} className="grid h-8 w-8 place-items-center bg-[#005f48] text-white disabled:opacity-40" title="Guardar monto"><Save className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void remove()} disabled={busy} className="grid h-8 w-8 place-items-center border border-rose-200 text-rose-600 disabled:opacity-40" title="Retirar código"><Trash2 className="h-3.5 w-3.5" /></button></> : <span className="text-xs font-semibold tabular-nums text-slate-800">{money(node.amount)}</span>}
        </div>
      </div>
      {open ? node.children.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} onChanged={onChanged} />) : null}
    </>
  );
}

function FloatingBudgetForm({ data, onChanged, onClose }: { data: RespuestaBorrador; onChanged: () => Promise<void>; onClose: () => void }) {
  const [selected, setSelected] = useState<Record<NivelBorrador, string>>({ Programa: "", SubPrograma: "", Proyecto: "", Actividad: "", Obra: "" });
  const [creating, setCreating] = useState<NivelBorrador | null>(null);
  const [fragment, setFragment] = useState(""); const [name, setName] = useState("");
  const [object, setObject] = useState(""); const [source, setSource] = useState(""); const [type, setType] = useState(""); const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const rows: Record<NivelBorrador, RegistroNivelBorrador[]> = { Programa: data.programas, SubPrograma: data.subprogramas, Proyecto: data.proyectos, Actividad: data.actividades, Obra: data.obras };
  const parentField: Partial<Record<NivelBorrador, keyof RegistroNivelBorrador>> = { SubPrograma: "programa_id", Proyecto: "subprograma_id", Actividad: "proyecto_id", Obra: "actividad_id" };

  function options(level: NivelBorrador) { const index = LEVELS.indexOf(level); if (index === 0) return rows[level]; const parent = selected[LEVELS[index - 1]]; return rows[level].filter((row) => row[parentField[level]!] === parent); }
  function choose(level: NivelBorrador, value: string) { const next = { ...selected, [level]: value }; for (const child of LEVELS.slice(LEVELS.indexOf(level) + 1)) next[child] = ""; setSelected(next); setCreating(null); setError(""); }
  function startCreate(level: NivelBorrador) { const index = LEVELS.indexOf(level); if (index > 0 && !selected[LEVELS[index - 1]]) return setError(`Seleccione primero un ${LABELS[LEVELS[index - 1]].toLowerCase()}.`); setCreating(level); setFragment(""); setName(""); setError(""); setNotice(""); }
  async function saveLevel() {
    if (!creating || !data.borrador) return;
    if (!fragment.trim() || !name.trim()) return setError("Ingrese el código y nombre.");

    const createdLevel = creating;
    const index = LEVELS.indexOf(createdLevel);
    setBusy(true);
    setError("");
    try {
      const result = await crearNivelBorrador({
        borradorId: data.borrador.id,
        nivel: createdLevel,
        parentId: index > 0 ? selected[LEVELS[index - 1]] : undefined,
        fragmento: fragment,
        nombre: name,
      });
      await onChanged();
      setSelected((current) => {
        const next = { ...current, [createdLevel]: result.id };
        for (const child of LEVELS.slice(index + 1)) next[child] = "";
        return next;
      });
      setFragment("");
      setName("");
      const nextLevel = LEVELS[index + 1] ?? null;
      setCreating(nextLevel);
      setNotice(
        nextLevel
          ? `${LABELS[createdLevel]} creado y seleccionado. Continúe con ${LABELS[nextLevel].toLowerCase()}.`
          : `${LABELS[createdLevel]} creada y seleccionada. Ya puede crear códigos presupuestarios.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear el nivel.");
    } finally {
      setBusy(false);
    }
  }
  async function saveCode() { if (!data.borrador || !selected.Obra || !object || !source || !type || amount === "") return setError("Complete obra, objeto, fuente, tipo y monto."); const numeric = Number(amount); if (!Number.isFinite(numeric) || numeric < 0) return setError("Monto inválido."); setBusy(true); try { await crearCodigoBorrador({ borradorId: data.borrador.id, obraId: selected.Obra, objeto: object, fuente: source, tipoInversion: type, monto: numeric }); await onChanged(); setObject(""); setAmount(""); setNotice("Código creado; techos actualizados."); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo crear el código."); } finally { setBusy(false); } }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35" role="dialog" aria-modal="true" aria-label="Crear estructura presupuestaria">
      <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" />
      <aside className="absolute left-1/2 top-1/2 flex h-[min(88vh,860px)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">Formulario flotante</div><h2 className="text-sm font-semibold">Crear nivel o código</h2></div><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center border"><X className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error ? <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}{notice ? <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div> : null}
          <div className="grid gap-2 sm:grid-cols-2">{LEVELS.map((level, index) => <div key={level} className="border border-slate-200 p-2"><div className="mb-1 flex items-center justify-between"><span className="text-[9px] font-bold uppercase text-slate-500">{LABELS[level]}</span><button type="button" onClick={() => startCreate(level)} disabled={index > 0 && !selected[LEVELS[index - 1]]} className="text-[10px] font-semibold text-emerald-700 disabled:text-slate-300">+ Nuevo</button></div><select value={selected[level]} onChange={(event) => choose(level, event.target.value)} disabled={index > 0 && !selected[LEVELS[index - 1]]} className="h-8 w-full border bg-white px-2 text-[11px] disabled:bg-slate-100"><option value="">Seleccionar…</option>{options(level).map((row) => <option key={row.id} value={row.id}>{row.codigo} - {row.nombre}</option>)}</select></div>)}</div>
          {creating ? <div className="border border-emerald-200 bg-emerald-50/40 p-3"><div className="mb-2 text-xs font-semibold">Nuevo {LABELS[creating]}</div><div className="grid gap-2 sm:grid-cols-2"><Field label="Código" value={fragment} onChange={setFragment} /><Field label="Nombre" value={name} onChange={setName} /></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => void saveLevel()} disabled={busy} className="h-8 bg-[#005f48] px-3 text-xs font-semibold text-white">Crear nivel</button><button type="button" onClick={() => setCreating(null)} className="h-8 border px-3 text-xs">Cancelar</button></div></div> : null}
          <div className="border-t pt-4"><h3 className="text-xs font-semibold">Código presupuestario</h3><div className="mt-3 space-y-3"><SearchableSelectField label="Objeto del gasto" value={object} options={data.objetosGasto} disabled={!selected.Obra} onChange={setObject} placeholder="Buscar objeto…" /><div className="grid gap-2 sm:grid-cols-2"><Select label="Fuente" value={source} onChange={setSource} disabled={!selected.Obra} options={data.fuentes.map((item) => ({ id: item.fuente, name: `${item.fuente} - ${item.nombre_fuente || "Fuente"}` }))} /><Select label="Tipo" value={type} onChange={setType} disabled={!selected.Obra} options={[{ id: "10", name: "10 - Gasto corriente" }, { id: "20", name: "20 - Gasto de capital" }]} /></div><Field label="Monto" value={amount} onChange={setAmount} type="number" disabled={!selected.Obra} /><button type="button" onClick={() => void saveCode()} disabled={busy || !selected.Obra} className="h-9 w-full bg-[#003331] text-xs font-semibold text-white disabled:opacity-40">Crear código y consumir techo</button></div></div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) { return <label><span className="mb-1 block text-[9px] font-bold uppercase text-slate-500">{label}</span><input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 w-full border border-slate-300 px-3 text-xs disabled:bg-slate-100" /></label>; }
function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[]; disabled: boolean }) { return <label><span className="mb-1 block text-[9px] font-bold uppercase text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 w-full border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100"><option value="">Seleccionar…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>; }
