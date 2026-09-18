"use client";

import { Check, ChevronDown, ChevronRight, ListTree, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import CrearObjetoGastoBorrador from "./CrearObjetoGastoBorrador";
import BorradorPresupuestoLayout from "./BorradorPresupuestoLayout";
import {
  BandejaElementosPresupuesto,
  ELEMENTO_PRESUPUESTO_DRAG_TYPE,
  ElementosPresupuestoProvider,
  ReutilizarNivelPresupuesto,
  ZonaInsercionPresupuesto,
} from "./ElementosReutilizablesPresupuesto";
import {
  nombreEsSin, prepararElemento,
  type ElementoParaInsertar, type ElementoInsertado,
} from "@/modules/presupuesto/domain/elementos-presupuesto";
import {
  actualizarMontoCodigoBorrador,
  actualizarNivelBorrador,
  crearNivelBorrador,
  eliminarNivelBorrador,
  obtenerBorradorPresupuesto,
  retirarCodigoBorrador,
  type CodigoBorrador,
  type NivelBorrador,
  type RegistroNivelBorrador,
  type RespuestaBorrador,
} from "@/modules/presupuesto/services/borradorPresupuesto";

const LEVELS: NivelBorrador[] = ["Programa", "SubPrograma", "Proyecto", "Actividad", "Obra"];
const LABELS: Record<NivelBorrador, string> = { Programa: "Programa", SubPrograma: "Subprograma", Proyecto: "Proyecto", Actividad: "Actividad", Obra: "Obra" };
const money = (value: unknown) => (Number(value) || 0).toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });

