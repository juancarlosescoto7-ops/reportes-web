export async function consultarEditor<T>(parametros: URLSearchParams, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api/editor-datos?${parametros}`, { ...opciones, cache: "no-store" });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const detalle = datos.detalle?.message;
    throw new Error(`${datos.error || "No se pudo completar la operación."}${detalle ? ` ${detalle}` : ""}`);
  }
  return datos as T;
}
