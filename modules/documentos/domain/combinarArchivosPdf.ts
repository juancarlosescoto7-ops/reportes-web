import { PDFDocument } from "pdf-lib";

export type ArchivoPdfBinario = {
  nombre: string;
  bytes: Uint8Array;
};

type MetadatosPdf = {
  titulo: string;
  asunto: string;
  creador: string;
};

export async function combinarArchivosPdf(params: {
  archivos: Iterable<ArchivoPdfBinario> | AsyncIterable<ArchivoPdfBinario>;
  metadatos: MetadatosPdf;
}) {
  const pdfFinal = await PDFDocument.create();

  pdfFinal.setTitle(params.metadatos.titulo);
  pdfFinal.setSubject(params.metadatos.asunto);
  pdfFinal.setCreator(params.metadatos.creador);
  pdfFinal.setProducer(params.metadatos.creador);

  for await (const archivo of params.archivos) {
    let pdfOrigen: PDFDocument;

    try {
      pdfOrigen = await PDFDocument.load(archivo.bytes);
    } catch {
      throw new Error(
        `No se pudo incorporar \"${archivo.nombre}\". Verifique que el PDF no este danado ni protegido.`
      );
    }

    const paginas = await pdfFinal.copyPages(
      pdfOrigen,
      pdfOrigen.getPageIndices()
    );
    paginas.forEach((pagina) => pdfFinal.addPage(pagina));
  }

  const cantidadPaginas = pdfFinal.getPageCount();

  if (cantidadPaginas === 0) {
    throw new Error("Los documentos enlazados no contienen paginas.");
  }

  return {
    bytes: await pdfFinal.save(),
    cantidadPaginas,
  };
}
