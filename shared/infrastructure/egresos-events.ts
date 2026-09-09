const EVENTO = "reportes:egreso-registrado";
const ORIGEN = Math.random().toString(36).slice(2);

function normalizarOrden(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const numero = Number(value);
  return Number.isSafeInteger(numero) && numero > 0 ? String(numero) : null;
}

export function notificarEgresoRegistrado(noOrden: unknown) {
  if (typeof window === "undefined") return;
  const orden = normalizarOrden(noOrden);
  if (!orden) return;

  window.dispatchEvent(new CustomEvent(EVENTO, { detail: orden }));
  // El aviso entre pestañas no debe convertir un registro exitoso en un error.
  try {
    const canal = new BroadcastChannel(EVENTO);
    canal.postMessage({ noOrden: orden, origen: ORIGEN });
    canal.close();
  } catch {
    // La pestaña actual sigue recibiendo el evento local.
  }
}

export function escucharEgresosRegistrados(onRegistro: (noOrden: string) => void) {
  const ventana = window;
  const recibir = (value: unknown) => {
    const orden = normalizarOrden(value);
    if (orden) onRegistro(orden);
  };
  const recibirLocal = (event: Event) => recibir((event as CustomEvent).detail);
  ventana.addEventListener(EVENTO, recibirLocal);

  let canal: BroadcastChannel | undefined;
  try {
    canal = new BroadcastChannel(EVENTO);
    canal.onmessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== "object") return;
      const mensaje = event.data as { noOrden?: unknown; origen?: unknown };
      // El evento local ya actualizó las vistas de esta pestaña.
      if (mensaje.origen !== ORIGEN) recibir(mensaje.noOrden);
    };
  } catch {
    // En navegadores sin canal, se actualiza al volver a la pestaña.
  }

  return () => {
    ventana.removeEventListener(EVENTO, recibirLocal);
    canal?.close();
  };
}
