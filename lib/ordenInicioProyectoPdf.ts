import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

export type DatosOrdenInicioProyecto = {
  codigoProyecto: string;
  proyecto: string;
  departamento: string;
  municipio: string;
  ubicacion: string;
  fuente: string;
  monto: number;
  fecha: string;
  firmas: {
    alcalde: string;
    jefeUtm: string;
    contratista: string;
  };
};

type RecursosOrdenInicio = {
  membrete?: Uint8Array;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR = {
  verde: rgb(0, 0.31, 0.24),
  verdeOscuro: rgb(0, 0.2, 0.18),
  verdeSuave: rgb(0.93, 0.97, 0.95),
  tinta: rgb(0.09, 0.13, 0.14),
  secundario: rgb(0.38, 0.43, 0.44),
  borde: rgb(0.78, 0.83, 0.81),
  fondoEtiqueta: rgb(0.96, 0.975, 0.97),
  blanco: rgb(1, 1, 1),
};

export async function generarOrdenInicioProyectoPdf(
  datos: DatosOrdenInicioProyecto,
  recursos: RecursosOrdenInicio = {}
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const membrete = await intentarEmbedPng(pdf, recursos.membrete);
  const codigos = obtenerCodigos(datos.codigoProyecto);

  pdf.setTitle(`Orden de inicio - ${datos.proyecto}`);
  pdf.setSubject("Orden de inicio de proyecto municipal");
  pdf.setCreator("Sistema de reportes - Municipalidad de Talanga");
  pdf.setProducer("Sistema de reportes - Municipalidad de Talanga");

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLOR.blanco,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 9,
    width: PAGE_WIDTH,
    height: 9,
    color: COLOR.verde,
  });

  dibujarEncabezado(page, regular, bold, membrete);
  dibujarTitulo(page, regular, bold, datos);
  dibujarIntroduccion(page, regular);
  dibujarProyecto(page, bold, datos.proyecto);
  dibujarFichaProyecto(page, regular, bold, mono, datos, codigos);
  dibujarAutorizacion(page, regular, bold, datos.fecha);
  dibujarFirmas(page, regular, bold, datos.firmas);
  dibujarPie(page, regular, bold, datos, codigos.length);

  return pdf.save();
}

