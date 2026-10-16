// pdf-lib requiere una imagen raster. Se obtiene del mismo SVG de las
// subsanaciones, a alta resolución, sin depender del antiguo membrete PNG.
export async function cargarMembreteReporteMensualPdf(): Promise<Uint8Array> {
  const respuesta = await fetch("/membrete.svg");
  if (!respuesta.ok) throw new Error("No se pudo cargar el membrete municipal.");
  const documento = new DOMParser().parseFromString(await respuesta.text(), "image/svg+xml");
  const svg = documento.documentElement;
  const dimensiones = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (svg.localName !== "svg" || !dimensiones || dimensiones.length !== 4 ||
      !dimensiones.every(Number.isFinite) || dimensiones[2] <= 0 || dimensiones[3] <= 0) {
    throw new Error("El membrete SVG no tiene dimensiones válidas.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = Math.round(canvas.width * dimensiones[3] / dimensiones[2]);
  svg.setAttribute("width", String(canvas.width));
  svg.setAttribute("height", String(canvas.height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("No se pudo preparar el membrete para el PDF.");
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir el membrete para el PDF.")), "image/png");
    });
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
