export type AccionCatalogada = {
  codigo: string; atajo: string; titulo: string; modulo: string; archivo: string; grupo?: string;
};
export type DestinoAccion = { elemento: HTMLElement; titulo: string; contexto: string; habilitado: boolean };

export function esVisible(elemento: HTMLElement): boolean {
  if (!elemento.isConnected || elemento.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  if (!elemento.getClientRects().length) return false;
  const estilo = getComputedStyle(elemento);
  return estilo.display !== "none" && estilo.visibility !== "hidden";
}

export function campoEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
  ));
}

export function ambitoActual(): HTMLElement {
  const modales = Array.from(document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [aria-modal="true"], dialog[open], .fixed.inset-0',
  )).filter((elemento) => !elemento.closest("[data-manual-comandos]") && esVisible(elemento)
    && elemento.querySelector("button, input, select, textarea"));
  return modales.sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1) ?? document.body;
}

export function destinosAccion(codigo: string, ambito: HTMLElement): DestinoAccion[] {
  return Array.from(ambito.querySelectorAll<HTMLElement>(`[data-shortcut="${codigo}"]`))
    .filter((elemento) => !elemento.closest("[data-manual-comandos]") && esVisible(elemento))
    .map((elemento) => {
      const titulo = elemento.getAttribute("aria-label") || elemento.getAttribute("title")
        || elemento.getAttribute("data-shortcut-label") || elemento.innerText || "Seleccionar";
      const fila = elemento.closest("tr, [data-shortcut-context], article") ?? elemento.parentElement;
      return {
        elemento, titulo: titulo.replace(/\s+/g, " ").trim().slice(0, 160),
        contexto: (fila?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
        habilitado: !elemento.matches(':disabled, [aria-disabled="true"]') && !elemento.closest('[aria-busy="true"]'),
      };
    });
}

export function activarDestino(destino: DestinoAccion) {
  const elemento = destino.elemento;
  if (!esVisible(elemento) || !ambitoActual().contains(elemento) || elemento.matches(':disabled, [aria-disabled="true"]') || elemento.closest('[aria-busy="true"]')) return false;
  elemento.scrollIntoView({ block: "nearest" });
  elemento.focus({ preventScroll: true });
  if (elemento.dataset.shortcutEvent === "contextmenu") {
    const rect = elemento.getBoundingClientRect();
    elemento.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 20 }));
  } else elemento.click();
  return true;
}
