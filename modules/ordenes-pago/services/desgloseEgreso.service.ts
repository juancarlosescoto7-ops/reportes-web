import { crearClienteSupabase } from "@/shared/infrastructure/supabase";
import { calcularDesgloseEgreso, type MovimientoDesgloseEgreso } from "@/modules/ordenes-pago/domain/desglose-egreso";

export async function obtenerDesgloseEgreso(noOrden: string) {
  const supabase = crearClienteSupabase();
  const movimientos: MovimientoDesgloseEgreso[] = [];
  const tamanoPagina = 500;

  for (let inicio = 0; ; inicio += tamanoPagina) {
    const { data, error } = await supabase
      .from("egresos")
      .select("cuenta,haber")
      .eq("no_orden", noOrden)
      .order("id")
      .range(inicio, inicio + tamanoPagina - 1);

    if (error) throw new Error("No se pudo consultar el desglose del egreso.");
    const pagina = (data ?? []) as MovimientoDesgloseEgreso[];
    movimientos.push(...pagina);
    if (pagina.length < tamanoPagina) break;
  }

  if (movimientos.length === 0) {
    throw new Error("No se encontraron movimientos para calcular el desglose.");
  }
  return calcularDesgloseEgreso(movimientos);
}
