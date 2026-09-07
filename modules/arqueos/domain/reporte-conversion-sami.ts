import { jsPDF } from "jspdf";

import type { DetalleConversionSami } from "./conversion-ingresos";

export type IngresoInconsistenteReporte = {
  codigo: string;
  descripcion: string;
  valorRecaudado: number;
};

export type DatosReporteConversionSami = {
  fechaArqueo: string;
  descripcionArqueo: string;
  detalles: DetalleConversionSami[];
  inconsistencias: IngresoInconsistenteReporte[];
  totalSami: number;
  totalSinEquivalencia: number;
  totalGeneral: number;
};

function formatMoney(value: number) {
  return `HNL ${Number(value ?? 0).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatearFecha(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function nombreSeguro(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function crearDocumentoReporteConversionSami({
  fechaArqueo,
  descripcionArqueo,
  detalles,
  inconsistencias,
  totalSami,
  totalSinEquivalencia,
  totalGeneral,
}: DatosReporteConversionSami) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 42;
  const anchoContenido = anchoPagina - margen * 2;
  const anchoMonto = 130;
  const anchoSami = anchoContenido - anchoMonto;
  const anchoCodigoInconsistencia = 105;
  const anchoDescripcionInconsistencia =
    anchoContenido - anchoCodigoInconsistencia - anchoMonto;
  let y = margen;
  let encabezadoContinuacion: (() => void) | null = null;

  function dibujarEncabezadoPagina() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Informe de ingresos SAMI", margen, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha del arqueo: ${formatearFecha(fechaArqueo)}`, margen, y + 14);
    y += 28;
  }

  function dibujarEncabezadoTablaSami() {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.rect(margen, y, anchoContenido, 24, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 83, 45);
    doc.text("SAMI", margen + 6, y + 16);
    doc.text("Monto", anchoPagina - margen - 6, y + 16, {
      align: "right",
    });
    y += 24;
  }

  function dibujarEncabezadoTablaInconsistencias() {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.rect(margen, y, anchoContenido, 24, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    doc.text("Código", margen + 6, y + 16);
    doc.text(
      "Descripción",
      margen + anchoCodigoInconsistencia + 6,
      y + 16
    );
    doc.text("Monto", anchoPagina - margen - 6, y + 16, {
      align: "right",
    });
    y += 24;
  }

  function nuevaPagina() {
    doc.addPage();
    y = margen;
    dibujarEncabezadoPagina();
    encabezadoContinuacion?.();
  }

  function asegurarEspacio(altura: number) {
    if (y + altura <= altoPagina - 42) return;
    nuevaPagina();
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Informe de ingresos SAMI", margen, y + 4);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha del arqueo: ${formatearFecha(fechaArqueo)}`, margen, y);
  y += 15;

  const descripcion = doc.splitTextToSize(
    `Descripción: ${descripcionArqueo.trim() || "Sin descripción"}`,
    anchoContenido
  ) as string[];
  doc.text(descripcion, margen, y);
  y += descripcion.length * 12 + 8;

  if (inconsistencias.length > 0) {
    const mensaje = doc.splitTextToSize(
      `${inconsistencias.length} ingreso(s) no tienen equivalencia y requieren registro manual. Monto pendiente: ${formatMoney(totalSinEquivalencia)}.`,
      anchoContenido - 12
    ) as string[];
    const alturaAviso = mensaje.length * 11 + 25;

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.rect(margen, y, anchoContenido, alturaAviso, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    doc.text("INCONSISTENCIA DETECTADA", margen + 6, y + 14);
    doc.setFont("helvetica", "normal");
    doc.text(mensaje, margen + 6, y + 27);
    y += alturaAviso + 12;
  } else {
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.rect(margen, y, anchoContenido, 28, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 83, 45);
    doc.text("Todos los rubros fueron clasificados en SAMI.", margen + 6, y + 18);
    y += 40;
  }

  dibujarEncabezadoTablaSami();
  encabezadoContinuacion = dibujarEncabezadoTablaSami;

  if (detalles.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("No hay rubros SAMI disponibles.", margen + 6, y + 18);
    y += 30;
  }

  detalles.forEach((detalle) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const sami = `${detalle.codigo} - ${detalle.descripcion || "Sin descripción"}`;
    const lineas = doc.splitTextToSize(sami, anchoSami - 12) as string[];
    const altura = Math.max(1, lineas.length) * 11 + 12;

    asegurarEspacio(altura);
    doc.setTextColor(51, 65, 85);
    doc.text(lineas, margen + 6, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(
      formatMoney(detalle.valorRecaudado),
      anchoPagina - margen - 6,
      y + 15,
      { align: "right" }
    );
    doc.setDrawColor(226, 232, 240);
    doc.line(margen, y + altura, anchoPagina - margen, y + altura);
    y += altura;
  });

  encabezadoContinuacion = null;
  asegurarEspacio(32);
  doc.setFillColor(241, 245, 249);
  doc.rect(margen, y, anchoContenido, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Total SAMI", margen + 6, y + 17);
  doc.text(formatMoney(totalSami), anchoPagina - margen - 6, y + 17, {
    align: "right",
  });
  y += 40;

  if (inconsistencias.length > 0) {
    const alturaFilasInconsistencias = inconsistencias.reduce(
      (total, ingreso) => {
        const lineas = doc.splitTextToSize(
          ingreso.descripcion || "Sin descripción",
          anchoDescripcionInconsistencia - 12
        ) as string[];

        return total + Math.max(1, lineas.length) * 11 + 12;
      },
      0
    );
    const alturaBloque =
      34 + 24 + alturaFilasInconsistencias + 40 + 80;

    asegurarEspacio(
      Math.min(alturaBloque, altoPagina - margen * 2 - 28)
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(120, 53, 15);
    doc.text("INGRESOS CON INCONSISTENCIAS", margen, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      "Estos ingresos no tienen equivalencia y deben registrarse manualmente.",
      margen,
      y
    );
    y += 10;

    dibujarEncabezadoTablaInconsistencias();
    encabezadoContinuacion = dibujarEncabezadoTablaInconsistencias;

    inconsistencias.forEach((ingreso) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lineas = doc.splitTextToSize(
        ingreso.descripcion || "Sin descripción",
        anchoDescripcionInconsistencia - 12
      ) as string[];
      const altura = Math.max(1, lineas.length) * 11 + 12;

      asegurarEspacio(altura);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120, 53, 15);
      doc.text(ingreso.codigo, margen + 6, y + 15);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(
        lineas,
        margen + anchoCodigoInconsistencia + 6,
        y + 15
      );
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120, 53, 15);
      doc.text(
        formatMoney(ingreso.valorRecaudado),
        anchoPagina - margen - 6,
        y + 15,
        { align: "right" }
      );
      doc.setDrawColor(253, 230, 138);
      doc.line(margen, y + altura, anchoPagina - margen, y + altura);
      y += altura;
    });

    encabezadoContinuacion = null;
    asegurarEspacio(32);
    doc.setFillColor(254, 243, 199);
    doc.rect(margen, y, anchoContenido, 26, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(120, 53, 15);
    doc.text("Total con inconsistencias", margen + 6, y + 17);
    doc.text(
      formatMoney(totalSinEquivalencia),
      anchoPagina - margen - 6,
      y + 17,
      { align: "right" }
    );
    y += 40;
  }

  encabezadoContinuacion = null;
  asegurarEspacio(80);
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(100, 116, 139);
  doc.rect(margen, y, anchoContenido, 68, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text("RESUMEN", margen + 8, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text("Total SAMI", margen + 8, y + 32);
  doc.text("Pendiente de registro manual", margen + 8, y + 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL DEL ARQUEO", margen + 8, y + 60);
  doc.setFontSize(9);
  doc.text(formatMoney(totalSami), anchoPagina - margen - 8, y + 32, {
    align: "right",
  });
  doc.text(
    formatMoney(totalSinEquivalencia),
    anchoPagina - margen - 8,
    y + 45,
    { align: "right" }
  );
  doc.setFontSize(10);
  doc.text(formatMoney(totalGeneral), anchoPagina - margen - 8, y + 60, {
    align: "right",
  });

  const paginas = doc.getNumberOfPages();

  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${pagina} de ${paginas}`,
      anchoPagina - margen,
      altoPagina - 18,
      { align: "right" }
    );
  }

  return doc;
}

export function imprimirReporteConversionSami(
  datos: DatosReporteConversionSami
) {
  const doc = crearDocumentoReporteConversionSami(datos);

  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, "_blank");

  if (!ventana) {
    const enlace = document.createElement("a");
    const fechaNombre = nombreSeguro(datos.fechaArqueo) || "arqueo";
    enlace.href = url;
    enlace.download = `informe-ingresos-sami-${fechaNombre}.pdf`;
    enlace.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
