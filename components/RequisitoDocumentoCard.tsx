"use client";

import { useState } from "react";
import { Camera, FileUp } from "lucide-react";
import { DocumentoProyecto } from "@/services/documentacionProyectos";
import { subirDocumentoProyecto } from "@/services/documentosProyecto.service";

type Props = {
  documento: DocumentoProyecto;
  onAbrir: (rutaDocumento: string | null) => void;
  onActualizado: () => Promise<void> | void;
};

type RecorteDocumento = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
};

type ColorRgb = {
  r: number;
  g: number;
  b: number;
};

export default function RequisitoDocumentoCard({
  documento,
  onAbrir,
  onActualizado,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const tieneDocumento = Boolean(documento.url_documento);
  const inputPdfId = `input-doc-${documento.id_proyecto}-${documento.id_requisito}`;
  const inputEscanerId = `input-scan-${documento.id_proyecto}-${documento.id_requisito}`;

  async function subirArchivo(archivo: File | undefined) {
    if (!archivo || tieneDocumento) return;

    try {
      setSubiendo(true);

      await subirDocumentoProyecto({
        archivo,
        idProyecto: documento.id_proyecto,
        idRequisito: documento.id_requisito,
      });

      await onActualizado();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Error subiendo documento."
      );
    } finally {
      setSubiendo(false);
      setArrastrando(false);
    }
  }

  async function convertirImagenAPdf(archivo: File) {
    const [{ default: jsPDF }, dataUrl] = await Promise.all([
      import("jspdf"),
      leerArchivoComoDataUrl(archivo),
    ]);

    const imagen = await cargarImagen(dataUrl);
    const imagenNormalizada = normalizarImagen(imagen);
    const orientacion =
      imagenNormalizada.ancho > imagenNormalizada.alto ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation: orientacion,
      unit: "pt",
      format: "a4",
    });

    const anchoPagina = pdf.internal.pageSize.getWidth();
    const altoPagina = pdf.internal.pageSize.getHeight();
    const margen = 24;
    const anchoDisponible = anchoPagina - margen * 2;
    const altoDisponible = altoPagina - margen * 2;
    const escala = Math.min(
      anchoDisponible / imagenNormalizada.ancho,
      altoDisponible / imagenNormalizada.alto
    );
    const anchoImagen = imagenNormalizada.ancho * escala;
    const altoImagen = imagenNormalizada.alto * escala;
    const x = (anchoPagina - anchoImagen) / 2;
    const y = (altoPagina - altoImagen) / 2;

    pdf.addImage(
      imagenNormalizada.dataUrl,
      "JPEG",
      x,
      y,
      anchoImagen,
      altoImagen
    );

    return new File(
      [pdf.output("blob")],
      `ESCANEO_${documento.id_proyecto}_${documento.id_requisito}.pdf`,
      { type: "application/pdf" }
    );
  }

  async function subirEscaneo(archivo: File | undefined) {
    if (!archivo || tieneDocumento) return;

    try {
      setSubiendo(true);
      const pdf = await convertirImagenAPdf(archivo);

      await subirDocumentoProyecto({
        archivo: pdf,
        idProyecto: documento.id_proyecto,
        idRequisito: documento.id_requisito,
      });

      await onActualizado();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Error escaneando documento."
      );
    } finally {
      setSubiendo(false);
      setArrastrando(false);
    }
  }

  function manejarClick() {
    if (tieneDocumento) {
      onAbrir(documento.url_documento);
      return;
    }

    const input = document.getElementById(inputPdfId) as HTMLInputElement | null;

    input?.click();
  }

  function abrirEscaner() {
    if (tieneDocumento || subiendo) return;

    const input = document.getElementById(
      inputEscanerId
    ) as HTMLInputElement | null;

    input?.click();
  }

  return (
    <div>
      <input
        id={inputPdfId}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          subirArchivo(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <input
        id={inputEscanerId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          subirEscaneo(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        disabled={subiendo}
        onClick={manejarClick}
        onDragOver={(e) => {
          if (tieneDocumento) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (tieneDocumento) return;
          e.preventDefault();
          subirArchivo(e.dataTransfer.files?.[0]);
        }}
        className={`w-full rounded border p-3 text-left transition ${
          tieneDocumento
            ? "border-green-300 hover:bg-green-50"
            : arrastrando
            ? "border-blue-400 bg-blue-50"
            : "border-red-300 hover:bg-red-50"
        }`}
      >
        <div className="flex items-start gap-2">
          <FileUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

          <div className="min-w-0">
            <div className="font-medium">{documento.nombre_requisito}</div>

            <div
              className={`text-xs ${
                tieneDocumento ? "text-green-600" : "text-red-500"
              }`}
            >
              {subiendo
                ? "Subiendo documento..."
                : tieneDocumento
                ? "Abrir documento"
                : arrastrando
                ? "Suelta el PDF aqui"
                : "Cargar documento"}
            </div>
          </div>
        </div>
      </button>

      {!tieneDocumento && (
        <button
          type="button"
          disabled={subiendo}
          onClick={abrirEscaner}
          title="Escanear con la camara"
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:border-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Escanear documento
        </button>
      )}
    </div>
  );
}

function leerArchivoComoDataUrl(archivo: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer la imagen escaneada."));
      }
    };

    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(archivo);
  });
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () =>
      reject(new Error("No se pudo convertir la imagen escaneada."));
    imagen.src = src;
  });
}