export default function BorradorGastosWorkspace({ data, onChanged }: { data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [formOpen, setFormOpen] = useState(false);
  const creatingLevel = useRef(false);
  const tree = useMemo(() => makeTree(data), [data]);

  async function insertarElemento(pieza: ElementoParaInsertar, parentId?: string): Promise<ElementoInsertado> {
    if (creatingLevel.current) throw new Error("Espera a que termine la inserción anterior.");
    if (!data.borrador) throw new Error("Primero inicia el borrador presupuestario.");
    creatingLevel.current = true;
    try {
      const actual = await obtenerBorradorPresupuesto(data.borrador.anio);
      if (actual.borrador?.id !== data.borrador.id) throw new Error("El borrador ha cambiado. Recarga antes de continuar.");
      const { fragmento, codigo, nombre, existente } = prepararElemento(actual, pieza, parentId);
      if (existente) {
        await onChanged();
        return { id: existente.id, codigo: existente.codigo, nombre: existente.nombre, existente: true };
      }
      const created = await crearNivelBorrador({
        borradorId: data.borrador.id, nivel: pieza.nivel, parentId,
        fragmento, nombre,
      });
      await onChanged();
      return { id: created.id, codigo, nombre };
    } finally {
      creatingLevel.current = false;
    }
  }

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden bg-white">
      <ElementosPresupuestoProvider key={data.borrador?.id} storageKey={`presupuesto:piezas:v1:${data.borrador?.id}`} onInsertar={insertarElemento}>
        <BorradorPresupuestoLayout data={data} herramientas={<BandejaElementosPresupuesto integrada />}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-3 py-2 sm:px-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-[#003331]"><ListTree className="h-4 w-4 text-emerald-700" aria-hidden="true" />Estructura de gastos</h2>
          <button data-shortcut="203" type="button" onClick={() => setFormOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Formulario
          </button>
        </div>
          <div className="min-h-[280px] min-w-0 flex-1 overflow-auto bg-white pb-4">
            <div className="sticky top-0 z-10 grid min-w-[640px] grid-cols-[1fr_180px] border-b border-slate-200 bg-[#f7f9f8] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>Código / Nombre</span><span className="text-right">Monto</span>
            </div>
            <div className="min-w-[640px]">
              <ZonaInsercionPresupuesto nivel={null} nombre="la raíz del presupuesto" />
              {tree.length ? tree.map((node) => <TreeRow key={node.id} node={node} depth={0} data={data} onChanged={onChanged} />) : <div className="p-6 text-center text-xs text-slate-400">Sin estructura</div>}
            </div>
          </div>
        </BorradorPresupuestoLayout>
      </ElementosPresupuestoProvider>
      {formOpen ? <FloatingBudgetForm data={data} onChanged={onChanged} onCrearNivel={insertarElemento} onClose={() => setFormOpen(false)} /> : null}
    </div>
  );
}

type TreeNode = { id: string; code: string; name: string; level: NivelBorrador | "Codigo"; amount: number; children: TreeNode[]; codigo?: CodigoBorrador };

function makeTree(data: RespuestaBorrador) {
  const programs: TreeNode[] = data.programas.map((row) => ({ id: row.id, code: row.codigo, name: row.nombre, level: "Programa", amount: 0, children: [] }));
  const nodes = new Map<string, TreeNode>(programs.map((node) => [node.id, node]));
  const add = (rows: RegistroNivelBorrador[], parentKey: keyof RegistroNivelBorrador, level: NivelBorrador) => {
    for (const row of rows) {
      const node: TreeNode = { id: row.id, code: row.codigo, name: row.nombre, level, amount: 0, children: [] };
      nodes.set(row.id, node);
      nodes.get(String(row[parentKey]))?.children.push(node);
    }
  };
  add(data.subprogramas, "programa_id", "SubPrograma");
  add(data.proyectos, "subprograma_id", "Proyecto");
  add(data.actividades, "proyecto_id", "Actividad");
  add(data.obras, "actividad_id", "Obra");
  const objetos = new Map(data.objetosGasto.map((item) => [item.id, item.nombre]));
  for (const code of data.codigos) {
    const nombreObjeto = objetos.get(code.objeto) ?? code.objeto;
    const prefix = `${code.objeto} - `;
    const name = nombreObjeto.startsWith(prefix) ? nombreObjeto.slice(prefix.length) : nombreObjeto;
    nodes.get(code.obra_id)?.children.push({ id: code.id, code: code.codigo, name, level: "Codigo", amount: Number(code.monto) || 0, children: [], codigo: code });
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

function TreeRow({ node, depth, data, onChanged }: { node: TreeNode; depth: number; data: RespuestaBorrador; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(depth < 1);
  const [value, setValue] = useState(String(node.amount));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(node.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [codeFormOpen, setCodeFormOpen] = useState(false);
  useEffect(() => setValue(String(node.amount)), [node.amount]);
  useEffect(() => { if (!editing) setEditedName(node.name); }, [editing, node.name]);

  async function rename() {
    if (busy || node.level === "Codigo" || !editedName.trim()) return;
    setBusy(true); setMessage("");
    try {
      await actualizarNivelBorrador({ nivel: node.level, nivelId: node.id, nombre: editedName.trim() });
      await onChanged();
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo editar");
    } finally { setBusy(false); }
  }

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
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (node.level === "Codigo") await retirarCodigoBorrador(node.id);
      else await eliminarNivelBorrador({ nivel: node.level, nivelId: node.id });
      await onChanged();
      setConfirmDelete(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo borrar"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <ZonaInsercionPresupuesto nivel={node.level === "Codigo" ? "Obra" : node.level} id={node.id} nombre={`${node.code} - ${node.name}`} onInserted={() => setOpen(true)} sangria={12 + (depth + 1) * 16}>
      {(acciones) => (
      <div onDragEnter={(event) => {
        if (!node.codigo && event.dataTransfer.types.includes(ELEMENTO_PRESUPUESTO_DRAG_TYPE)) setOpen(true);
      }} className={`group grid min-h-10 grid-cols-[1fr_180px] items-center border-b border-slate-100 px-3 transition-colors hover:bg-emerald-50/50 ${depth === 0 ? "bg-emerald-50/30" : "bg-white"}`} style={{ paddingLeft: 12 + depth * 16 }}>
        <div className="flex min-w-0 items-center gap-1.5">
          {node.codigo ? <span className="ml-2 mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> : <button data-shortcut="204" type="button" onClick={() => setOpen((current) => !current)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white hover:text-emerald-800" aria-expanded={open} aria-label={open ? "Contraer nivel" : "Expandir nivel"}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>}
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600" title={node.level === "Codigo" ? `Fuente ${node.codigo?.fuente} · Tipo ${node.codigo?.tipo_inversion}` : LABELS[node.level]}>{node.code}</span>
          {editing ? <form onSubmit={(event) => { event.preventDefault(); void rename(); }} className="flex min-w-0 flex-1 items-center gap-1">
            <input autoFocus required aria-label="Nombre del nivel" disabled={busy} value={editedName} onChange={(event) => setEditedName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !busy) setEditing(false); }} className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <button type="submit" disabled={busy || !editedName.trim()} title="Guardar · Enter" aria-label="Guardar nombre" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#005f48] text-white disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} title="Cancelar · Esc" aria-label="Cancelar edición" className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400"><X className="h-3.5 w-3.5" /></button>
          </form> : <span className={`min-w-0 truncate text-xs text-slate-900 ${depth === 0 ? "font-semibold" : "font-medium"}`} title={node.name}>{node.name}</span>}
          {node.codigo ? <span className="shrink-0 text-[10px] text-slate-400" title="Fuente / Tipo">{node.codigo.fuente}/{node.codigo.tipo_inversion}</span> : null}
          {node.level !== "Codigo" && !editing && !confirmDelete ? <>
            <ReutilizarNivelPresupuesto nombre={node.name} />
            {node.level === "Obra" ? <button type="button" disabled={busy || data.borrador?.estado !== "BORRADOR"} onClick={() => { setCodeFormOpen((current) => !current); setOpen(true); }} title="Añadir objeto del gasto" aria-label={`Añadir objeto del gasto en ${node.name}`} aria-expanded={codeFormOpen} className="grid h-7 w-7 shrink-0 place-items-center rounded text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button> : acciones}
            <button type="button" disabled={busy} onClick={() => { setEditedName(node.name); setEditing(true); }} title="Editar" aria-label={`Editar ${node.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={busy} onClick={() => { setMessage(""); if (node.children.length) setConfirmDelete(true); else void remove(); }} title="Borrar" aria-label={`Borrar ${node.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
          </> : null}
          {message ? <span role="status" title={message} className={`truncate text-[10px] ${message === "Guardado" ? "text-emerald-600" : "text-rose-600"}`}>{message}</span> : null}
        </div>
        <div className="flex justify-end gap-1">
          {node.codigo ? <><input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-right text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" aria-label={`Monto ${node.code}`} /><button data-shortcut="205" type="button" onClick={() => void save()} disabled={busy} className="grid h-8 w-8 place-items-center rounded-md bg-[#005f48] text-white transition hover:bg-[#003331] disabled:opacity-40" title="Guardar monto"><Save className="h-3.5 w-3.5" /></button><button data-shortcut="206" type="button" onClick={() => void remove()} disabled={busy} className="grid h-8 w-8 place-items-center rounded-md border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-40" title="Retirar código"><Trash2 className="h-3.5 w-3.5" /></button></> : <span className={`text-xs font-semibold tabular-nums ${depth === 0 ? "text-[#003331]" : "text-slate-700"}`}>{money(node.amount)}</span>}
        </div>
      </div>
      )}
      </ZonaInsercionPresupuesto>
      {node.level === "Obra" && codeFormOpen && !confirmDelete ? <div style={{ paddingLeft: 12 + (depth + 1) * 16 }} className="border-b border-emerald-100 bg-emerald-50/40 py-3 pr-3">
        <CrearObjetoGastoBorrador key={node.id} data={data} obraId={node.id} onChanged={onChanged} onCreated={() => setOpen(true)} onClose={() => setCodeFormOpen(false)} />
      </div> : null}
      {confirmDelete ? <div style={{ paddingLeft: 12 + (depth + 1) * 16 }} className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 py-1 pr-3 text-xs text-rose-700">
        <span>Borrar rama · {countNodes(node)} elementos</span>
        <button type="button" disabled={busy} onClick={() => void remove()} className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40">Borrar</button>
        <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} aria-label="Cancelar borrado" className="rounded p-1"><X className="h-3.5 w-3.5" /></button>
      </div> : null}
      {open ? node.children.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} data={data} onChanged={onChanged} />) : null}
    </>
  );
}

function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}

function FloatingBudgetForm({ data, onChanged, onCrearNivel, onClose }: {
  data: RespuestaBorrador;
  onChanged: () => Promise<void>;
  onCrearNivel: (pieza: ElementoParaInsertar, parentId?: string) => Promise<ElementoInsertado>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<NivelBorrador, string>>({ Programa: "", SubPrograma: "", Proyecto: "", Actividad: "", Obra: "" });
  const [creating, setCreating] = useState<NivelBorrador | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const rows: Record<NivelBorrador, RegistroNivelBorrador[]> = { Programa: data.programas, SubPrograma: data.subprogramas, Proyecto: data.proyectos, Actividad: data.actividades, Obra: data.obras };
  const parentField: Partial<Record<NivelBorrador, keyof RegistroNivelBorrador>> = { SubPrograma: "programa_id", Proyecto: "subprograma_id", Actividad: "proyecto_id", Obra: "actividad_id" };

  function options(level: NivelBorrador) { const index = LEVELS.indexOf(level); if (index === 0) return rows[level]; const parent = selected[LEVELS[index - 1]]; return rows[level].filter((row) => row[parentField[level]!] === parent); }
  function choose(level: NivelBorrador, value: string) { const next = { ...selected, [level]: value }; for (const child of LEVELS.slice(LEVELS.indexOf(level) + 1)) next[child] = ""; setSelected(next); setCreating(null); setError(""); }
  function startCreate(level: NivelBorrador) { const index = LEVELS.indexOf(level); if (index > 0 && !selected[LEVELS[index - 1]]) return setError(`Seleccione primero un ${LABELS[LEVELS[index - 1]].toLowerCase()}.`); setCreating(level); setName(""); setError(""); setNotice(""); }
  async function saveLevel() {
    if (busy || !creating || !data.borrador) return;
    if (!name.trim()) return setError("Ingrese el nombre.");

    const createdLevel = creating;
    const index = LEVELS.indexOf(createdLevel);
    setBusy(true);
    setError("");
    try {
      const result = await onCrearNivel({
        id: "formulario",
        tipo: nombreEsSin(name) ? "sin" : "normal",
        nivel: createdLevel,
        nombre: name,
      }, index > 0 ? selected[LEVELS[index - 1]] : undefined);
      setSelected((current) => {
        const next = { ...current, [createdLevel]: result.id };
        for (const child of LEVELS.slice(index + 1)) next[child] = "";
        return next;
      });
      setName("");
      const nextLevel = LEVELS[index + 1] ?? null;
      setCreating(nextLevel);
      setNotice(`${result.codigo} · ${result.nombre}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear el nivel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Crear estructura presupuestaria">
      <button data-shortcut="207" type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="Cerrar formulario" />
      <aside className="absolute left-1/2 top-1/2 flex h-[min(88vh,860px)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-[#f7f9f8] px-4 py-3"><h2 className="text-sm font-semibold text-[#003331]">Crear estructura</h2><button data-shortcut="208" type="button" onClick={onClose} aria-label="Cerrar formulario" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error ? <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}{notice ? <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div> : null}
          <div className="grid gap-2 sm:grid-cols-2">{LEVELS.map((level, index) => <div key={level} className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-600">{LABELS[level]}</span><button data-shortcut="209" type="button" onClick={() => startCreate(level)} disabled={index > 0 && !selected[LEVELS[index - 1]]} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300">+ Nuevo</button></div><select value={selected[level]} onChange={(event) => choose(level, event.target.value)} disabled={index > 0 && !selected[LEVELS[index - 1]]} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"><option value="">Seleccionar…</option>{options(level).map((row) => <option key={row.id} value={row.id}>{row.codigo} - {row.nombre}</option>)}</select></div>)}</div>
          {creating ? <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3"><div className="mb-2 text-xs font-semibold text-[#003331]">Nuevo {LABELS[creating]}</div><Field label="Nombre" value={name} onChange={setName} disabled={busy} /><div className="mt-2 flex gap-2"><button data-shortcut="210" type="button" onClick={() => void saveLevel()} disabled={busy} className="h-8 rounded-lg bg-[#005f48] px-3 text-xs font-semibold text-white hover:bg-[#003331]">Crear</button><button data-shortcut="211" type="button" disabled={busy} onClick={() => setCreating(null)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs hover:bg-slate-50">Cancelar</button></div></div> : null}
          <div className="border-t border-slate-200 pt-4"><h3 className="mb-3 text-xs font-semibold text-[#003331]">Objeto del gasto</h3><CrearObjetoGastoBorrador key={selected.Obra} data={data} obraId={selected.Obra} onChanged={onChanged} disabled={busy} /></div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) { return <label><span className="mb-1 block text-[10px] font-semibold text-slate-500">{label}</span><input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" /></label>; }
