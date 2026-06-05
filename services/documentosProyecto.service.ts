import {
  ejecutarRPC,
  subirArchivoStorage,
} from "@/lib/supabase";

type SubirDocumentoProyectoParams = {
  archivo: File;
  idProyecto: number;
  idRequisito: number;
};

export async function subirDocumentoProyecto({
  archivo,
  idProyecto,
  idRequisito,
}: SubirDocumentoProyectoParams) {
  if (!archivo) {
    throw new Error("Debe seleccionar un archivo.");
  }

  if (archivo.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF.");
  }

  const fecha = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .split(".")[0];

  const nombreArchivo = `DOC_${idProyecto}_${idRequisito}_${fecha}.pdf`;

  const rutaStorage =
    `proyectos/${idProyecto}/requisitos/${idRequisito}/${nombreArchivo}`;

  await subirArchivoStorage(
    "documentos",
    rutaStorage,
    archivo,
    "application/pdf"
  );

  await ejecutarRPC("actualizar_documento_proyecto", {
    p_id_proyecto: idProyecto,
    p_id_requisito: idRequisito,
    p_url_documento: rutaStorage,
  });

  return {
    ok: true,
    rutaStorage,
    nombreArchivo,
  };
}