import { ejecutarRPC } from "@/lib/supabase";

export type DocumentoProyecto = {
  id_proyecto: number;
  nombre_proyecto: string;
  id_requisito: number;
  nombre_requisito: string;
  url_documento: string | null;
  fecha_documento: string | null;
  mensaje: string;
  codigo_presupuestario: string;
};

export async function obtenerDocumentosProyectos() {
  const data = await ejecutarRPC("rpc_proyectos_expediente_codigos", {});
  return data as DocumentoProyecto[];
}