function normalizarImagen(imagen: HTMLImageElement) {
  const maxLado = 1800;
  const escala = Math.min(
    1,
    maxLado / Math.max(imagen.naturalWidth, imagen.naturalHeight)
  );
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error("No se pudo preparar la imagen escaneada.");
  }

  canvas.width = ancho;
  canvas.height = alto;
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const recorte = detectarRecorteDocumento(contexto, ancho, alto);
  const canvasEscaneado = document.createElement("canvas");
  const contextoEscaneado = canvasEscaneado.getContext("2d");

  if (!contextoEscaneado) {
    throw new Error("No se pudo recortar la imagen escaneada.");
  }

  canvasEscaneado.width = recorte.ancho;
  canvasEscaneado.height = recorte.alto;
  contextoEscaneado.fillStyle = "#ffffff";
  contextoEscaneado.fillRect(0, 0, recorte.ancho, recorte.alto);
  contextoEscaneado.drawImage(
    canvas,
    recorte.x,
    recorte.y,
    recorte.ancho,
    recorte.alto,
    0,
    0,
    recorte.ancho,
    recorte.alto
  );
  aplicarFiltroEscaner(contextoEscaneado, recorte.ancho, recorte.alto);

  return {
    ancho: recorte.ancho,
    alto: recorte.alto,
    dataUrl: canvasEscaneado.toDataURL("image/jpeg", 0.92),
  };
}

function detectarRecorteDocumento(
  contexto: CanvasRenderingContext2D,
  ancho: number,
  alto: number
): RecorteDocumento {
  const imagen = contexto.getImageData(0, 0, ancho, alto);
  const pixeles = imagen.data;
  const esquina = Math.max(18, Math.round(Math.min(ancho, alto) * 0.06));
  const coloresFondo = [
    promediarColor(pixeles, ancho, 0, 0, esquina, esquina),
    promediarColor(pixeles, ancho, ancho - esquina, 0, esquina, esquina),
    promediarColor(pixeles, ancho, 0, alto - esquina, esquina, esquina),
    promediarColor(
      pixeles,
      ancho,
      ancho - esquina,
      alto - esquina,
      esquina,
      esquina
    ),
  ];
  const paso = Math.max(1, Math.round(Math.min(ancho, alto) / 900));
  const margenIgnorado = Math.max(4, Math.round(Math.min(ancho, alto) * 0.015));
  const umbralFondo = estimarUmbralFondo(
    pixeles,
    ancho,
    alto,
    coloresFondo,
    esquina
  );
  let minX = ancho;
  let minY = alto;
  let maxX = 0;
  let maxY = 0;
  let candidatos = 0;

  for (let y = margenIgnorado; y < alto - margenIgnorado; y += paso) {
    for (let x = margenIgnorado; x < ancho - margenIgnorado; x += paso) {
      const indice = (y * ancho + x) * 4;
      const distancia = distanciaFondo(pixeles, indice, coloresFondo);

      if (distancia < umbralFondo) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      candidatos += 1;
    }
  }

  if (candidatos === 0) {
    return { x: 0, y: 0, ancho, alto };
  }

  const padding = Math.round(Math.min(ancho, alto) * 0.025);
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const x2 = Math.min(ancho, maxX + padding);
  const y2 = Math.min(alto, maxY + padding);
  const recorte = {
    x,
    y,
    ancho: Math.max(1, x2 - x),
    alto: Math.max(1, y2 - y),
  };

  return esRecorteConfiable(recorte, ancho, alto)
    ? recorte
    : { x: 0, y: 0, ancho, alto };
}

function promediarColor(
  pixeles: Uint8ClampedArray,
  anchoImagen: number,
  x: number,
  y: number,
  ancho: number,
  alto: number
): ColorRgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;

  for (let yy = y; yy < y + alto; yy += 1) {
    for (let xx = x; xx < x + ancho; xx += 1) {
      const indice = (yy * anchoImagen + xx) * 4;

      r += pixeles[indice];
      g += pixeles[indice + 1];
      b += pixeles[indice + 2];
      total += 1;
    }
  }

  return {
    r: r / total,
    g: g / total,
    b: b / total,
  };
}

