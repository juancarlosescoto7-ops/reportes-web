export const ESPERA_SECUENCIA = 2500;
export type EstadoSecuencia = { teclas: string; instante: number };
export type TeclaComando = {
  key: string; code: string; shiftKey: boolean; ctrlKey: boolean;
  altKey: boolean; metaKey: boolean; repeat: boolean; isComposing: boolean;
};

export function avanzarSecuencia(
  estado: EstadoSecuencia,
  evento: TeclaComando,
  comandos: readonly string[],
  ahora: number,
): { estado: EstadoSecuencia; consumir: boolean; comando?: string } {
  const vacio = { teclas: "", instante: 0 };
  if (evento.key === "Escape" || evento.ctrlKey || evento.altKey || evento.metaKey || evento.isComposing) {
    return { estado: vacio, consumir: false };
  }
  if (evento.repeat || evento.key === "Shift") return { estado, consumir: false };
  const previa = ahora - estado.instante <= ESPERA_SECUENCIA ? estado.teclas : "";
  const tecla = /^Digit[0-9]$/.test(evento.code) || /^Numpad[0-9]$/.test(evento.code)
    ? evento.code.slice(-1) : evento.key.toLowerCase();
  if (!/^[a-z0-9]$/.test(tecla) || (!previa && !evento.shiftKey)) return { estado: vacio, consumir: false };
  const candidatas = previa + tecla;
  const exacto = comandos.includes(candidatas);
  const tieneContinuacion = comandos.some((comando) =>
    comando !== candidatas && comando.startsWith(candidatas)
  );
  if (exacto && !tieneContinuacion) return { estado: vacio, consumir: true, comando: candidatas };
  if (exacto || tieneContinuacion) {
    return { estado: { teclas: candidatas, instante: ahora }, consumir: true };
  }
  return { estado: vacio, consumir: Boolean(previa) };
}

export function normalizarComando(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
