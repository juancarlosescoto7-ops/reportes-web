"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Check, Copy, MousePointer2, RotateCcw, X } from "lucide-react";
import { calcular, formatearCifra, leerCifra, type Operacion } from "../domain/calculo-rapido";
import { cifraEnPunto } from "../domain/cifra-pantalla";

const operaciones: { valor: Operacion; simbolo: string; nombre: string }[] = [
  { valor: "+", simbolo: "+", nombre: "Sumar" },
  { valor: "-", simbolo: "−", nombre: "Restar" },
  { valor: "*", simbolo: "×", nombre: "Multiplicar" },
  { valor: "/", simbolo: "÷", nombre: "Dividir" },
];

export default function CalculoRapido() {
  const [host, setHost] = useState<Element | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [primera, setPrimera] = useState("");
  const [segunda, setSegunda] = useState("");
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [seleccionando, setSeleccionando] = useState<"primera" | "segunda" | null>(null);
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const campoPrimera = useRef<HTMLInputElement>(null);
  const campoSegunda = useRef<HTMLInputElement>(null);
  const campoResultado = useRef<HTMLInputElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const resaltado = useRef<Element | null>(null);
  const capturando = useRef(false);
  const altUsado = useRef(false);

  const a = leerCifra(primera);
  const b = leerCifra(segunda);
  const resultado = a !== null && b !== null && operacion ? calcular(a, operacion, b) : null;

  function limpiarResaltado() {
    resaltado.current?.removeAttribute("data-cifra-calculo");
    resaltado.current = null;
  }
  function abrir() {
    if (!abierto) {
      focoPrevio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setHost(Array.from(document.querySelectorAll("dialog[open]")).at(-1) ?? document.body);
    }
    setAbierto(true);
  }
  function cerrar() {
    setAbierto(false);
    setSeleccionando(null);
    setAviso("");
    limpiarResaltado();
    focoPrevio.current?.focus({ preventScroll: true });
  }
  function reiniciar() {
    setPrimera(""); setSegunda(""); setOperacion(null); setAviso(""); setCopiado(false); setSeleccionando(null);
    campoPrimera.current?.focus();
  }
  function elegirOperacion(valor: Operacion) {
    setOperacion(valor); setCopiado(false); setAviso(""); setSeleccionando(null);
    campoSegunda.current?.focus();
  }
  function tomarCifra(valor: number) {
    abrir();
    const destino = seleccionando ?? (!abierto || !operacion ? "primera" : "segunda");
    if (!abierto) { setOperacion(null); setSegunda(""); }
    if (destino === "primera") setPrimera(String(valor));
    else setSegunda(String(valor));
    setSeleccionando(null); setAviso(""); setCopiado(false);
    limpiarResaltado();
  }
  async function copiar() {
    if (resultado?.valor === null || resultado?.valor === undefined) return;
    try {
      await navigator.clipboard.writeText(String(resultado.valor));
      setCopiado(true); setAviso("");
    } catch {
      campoResultado.current?.focus(); campoResultado.current?.select();
      setAviso("Seleccioné el resultado. Usa Ctrl + C o Cmd + C para copiarlo.");
    }
  }

  const manejarPuntero = useEffectEvent((event: PointerEvent) => {
    limpiarResaltado();
    if ((!event.altKey || event.ctrlKey || event.metaKey) && !seleccionando) return;
    const cifra = cifraEnPunto(event.target, event.clientX, event.clientY);
    if (cifra) { resaltado.current = cifra.elemento; cifra.elemento.setAttribute("data-cifra-calculo", ""); }
  });
  const manejarPresion = useEffectEvent((event: PointerEvent) => {
    capturando.current = false;
    if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest("[data-calculo-rapido]")) return;
    if ((!event.altKey || event.ctrlKey || event.metaKey) && !seleccionando) return;
    const cifra = cifraEnPunto(event.target, event.clientX, event.clientY);
    // Capturar antes de los eventos de filas, enlaces y formularios.
    if (!cifra && !seleccionando) return;
    event.preventDefault(); event.stopImmediatePropagation();
    capturando.current = true;
    altUsado.current = event.altKey;
    if (cifra) tomarCifra(cifra.valor);
    else setAviso("Haz clic directamente sobre una cifra visible.");
  });
  const manejarTecla = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.getModifierState("AltGraph")) return;
    if (event.key === "Escape" && abierto) {
      event.preventDefault(); event.stopImmediatePropagation(); cerrar(); return;
    }
    if (!abierto) return;
    const editable = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
    const enPanel = event.target instanceof Element && event.target.closest("[data-calculo-rapido]");
    if (editable && !enPanel) return;
    const op = operaciones.find((item) => item.valor === event.key || item.simbolo === event.key);
    // En los campos, el signo menos se conserva para escribir números negativos.
    if (op && (!editable || event.key !== "-" || !operacion)) {
      event.preventDefault(); event.stopImmediatePropagation(); elegirOperacion(op.valor); return;
    }
    if (event.key === "Enter" && enPanel) {
      event.preventDefault(); event.stopImmediatePropagation(); campoResultado.current?.focus(); campoResultado.current?.select();
    }
    // Alt puede convertir cifras en caracteres especiales en algunos teclados.
    const digito = event.code.match(/^(?:Digit|Numpad)(\d)$/)?.[1];
    if (event.altKey && digito) {
      event.preventDefault(); event.stopImmediatePropagation(); altUsado.current = true;
      const campo = operacion ? campoSegunda.current : campoPrimera.current;
      const valor = operacion ? segunda : primera;
      const desde = document.activeElement === campo ? campo?.selectionStart ?? valor.length : valor.length;
      const hasta = document.activeElement === campo ? campo?.selectionEnd ?? valor.length : valor.length;
      const siguiente = valor.slice(0, desde) + digito + valor.slice(hasta);
      if (operacion) setSegunda(siguiente); else setPrimera(siguiente);
      setCopiado(false);
      campo?.focus();
    } else if (!editable && /^[\d.,]$/.test(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (operacion) { setSegunda((valor) => valor + event.key); campoSegunda.current?.focus(); }
      else { setPrimera((valor) => valor + event.key); campoPrimera.current?.focus(); }
      setCopiado(false);
    }
  });

  useEffect(() => {
    const mover = (event: PointerEvent) => manejarPuntero(event);
    const presionar = (event: PointerEvent) => manejarPresion(event);
    const tecla = (event: KeyboardEvent) => manejarTecla(event);
    const soltar = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      limpiarResaltado();
      if (altUsado.current) { event.preventDefault(); altUsado.current = false; }
    };
    const bloquear = (event: Event) => {
      if (!capturando.current) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === "click") capturando.current = false;
    };
    const desenfocar = () => { limpiarResaltado(); capturando.current = false; altUsado.current = false; };
    window.addEventListener("pointermove", mover, true);
    window.addEventListener("pointerdown", presionar, true);
    window.addEventListener("keydown", tecla, true);
    window.addEventListener("keyup", soltar, true);
    window.addEventListener("blur", desenfocar);
    for (const nombre of ["mousedown", "mouseup", "pointerup", "click", "dblclick"]) window.addEventListener(nombre, bloquear, true);
    return () => {
      limpiarResaltado();
      window.removeEventListener("pointermove", mover, true);
      window.removeEventListener("pointerdown", presionar, true);
      window.removeEventListener("keydown", tecla, true);
      window.removeEventListener("keyup", soltar, true);
      window.removeEventListener("blur", desenfocar);
      for (const nombre of ["mousedown", "mouseup", "pointerup", "click", "dblclick"]) window.removeEventListener(nombre, bloquear, true);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.showPopover();
    campoPrimera.current?.focus({ preventScroll: true });
  }, [abierto, host]);

  return <>
    <button type="button" data-calculo-rapido onClick={() => { if (abierto) cerrar(); else abrir(); }} title="Cálculo rápido: Alt + clic sobre una cifra" aria-label="Abrir cálculo rápido" aria-expanded={abierto} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50">
      <Calculator className="h-4 w-4" aria-hidden="true" /><span className="hidden xl:inline">Cálculo</span>
    </button>
    {abierto && host && createPortal(<div ref={panel} popover="manual" role="dialog" aria-modal="false" aria-labelledby="titulo-calculo-rapido" data-calculo-rapido className="fixed inset-auto bottom-20 right-3 z-[300] m-0 max-h-[calc(100dvh-6rem)] w-[min(360px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-4 text-left text-slate-900 shadow-2xl sm:bottom-5 sm:right-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-calculo-rapido" className="flex items-center gap-2 text-sm font-bold"><Calculator className="h-4 w-4 text-emerald-700" />Cálculo rápido</h2>
        <div className="flex gap-1">
          <button type="button" onClick={reiniciar} aria-label="Nuevo cálculo" title="Nuevo cálculo" className="rounded-lg p-2 hover:bg-slate-100"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={cerrar} aria-label="Cerrar cálculo rápido" title="Cerrar (Esc)" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">Mantén <kbd className="rounded border px-1 font-semibold">Alt</kbd> y haz clic en una cifra. Elige la operación y toma otra cifra o escríbela. Puedes soltar Alt.</p>
      <label htmlFor="calculo-primera" className="text-xs font-semibold text-slate-600">Primera cifra</label>
      <div className="mt-1 flex gap-2">
        <input id="calculo-primera" ref={campoPrimera} inputMode="decimal" autoComplete="off" value={primera} onChange={(event) => { setPrimera(event.target.value); setCopiado(false); setAviso(""); }} placeholder="Ej. 1,250.50" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        <button type="button" aria-label="Elegir primera cifra de la pantalla" aria-pressed={seleccionando === "primera"} onClick={() => setSeleccionando(seleccionando === "primera" ? null : "primera")} className="rounded-lg border border-slate-200 px-3 text-emerald-700 hover:bg-emerald-50 aria-pressed:bg-emerald-100"><MousePointer2 className="h-4 w-4" /></button>
      </div>
      <div role="group" aria-label="Operación" className="my-3 grid grid-cols-4 gap-2">
        {operaciones.map((item) => <button key={item.valor} type="button" aria-label={item.nombre} aria-pressed={operacion === item.valor} onClick={() => elegirOperacion(item.valor)} className="rounded-lg border border-slate-200 py-2 text-lg font-semibold hover:bg-emerald-50 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-700 aria-pressed:text-white">{item.simbolo}</button>)}
      </div>
      <label htmlFor="calculo-segunda" className="text-xs font-semibold text-slate-600">Segunda cifra</label>
      <div className="mt-1 flex gap-2">
        <input id="calculo-segunda" ref={campoSegunda} inputMode="decimal" autoComplete="off" value={segunda} onChange={(event) => { setSegunda(event.target.value); setCopiado(false); setAviso(""); }} placeholder="Escribe o elige otra cifra" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        <button type="button" aria-label="Elegir segunda cifra de la pantalla" aria-pressed={seleccionando === "segunda"} onClick={() => setSeleccionando(seleccionando === "segunda" ? null : "segunda")} className="rounded-lg border border-slate-200 px-3 text-emerald-700 hover:bg-emerald-50 aria-pressed:bg-emerald-100"><MousePointer2 className="h-4 w-4" /></button>
      </div>
      {seleccionando && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">Haz clic en la {seleccionando} cifra de la pantalla.</p>}
      {((primera.trim() && a === null) || (segunda.trim() && b === null)) && <p role="status" className="mt-3 text-xs text-amber-800">Escribe una cifra válida, por ejemplo 1,250.50 o 1250,50.</p>}
      <div className="mt-4 rounded-xl bg-slate-950 p-3 text-white" aria-live="polite" aria-atomic="true">
        <label htmlFor="calculo-resultado" className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Resultado</label>
        {resultado?.valor !== null && resultado?.valor !== undefined ? <>
          <p className="mt-1 break-all text-xs text-slate-400">{formatearCifra(a!)} {operaciones.find((item) => item.valor === operacion)?.simbolo} {formatearCifra(b!)} =</p>
          <input id="calculo-resultado" ref={campoResultado} readOnly value={String(resultado.valor)} onFocus={(event) => event.target.select()} className="mt-1 w-full min-w-0 rounded bg-transparent py-1 text-2xl font-semibold tabular-nums outline-none focus:ring-1 focus:ring-emerald-400" />
          <button type="button" onClick={copiar} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400">{copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiado ? "Copiado" : "Copiar resultado"}</button>
        </> : <p className="mt-2 text-sm text-slate-300">{resultado?.error ?? (!operacion ? "Elige una operación para continuar." : "Completa las dos cifras.")}</p>}
      </div>
      {aviso && <p role="status" className="mt-2 text-xs text-amber-800">{aviso}</p>}
      <p className="mt-3 text-[10px] text-slate-500">Resultado automático · Enter selecciona el resultado · Esc cierra</p>
    </div>, host)}
  </>;
}