export function formatearFechaOrdenInicio(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const fecha = new Date(Date.UTC(year, month - 1, day));

  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("es-HN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

export function crearNombreArchivoOrdenInicio(
  codigoProyecto: string,
  proyecto: string
) {
  const base = `${codigoProyecto}-${proyecto}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return `orden-de-inicio-${base || "proyecto"}.pdf`;
}

function dibujarEncabezado(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  membrete: PDFImage | null
) {
  if (membrete) {
    const size = membrete.scaleToFit(455, 54);
    page.drawImage(membrete, {
      x: (PAGE_WIDTH - size.width) / 2,
      y: 716 + (54 - size.height) / 2,
      width: size.width,
      height: size.height,
    });
  } else {
    dibujarTextoCentradoEnAncho(
      page,
      "ALCALDÍA MUNICIPAL DE TALANGA",
      bold,
      14,
      MARGIN_X,
      CONTENT_WIDTH,
      746,
      COLOR.verdeOscuro
    );
    dibujarTextoCentradoEnAncho(
      page,
      "DEPARTAMENTO DE FRANCISCO MORAZÁN",
      regular,
      8,
      MARGIN_X,
      CONTENT_WIDTH,
      730,
      COLOR.secundario
    );
  }

  page.drawLine({
    start: { x: MARGIN_X, y: 705 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 705 },
    thickness: 0.8,
    color: COLOR.borde,
  });
  page.drawLine({
    start: { x: MARGIN_X, y: 705 },
    end: { x: MARGIN_X + 92, y: 705 },
    thickness: 2.2,
    color: COLOR.verde,
  });
}

function dibujarTitulo(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  datos: DatosOrdenInicioProyecto
) {
  dibujarTextoCentradoEnAncho(
    page,
    "ORDEN DE INICIO",
    bold,
    18,
    MARGIN_X,
    CONTENT_WIDTH,
    674,
    COLOR.verdeOscuro
  );
  dibujarTextoCentradoEnAncho(
    page,
    "AUTORIZACIÓN PARA LA EJECUCIÓN DE OBRA MUNICIPAL",
    regular,
    7.3,
    MARGIN_X,
    CONTENT_WIDTH,
    657,
    COLOR.secundario
  );
  page.drawRectangle({
    x: PAGE_WIDTH / 2 - 27,
    y: 646,
    width: 54,
    height: 2,
    color: COLOR.verde,
  });

  const lugarFecha = `${datos.municipio}, ${datos.departamento}, ${formatearFechaOrdenInicio(datos.fecha)}`;
  const size = ajustarTamanoTexto(
    lugarFecha,
    regular,
    8.5,
    7,
    CONTENT_WIDTH
  );
  const width = regular.widthOfTextAtSize(lugarFecha, size);

  page.drawText(lugarFecha, {
    x: PAGE_WIDTH - MARGIN_X - width,
    y: 620,
    size,
    font: regular,
    color: COLOR.secundario,
  });
}

function dibujarIntroduccion(page: PDFPage, regular: PDFFont) {
  const texto =
    "Por medio de la presente, la Municipalidad de Talanga autoriza formalmente el inicio de la obra municipal descrita a continuación, de conformidad con la documentación técnica y presupuestaria correspondiente.";
  const lineas = envolverTexto(texto, regular, 10.2, CONTENT_WIDTH);

  lineas.slice(0, 3).forEach((linea, index) => {
    page.drawText(linea, {
      x: MARGIN_X,
      y: 596 - index * 14,
      size: 10.2,
      font: regular,
      color: COLOR.tinta,
    });
  });
}

function dibujarProyecto(page: PDFPage, bold: PDFFont, proyecto: string) {
  const y = 493;
  const height = 65;

  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    height,
    color: COLOR.verdeSuave,
  });
  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: 4,
    height,
    color: COLOR.verde,
  });
  page.drawText("PROYECTO", {
    x: MARGIN_X + 17,
    y: y + 46,
    size: 7.2,
    font: bold,
    color: COLOR.verde,
  });

  const titulo = ajustarTexto(
    proyecto,
    bold,
    13.5,
    10.5,
    CONTENT_WIDTH - 34,
    2
  );

  titulo.lineas.forEach((linea, index) => {
    page.drawText(linea, {
      x: MARGIN_X + 17,
      y: y + 24 - index * (titulo.size + 2),
      size: titulo.size,
      font: bold,
      color: COLOR.tinta,
    });
  });
}

function dibujarFichaProyecto(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  mono: PDFFont,
  datos: DatosOrdenInicioProyecto,
  codigos: string[]
) {
  const top = 478;
  const codigoTexto = codigos.length
    ? codigos.join(" / ")
    : "Sin código presupuestario asociado";
  const codigoAjustado = ajustarTexto(codigoTexto, mono, 8.8, 6.5, 374, 4);
  const altoCodigo = Math.max(
    43,
    21 + codigoAjustado.lineas.length * (codigoAjustado.size + 2)
  );
  let cursor = top;

  cursor = dibujarFilaCompleta(page, bold, {
    top: cursor,
    height: altoCodigo,
    label: codigos.length === 1 ? "CÓDIGO PRESUPUESTARIO" : "CÓDIGOS PRESUPUESTARIOS",
    valueLines: codigoAjustado.lineas,
    valueFont: mono,
    valueSize: codigoAjustado.size,
    valueColor: COLOR.verdeOscuro,
  });

  cursor = dibujarFilaDoble(page, regular, bold, {
    top: cursor,
    height: 43,
    left: { label: "DEPARTAMENTO", value: datos.departamento },
    right: { label: "MUNICIPIO", value: datos.municipio },
  });

  const ubicacionAjustada = ajustarTexto(
    datos.ubicacion,
    regular,
    9.5,
    7.5,
    374,
    2
  );

  cursor = dibujarFilaCompleta(page, bold, {
    top: cursor,
    height: 50,
    label: "UBICACIÓN",
    valueLines: ubicacionAjustada.lineas,
    valueFont: regular,
    valueSize: ubicacionAjustada.size,
  });

  dibujarFilaDoble(page, regular, bold, {
    top: cursor,
    height: 47,
    left: { label: "FUENTE DE FINANCIAMIENTO", value: datos.fuente },
    right: {
      label: "MONTO VIGENTE",
      value: `L. ${formatearMonto(datos.monto)}`,
      destacado: true,
    },
  });
}

function dibujarFilaCompleta(
  page: PDFPage,
  bold: PDFFont,
  options: {
    top: number;
    height: number;
    label: string;
    valueLines: string[];
    valueFont: PDFFont;
    valueSize: number;
    valueColor?: RGB;
  }
) {
  const y = options.top - options.height;
  const labelWidth = 128;

  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    height: options.height,
    color: COLOR.blanco,
    borderColor: COLOR.borde,
    borderWidth: 0.65,
  });
  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: labelWidth,
    height: options.height,
    color: COLOR.fondoEtiqueta,
  });
  page.drawLine({
    start: { x: MARGIN_X + labelWidth, y },
    end: { x: MARGIN_X + labelWidth, y: options.top },
    thickness: 0.65,
    color: COLOR.borde,
  });
  dibujarEtiquetaCentrada(
    page,
    options.label,
    bold,
    MARGIN_X + 12,
    labelWidth - 24,
    y,
    options.height
  );

  const lineHeight = options.valueSize + 2;
  const blockHeight = options.valueLines.length * lineHeight;
  const firstY = y + (options.height + blockHeight) / 2 - lineHeight + 1;

  options.valueLines.forEach((linea, index) => {
    page.drawText(linea, {
      x: MARGIN_X + labelWidth + 14,
      y: firstY - index * lineHeight,
      size: options.valueSize,
      font: options.valueFont,
      color: options.valueColor ?? COLOR.tinta,
    });
  });

  return y;
}

function dibujarFilaDoble(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  options: {
    top: number;
    height: number;
    left: { label: string; value: string; destacado?: boolean };
    right: { label: string; value: string; destacado?: boolean };
  }
) {
  const y = options.top - options.height;
  const halfWidth = CONTENT_WIDTH / 2;

  page.drawRectangle({
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    height: options.height,
    color: COLOR.blanco,
    borderColor: COLOR.borde,
    borderWidth: 0.65,
  });
  page.drawLine({
    start: { x: MARGIN_X + halfWidth, y },
    end: { x: MARGIN_X + halfWidth, y: options.top },
    thickness: 0.65,
    color: COLOR.borde,
  });

  [options.left, options.right].forEach((cell, index) => {
    const x = MARGIN_X + index * halfWidth;

    page.drawText(cell.label, {
      x: x + 13,
      y: options.top - 14,
      size: 6.8,
      font: bold,
      color: COLOR.verde,
    });

    const valueSize = ajustarTamanoTexto(
      cell.value,
      cell.destacado ? bold : regular,
      cell.destacado ? 11 : 9.4,
      7,
      halfWidth - 26
    );
    page.drawText(cell.value, {
      x: x + 13,
      y: y + 12,
      size: valueSize,
      font: cell.destacado ? bold : regular,
      color: cell.destacado ? COLOR.verdeOscuro : COLOR.tinta,
    });
  });

  return y;
}

function dibujarEtiquetaCentrada(
  page: PDFPage,
  text: string,
  font: PDFFont,
  x: number,
  width: number,
  y: number,
  height: number
) {
  const size = ajustarTamanoTexto(text, font, 7, 6, width);
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: x + Math.max(0, (width - textWidth) / 2),
    y: y + (height - size) / 2 + 1,
    size,
    font,
    color: COLOR.verde,
  });
}

function dibujarAutorizacion(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  fecha: string
) {
  page.drawText("AUTORIZACIÓN", {
    x: MARGIN_X,
    y: 240,
    size: 7.5,
    font: bold,
    color: COLOR.verde,
  });
  page.drawLine({
    start: { x: MARGIN_X + 82, y: 243 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 243 },
    thickness: 0.65,
    color: COLOR.borde,
  });

  const texto = `En consecuencia, se autoriza el inicio de la ejecución de la obra antes descrita a partir del ${formatearFechaOrdenInicio(fecha)}, para los fines administrativos, técnicos y contractuales correspondientes.`;
  const lineas = envolverTexto(texto, regular, 9.8, CONTENT_WIDTH);

  lineas.slice(0, 3).forEach((linea, index) => {
    page.drawText(linea, {
      x: MARGIN_X,
      y: 219 - index * 13,
      size: 9.8,
      font: regular,
      color: COLOR.tinta,
    });
  });
}

function dibujarFirmas(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  firmas: DatosOrdenInicioProyecto["firmas"]
) {
  page.drawText("FIRMAS DE AUTORIZACIÓN", {
    x: MARGIN_X,
    y: 166,
    size: 7.5,
    font: bold,
    color: COLOR.verde,
  });
  page.drawLine({
    start: { x: MARGIN_X + 126, y: 169 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 169 },
    thickness: 0.65,
    color: COLOR.borde,
  });

  const configuracion = [
    { nombre: firmas.alcalde, cargo: "ALCALDE MUNICIPAL" },
    { nombre: firmas.jefeUtm, cargo: "JEFE UTM" },
    { nombre: firmas.contratista, cargo: "CONTRATISTA" },
  ];
  const gap = 20;
  const width = (CONTENT_WIDTH - gap * 2) / 3;

  configuracion.forEach((firma, index) => {
    const x = MARGIN_X + index * (width + gap);

    page.drawLine({
      start: { x, y: 112 },
      end: { x: x + width, y: 112 },
      thickness: 0.8,
      color: COLOR.tinta,
    });
    dibujarTextoCentradoEnAncho(
      page,
      firma.nombre.trim() || "Nombre y firma",
      regular,
      firma.nombre.trim() ? 7.6 : 7,
      x,
      width,
      96,
      firma.nombre.trim() ? COLOR.tinta : COLOR.secundario
    );
    dibujarTextoCentradoEnAncho(
      page,
      firma.cargo,
      bold,
      6.8,
      x,
      width,
      82,
      COLOR.verdeOscuro
    );
  });
}

function dibujarPie(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  datos: DatosOrdenInicioProyecto,
  cantidadCodigos: number
) {
  page.drawLine({
    start: { x: MARGIN_X, y: 60 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 60 },
    thickness: 0.65,
    color: COLOR.borde,
  });
  page.drawRectangle({
    x: MARGIN_X,
    y: 58.8,
    width: 58,
    height: 2,
    color: COLOR.verde,
  });
  page.drawText("MUNICIPALIDAD DE TALANGA", {
    x: MARGIN_X,
    y: 42,
    size: 6.8,
    font: bold,
    color: COLOR.verdeOscuro,
  });

  const referencia = `${String(cantidadCodigos).padStart(2, "0")} ${
    cantidadCodigos === 1 ? "código" : "códigos"
  } | ${datos.fecha}`;
  const referenciaWidth = regular.widthOfTextAtSize(referencia, 6.5);
  page.drawText(referencia, {
    x: PAGE_WIDTH - MARGIN_X - referenciaWidth,
    y: 42,
    size: 6.5,
    font: regular,
    color: COLOR.secundario,
  });
}

function dibujarTextoCentradoEnAncho(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  width: number,
  y: number,
  color: RGB
) {
  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {
    x: x + Math.max(0, (width - textWidth) / 2),
    y,
    size,
    font,
    color,
  });
}

function ajustarTexto(
  text: string,
  font: PDFFont,
  initialSize: number,
  minSize: number,
  maxWidth: number,
  maxLines: number
) {
  let size = initialSize;
  let lineas = envolverTexto(text, font, size, maxWidth);

  while (lineas.length > maxLines && size > minSize) {
    size = Math.max(minSize, size - 0.4);
    lineas = envolverTexto(text, font, size, maxWidth);
  }

  return { size, lineas: lineas.slice(0, maxLines) };
}

function ajustarTamanoTexto(
  text: string,
  font: PDFFont,
  initialSize: number,
  minSize: number,
  maxWidth: number
) {
  let size = initialSize;

  while (font.widthOfTextAtSize(text, size) > maxWidth && size > minSize) {
    size = Math.max(minSize, size - 0.4);
  }

  return size;
}

function envolverTexto(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const parrafos = text.split(/\r?\n/);
  const lineas: string[] = [];

  parrafos.forEach((parrafo) => {
    const palabras = parrafo.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

    if (palabras.length === 0) {
      lineas.push("");
      return;
    }

    let linea = "";

    palabras.forEach((palabra) => {
      const candidata = linea ? `${linea} ${palabra}` : palabra;

      if (font.widthOfTextAtSize(candidata, size) <= maxWidth) {
        linea = candidata;
        return;
      }

      if (linea) lineas.push(linea);

      if (font.widthOfTextAtSize(palabra, size) <= maxWidth) {
        linea = palabra;
        return;
      }

      const fragmentos = dividirPalabra(palabra, font, size, maxWidth);
      lineas.push(...fragmentos.slice(0, -1));
      linea = fragmentos.at(-1) ?? "";
    });

    if (linea) lineas.push(linea);
  });

  return lineas;
}

function dividirPalabra(
  palabra: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const partes: string[] = [];
  let parte = "";

  Array.from(palabra).forEach((caracter) => {
    const candidata = parte + caracter;

    if (parte && font.widthOfTextAtSize(candidata, size) > maxWidth) {
      partes.push(parte);
      parte = caracter;
      return;
    }

    parte = candidata;
  });

  if (parte) partes.push(parte);

  return partes;
}

function obtenerCodigos(value: string) {
  const codigos = value
    .split(/\s*\/\s*/)
    .map((codigo) => codigo.trim())
    .filter(Boolean);

  return Array.from(new Set(codigos));
}

function formatearMonto(value: number) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function intentarEmbedPng(
  pdf: PDFDocument,
  bytes: Uint8Array | undefined
) {
  if (!bytes?.length) return null;

  try {
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}
