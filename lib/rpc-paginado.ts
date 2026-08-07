"use client";

const TAMANO_PAGINA = 1_000;
const MAXIMO_REGISTROS = 100_000;

function obtenerMensajeError(data: unknown, status: number) {
  if (data && typeof data === "object") {
    if ("message" in data) return String(data.message);
    if ("error" in data) return String(data.error);
  }

  return `Error HTTP ${status}`;
}

function obtenerTotal(contentRange: string | null) {
  const match = contentRange?.match(/\/(\d+)$/);
  if (!match) return null;

  const total = Number(match[1]);
  return Number.isFinite(total) ? total : null;
}

export async function ejecutarRPCPaginado<T>(
  nombreRPC: string,
  payload: Record<string, unknown> = {}
): Promise<T[]> {
  const registros: T[] = [];

  for (let desde = 0; desde < MAXIMO_REGISTROS; desde += TAMANO_PAGINA) {
    const hasta = desde + TAMANO_PAGINA - 1;
    const response = await fetch(
      `/api/supabase/rpc/${encodeURIComponent(nombreRPC)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Range-Unit": "items",
          Range: `${desde}-${hasta}`,
          Prefer: "count=exact",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Error en RPC ${nombreRPC}: ${obtenerMensajeError(
          data,
          response.status
        )}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(`La RPC ${nombreRPC} devolvio un formato inesperado.`);
    }

    registros.push(...(data as T[]));

    const total = obtenerTotal(response.headers.get("Content-Range"));
    if (
      data.length < TAMANO_PAGINA ||
      (total !== null && registros.length >= total)
    ) {
      return registros;
    }
  }

  throw new Error(
    `La RPC ${nombreRPC} supera el limite seguro de ${MAXIMO_REGISTROS.toLocaleString(
      "en-US"
    )} registros.`
  );
}
