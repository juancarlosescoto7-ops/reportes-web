import { ejecutarRPC } from "@/lib/supabase";

export async function testSupabaseOrdenes() {
  const data = await ejecutarRPC("obtener_egresos_con_ejecucion");

  console.log("🧪 TEST LIMPIO - SUPABASE");

  console.log("🔵 TOTAL REGISTROS:", data.length);

  const ordenes = data
    .map((d: any) => Number(d.no_orden))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  const unicas = Array.from(new Set(ordenes));

  console.log("🟢 MIN ORDEN:", Math.min(...ordenes));
  console.log("🔴 MAX ORDEN:", Math.max(...ordenes));

  console.log("📦 ORDENES ÚNICAS:");
  console.log(unicas);

  return data;
}