import { cifrasEnTexto, leerCifra } from "./calculo-rapido";

export function cifraEnPunto(target: EventTarget | null, x: number, y: number): { valor: number; elemento: Element } | null {
  if (!(target instanceof Element) || target.closest("[data-calculo-rapido], [data-calculo-ignorar]")) return null;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target instanceof HTMLInputElement && !["text", "number", "search"].includes(target.type)) return null;
    const valor = target instanceof HTMLInputElement && target.type === "number"
      ? (Number.isFinite(target.valueAsNumber) ? target.valueAsNumber : null) : leerCifra(target.value);
    return valor === null ? null : { valor, elemento: target };
  }
  // Solo inspeccionar el elemento bajo el puntero; nunca recorrer la página entera.
  if (["BODY", "HTML", "MAIN", "SCRIPT", "STYLE"].includes(target.tagName)) return null;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let visitados = 0;
  while ((node = walker.nextNode()) && visitados++ < 100) {
    if (node.parentElement?.closest('[aria-hidden="true"], [hidden], script, style')) continue;
    for (const cifra of cifrasEnTexto(node.textContent ?? "")) {
      const range = document.createRange();
      range.setStart(node, cifra.inicio);
      range.setEnd(node, cifra.fin);
      if (Array.from(range.getClientRects()).some((rect) => x >= rect.left - 3 && x <= rect.right + 3 && y >= rect.top - 3 && y <= rect.bottom + 3)) {
        return { valor: cifra.valor, elemento: node.parentElement ?? target };
      }
    }
  }
  return null;
}
