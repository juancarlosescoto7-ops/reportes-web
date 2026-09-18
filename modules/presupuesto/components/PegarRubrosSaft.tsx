"use client";

import { useMemo, useRef, useState } from "react";
import { leerRubrosSaftPegados } from "@/modules/presupuesto/domain/rubro-ingreso-saft";
import { importarRubrosIngresoBorrador, type EstadoCargaRubro, type RubroIngresoSaft } from "@/modules/presupuesto/services/borradorPresupuesto";

const money = (value: number) => value.toLocaleString("es-HN", { style: "currency", currency: "HNL" });

export default function PegarRubrosSaft({ borradorId, rubrosExistentes, editable, onChanged, onBusyChange }: {
  borradorId: string;
  rubrosExistentes: RubroIngresoSaft[];
  editable: boolean;
  onChanged: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const guardando = useRef(false);
  const estados = useRef(new Map<string, EstadoCargaRubro>());
  const [progreso, setProgreso] = useState(new Map<string, EstadoCargaRubro>());
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const filas = useMemo(() => leerRubrosSaftPegados(texto), [texto]);
  const existentes = useMemo(() => new Set(rubrosExistentes.map((rubro) => rubro.codigo)), [rubrosExistentes]);
  const errorFila = (fila: typeof filas[number]) => fila.error || (existentes.has(fila.codigoSaft) && !progreso.has(fila.codigoSaft) ? "Este código ya existe. Configura su proyección en la tabla de ingresos." : "");
  const errores = filas.some((fila) => errorFila(fila));
  const guardados = [...progreso.values()].filter((estado) => estado === "guardado").length;
  const completo = filas.length > 0 && guardados === filas.length;
  const total = filas.reduce((sum, fila) => sum + Math.round((fila.monto ?? 0) * 100), 0) / 100;

  async function guardar() {
    if (guardando.current || !editable || errores || !filas.length || completo) return;
    guardando.current = true;
    setBusy(true); onBusyChange(true); setError(""); setMensaje("");
    try {
      await importarRubrosIngresoBorrador({
        borradorId,
        rubros: filas.map((fila) => ({ codigoSaft: fila.codigoSaft, descripcionSaft: fila.descripcionSaft, monto: fila.monto! })),
        estados: estados.current,
        onProgress: () => setProgreso(new Map(estados.current)),
      });
      setMensaje(`${filas.length} rubros cargados con su total proyectado.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la carga.");
    } finally {
      try { await onChanged(); }
      catch { setError((previous) => `${previous ? `${previous} ` : ""}No se pudo actualizar la tabla. Recarga la página para consultar los datos guardados.`); }
      guardando.current = false;
      setBusy(false); onBusyChange(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Cargar rubros desde Excel" aria-busy={busy}>
      <label className="block text-xs font-medium text-slate-700">
        Pega las columnas Código, Nombre y Monto
        <textarea rows={4} value={texto} disabled={busy || progreso.size > 0 || !editable} onChange={(event) => { setTexto(event.target.value); setError(""); setMensaje(""); }} aria-describedby="ayuda-pegar-saft" placeholder={"Código\tNombre\tMonto\n001111\tImpuesto sobre bienes inmuebles\t12500.00"} className="mt-1 block w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
      </label>
      <p id="ayuda-pegar-saft" className="text-xs text-slate-600">Copia las tres columnas de Excel y pégalas aquí con Ctrl+V, con o sin encabezados. Monto corresponde al total proyectado; se registrará con 1 negocio para conservar ese total.</p>
      {filas.length ? <>
        <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Fila</th><th className="p-2">Código</th><th className="p-2">Nombre</th><th className="p-2 text-right">Monto</th><th className="p-2">Estado</th></tr></thead>
            <tbody>{filas.map((fila) => {
              const problema = errorFila(fila);
              const estado = progreso.get(fila.codigoSaft);
              return <tr key={fila.fila} className={`border-t border-slate-100 ${problema ? "bg-rose-50" : ""}`}>
                <td className="p-2">{fila.fila}</td><td className="p-2 font-semibold">{fila.codigoSaft}</td><td className="whitespace-pre-wrap p-2">{fila.descripcionSaft}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{fila.monto === null ? "—" : money(fila.monto)}</td>
                <td className={`p-2 ${problema ? "text-rose-700" : "text-emerald-800"}`}>{problema || (estado === "guardado" ? "Guardado" : estado === "creado" ? "Creado; monto pendiente" : "Listo para crear")}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p role="status" className="text-xs font-medium text-slate-700">{filas.length} rubros · Total: {money(total)}{progreso.size ? ` · ${guardados} guardados` : ""}</p>
      </> : null}
      {errores ? <p role="alert" className="text-xs text-rose-700">Corrige las filas señaladas antes de cargar los rubros.</p> : null}
      {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
      {mensaje ? <p role="status" className="text-xs text-emerald-800">{mensaje}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button data-shortcut="347" type="button" disabled={busy || !editable || errores || !filas.length || completo} onClick={() => void guardar()} className="h-9 rounded-lg bg-[#005f48] px-4 text-xs font-semibold text-white hover:bg-[#003331] disabled:opacity-50">{busy ? "Cargando…" : progreso.size && !completo ? "Reintentar pendientes" : "Cargar rubros"}</button>
        <button data-shortcut="348" type="button" disabled={busy || (progreso.size > 0 && !completo)} onClick={() => { setTexto(""); estados.current.clear(); setProgreso(new Map()); setError(""); setMensaje(""); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{completo ? "Pegar más rubros" : "Limpiar"}</button>
      </div>
    </section>
  );
}
