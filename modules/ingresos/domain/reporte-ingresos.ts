import type { IngresoReporte } from "../services/ingresos.service";

export function obtenerTiempoFecha(value: string | null | undefined) {
  if (!value) return 0;

  const text = String(value).trim();
  const soloFecha = text.split("T")[0].split(" ")[0];
  const isoMatch = soloFecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = soloFecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  if (localMatch) {
    const [, day, month, year] = localMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const time = new Date(text).getTime();

  return Number.isFinite(time) ? time : 0;
}

export function obtenerFechaArqueo(item: IngresoReporte) {
  return item.fecha_arqueo ?? item.fecha ?? null;
}

export function estaIngresoEnRangoDeArqueo(
  item: IngresoReporte,
  fechaDesde: string,
  fechaHasta: string
) {
  const fechaArqueo = obtenerFechaArqueo(item);

  if (!fechaArqueo) return !fechaDesde && !fechaHasta;

  const tiempoArqueo = obtenerTiempoFecha(fechaArqueo);
  const tiempoDesde = fechaDesde ? obtenerTiempoFecha(fechaDesde) : null;
  const tiempoHasta = fechaHasta ? obtenerTiempoFecha(fechaHasta) : null;

  if (!tiempoArqueo) return false;
  if (tiempoDesde !== null && tiempoArqueo < tiempoDesde) return false;
  if (tiempoHasta !== null && tiempoArqueo > tiempoHasta) return false;

  return true;
}
