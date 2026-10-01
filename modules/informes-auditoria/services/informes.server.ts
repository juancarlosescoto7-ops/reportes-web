import "server-only";

import { obtenerAccesoAuditoriaServidor } from "@/modules/auditoria/services/auditoria.server";
import { type MesInformeAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";

export async function obtenerMesesInformesServidor() {
  const { supabase, autorizado } = await obtenerAccesoAuditoriaServidor();
  if (!autorizado) return { autorizado: false, meses: [] as MesInformeAuditoria[] };

  const { data, error } = await supabase.rpc("auditoria_meses_informe");
  if (error) throw new Error(`No se pudieron cargar los meses de los informes: ${error.message}`);

  return { autorizado: true, meses: (data ?? []) as MesInformeAuditoria[] };
}
