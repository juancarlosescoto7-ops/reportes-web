type OrdenConNumero = { no_orden: string; fecha: string };

// Ambas formas de registro proponen el siguiente número consecutivo de orden.
// La fecha contable puede ser anterior al día en que se registra el egreso.
export function ordenarOrdenesRecientes<T extends OrdenConNumero>(ordenes: T[]): T[] {
  return [...ordenes].sort((a, b) =>
    b.no_orden.localeCompare(a.no_orden, "es", { numeric: true }) ||
    b.fecha.localeCompare(a.fecha)
  );
}