function estimarUmbralFondo(
  pixeles: Uint8ClampedArray,
  ancho: number,
  alto: number,
  coloresFondo: ColorRgb[],
  esquina: number
) {
  const muestras = [
    { x: 0, y: 0 },
    { x: ancho - esquina, y: 0 },
    { x: 0, y: alto - esquina },
    { x: ancho - esquina, y: alto - esquina },
  ];
  let suma = 0;
  let sumaCuadrados = 0;
  let total = 0;
  const paso = Math.max(1, Math.round(esquina / 24));

  muestras.forEach((muestra) => {
    for (let y = muestra.y; y < muestra.y + esquina; y += paso) {
      for (let x = muestra.x; x < muestra.x + esquina; x += paso) {
        const indice = (y * ancho + x) * 4;
        const distancia = distanciaFondo(pixeles, indice, coloresFondo);

        suma += distancia;
        sumaCuadrados += distancia * distancia;
        total += 1;
      }
    }
  });

  const promedio = suma / Math.max(1, total);
  const varianza = sumaCuadrados / Math.max(1, total) - promedio * promedio;
  const desviacion = Math.sqrt(Math.max(0, varianza));

  return Math.max(32, promedio + desviacion * 3.5);
}

function distanciaFondo(
  pixeles: Uint8ClampedArray,
  indice: number,
  coloresFondo: ColorRgb[]
) {
  let menorDistancia = Number.POSITIVE_INFINITY;

  coloresFondo.forEach((color) => {
    const dr = pixeles[indice] - color.r;
    const dg = pixeles[indice + 1] - color.g;
    const db = pixeles[indice + 2] - color.b;
    const distancia = Math.sqrt(dr * dr + dg * dg + db * db);

    menorDistancia = Math.min(menorDistancia, distancia);
  });

  return menorDistancia;
}

function esRecorteConfiable(
  recorte: RecorteDocumento,
  anchoOriginal: number,
  altoOriginal: number
) {
  const areaOriginal = anchoOriginal * altoOriginal;
  const areaRecorte = recorte.ancho * recorte.alto;
  const proporcionArea = areaRecorte / areaOriginal;
  const proporcionAncho = recorte.ancho / anchoOriginal;
  const proporcionAlto = recorte.alto / altoOriginal;

  if (proporcionArea < 0.18 || proporcionArea > 0.96) return false;
  if (proporcionAncho < 0.28 || proporcionAlto < 0.28) return false;

  return true;
}

function aplicarFiltroEscaner(
  contexto: CanvasRenderingContext2D,
  ancho: number,
  alto: number
) {
  const imagen = contexto.getImageData(0, 0, ancho, alto);
  const pixeles = imagen.data;
  const totalPixeles = ancho * alto;
  const grises = new Uint8ClampedArray(totalPixeles);
  const histograma = new Uint32Array(256);

  for (let i = 0, p = 0; i < pixeles.length; i += 4, p += 1) {
    const gris = Math.round(
      pixeles[i] * 0.299 + pixeles[i + 1] * 0.587 + pixeles[i + 2] * 0.114
    );

    grises[p] = gris;
    histograma[gris] += 1;
  }

  const min = obtenerPercentil(histograma, totalPixeles, 0.02);
  const max = obtenerPercentil(histograma, totalPixeles, 0.98);
  const rango = Math.max(1, max - min);
  const grisesNivelados = new Uint8ClampedArray(totalPixeles);
  const integral = new Uint32Array((ancho + 1) * (alto + 1));

  for (let y = 0; y < alto; y += 1) {
    let sumaFila = 0;

    for (let x = 0; x < ancho; x += 1) {
      const indice = y * ancho + x;
      const nivelado = Math.max(
        0,
        Math.min(255, Math.round(((grises[indice] - min) / rango) * 255))
      );

      grisesNivelados[indice] = nivelado;
      sumaFila += nivelado;
      integral[(y + 1) * (ancho + 1) + x + 1] =
        integral[y * (ancho + 1) + x + 1] + sumaFila;
    }
  }

  const radio = Math.max(12, Math.round(Math.min(ancho, alto) * 0.018));

  for (let y = 0; y < alto; y += 1) {
    const y1 = Math.max(0, y - radio);
    const y2 = Math.min(alto - 1, y + radio);

    for (let x = 0; x < ancho; x += 1) {
      const x1 = Math.max(0, x - radio);
      const x2 = Math.min(ancho - 1, x + radio);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const suma =
        integral[(y2 + 1) * (ancho + 1) + x2 + 1] -
        integral[y1 * (ancho + 1) + x2 + 1] -
        integral[(y2 + 1) * (ancho + 1) + x1] +
        integral[y1 * (ancho + 1) + x1];
      const promedioLocal = suma / area;
      const indice = y * ancho + x;
      const gris = grisesNivelados[indice];
      const valor = gris < promedioLocal - 12 ? 32 : 255;
      const pixel = indice * 4;

      pixeles[pixel] = valor;
      pixeles[pixel + 1] = valor;
      pixeles[pixel + 2] = valor;
      pixeles[pixel + 3] = 255;
    }
  }

  contexto.putImageData(imagen, 0, 0);
}

function obtenerPercentil(
  histograma: Uint32Array,
  total: number,
  percentil: number
) {
  const objetivo = Math.floor(total * percentil);
  let acumulado = 0;

  for (let i = 0; i < histograma.length; i += 1) {
    acumulado += histograma[i];

    if (acumulado >= objetivo) {
      return i;
    }
  }

  return histograma.length - 1;
}
