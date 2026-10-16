import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentoMensualCxp } from "./reporte-mensual-cxp";

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 40;
const COLUMNAS = [30, 128, 100, 274];
const tinta = rgb(0.09, 0.17, 0.16);
const verde = rgb(0.07, 0.35, 0.31);
const borde = rgb(0.79, 0.84, 0.82);
const moneda = (valor: number) => `L ${valor.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function textoCompatible(texto: string, fuente: PDFFont) {
  return Array.from(texto.replace(/\t/g, " ")).map((letra) => {
    if (letra === "\n") return letra;
    try { fuente.encodeText(letra); return letra; } catch { return "?"; }
  }).join("");
}

function lineas(texto: string, fuente: PDFFont, tamano: number, ancho: number) {
  const resultado: string[] = [];
  for (const parrafo of textoCompatible(texto, fuente).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const candidata = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(candidata, tamano) <= ancho) { actual = candidata; continue; }
      if (actual) resultado.push(actual);
      actual = "";
      for (const letra of palabra) {
        if (actual && fuente.widthOfTextAtSize(actual + letra, tamano) > ancho) { resultado.push(actual); actual = ""; }
        actual += letra;
      }
    }
    resultado.push(actual);
  }
  return resultado;
}

export async function generarReportesMensualesCxpPdf(documentos: DocumentoMensualCxp[], membrete: Uint8Array) {
  if (!documentos.length) throw new Error("No hay reportes para descargar.");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const imagen = await pdf.embedPng(membrete);
  pdf.setTitle(documentos.length === 1 ? `Cuentas por pagar ${documentos[0].periodo}` : "Reportes mensuales de cuentas por pagar");
  pdf.setAuthor("Municipalidad de Talanga - Tesorería Municipal");

  for (const documento of documentos) {
    let pagina: PDFPage;
    let y = 0;
    let numeroPagina = 0;
    const dibujarTexto = (texto: string, x: number, top: number, size = 10, bold = false) => {
      const font = bold ? negrita : regular;
      pagina.drawText(textoCompatible(texto, font), { x, y: top - size, size, font, color: tinta });
    };
    const centrado = (texto: string, top: number, size: number, bold = false) => {
      const font = bold ? negrita : regular;
      dibujarTexto(texto, (ANCHO - font.widthOfTextAtSize(textoCompatible(texto, font), size)) / 2, top, size, bold);
    };
    const nuevaPagina = () => {
      pagina = pdf.addPage([ANCHO, ALTO]);
      numeroPagina++;
      const dimensiones = imagen.scaleToFit(ANCHO - MARGEN * 2, 97);
      pagina.drawImage(imagen, { x: (ANCHO - dimensiones.width) / 2, y: ALTO - MARGEN - dimensiones.height, ...dimensiones });
      y = ALTO - MARGEN - dimensiones.height - 12;
      centrado("TESORERÍA MUNICIPAL", y, 10, true);
      y -= 26;
      centrado(documento.titulo, y, 13, true);
      y -= 21;
      centrado(documento.subtitulo, y, 10);
      y -= 24;
      pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: verde });
      y -= 16;
      dibujarTexto(`${documento.periodo} - Página ${numeroPagina}`, MARGEN, 29, 8);
    };
    const parrafo = (texto: string) => {
      for (const linea of lineas(texto, regular, 11, ANCHO - MARGEN * 2)) { dibujarTexto(linea, MARGEN, y, 11); y -= 16; }
    };
    const encabezadoTabla = () => {
      let x = MARGEN;
      ["No.", "Acreedor", "Monto", "Descripción"].forEach((titulo, indice) => {
        pagina.drawRectangle({ x, y: y - 25, width: COLUMNAS[indice], height: 25, color: rgb(0.93, 0.96, 0.95), borderColor: borde, borderWidth: 0.5 });
        dibujarTexto(titulo, x + 6, y - 7, 10, true);
        x += COLUMNAS[indice];
      });
      y -= 25;
    };
    nuevaPagina();
    parrafo(documento.apertura);
    y -= 14;
    encabezadoTabla();
    for (const fila of documento.filas) {
      const celdas = [String(fila.numero), fila.acreedor, moneda(fila.monto), fila.descripcion]
        .map((texto, indice) => lineas(texto, regular, 10, COLUMNAS[indice] - 12));
      const cantidadLineas = Math.max(...celdas.map((celda) => celda.length));
      let desde = 0;
      // Una descripción extensa puede continuar en otra página sin perder texto.
      while (desde < cantidadLineas) {
        let capacidad = Math.floor((y - 58 - 12) / 14);
        if (capacidad < 1 || (desde === 0 && cantidadLineas <= 15 && capacidad < cantidadLineas)) {
          nuevaPagina(); encabezadoTabla(); capacidad = Math.floor((y - 58 - 12) / 14);
        }
        const cantidad = Math.min(cantidadLineas - desde, capacidad);
        const altura = cantidad * 14 + 12;
        let x = MARGEN;
        celdas.forEach((celda, indice) => {
          pagina.drawRectangle({ x, y: y - altura, width: COLUMNAS[indice], height: altura, borderColor: borde, borderWidth: 0.5 });
          celda.slice(desde, desde + cantidad).forEach((linea, i) => {
            const posX = indice === 2 ? x + COLUMNAS[indice] - 6 - regular.widthOfTextAtSize(linea, 10) : x + 6;
            dibujarTexto(linea, posX, y - 6 - i * 14);
          });
          x += COLUMNAS[indice];
        });
        y -= altura;
        desde += cantidad;
      }
    }
    if (!documento.filas.length) { y -= 12; parrafo("No se registran cuentas por pagar pendientes al cierre del mes seleccionado."); }
    const cierreLineas = lineas(documento.cierre, regular, 11, ANCHO - MARGEN * 2).length;
    if (y < 58 + 142 + cierreLineas * 16) nuevaPagina();
    y -= 16;
    dibujarTexto("TOTAL", MARGEN, y, 11, true);
    const total = moneda(documento.total);
    dibujarTexto(total, ANCHO - MARGEN - negrita.widthOfTextAtSize(total, 11), y, 11, true);
    y -= 35;
    parrafo(documento.cierre);
    y -= 55;
    pagina!.drawLine({ start: { x: 158, y }, end: { x: 454, y }, thickness: 0.8, color: tinta });
    y -= 9;
    centrado(documento.firmante, y, 11, true);
    centrado(documento.cargo, y - 18, 11);
  }
  return pdf.save();
}
