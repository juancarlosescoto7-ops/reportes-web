"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FilePlus, FileUp, RotateCcw, ScanLine, Upload, X } from "lucide-react";
import { DocumentoProyecto } from "@/services/documentacionProyectos";
import { subirDocumentoProyecto } from "@/services/documentosProyecto.service";

type Props = {
  documento: DocumentoProyecto;
  onAbrir: (rutaDocumento: string | null) => void;
  onActualizado: () => Promise<void> | void;
  onSubirArchivo?: (archivo: File) => Promise<void>;
  inputIdSuffix?: string;
  nombreEscaneo?: string;
};

type PaginaEscaneada = {
  dataUrl: string;
  ancho: number;
  alto: number;
  previewUrl: string;
};

type CapturaManual = {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  puntos: {
    topLeft: PuntoDocumento;
    topRight: PuntoDocumento;
    bottomLeft: PuntoDocumento;
    bottomRight: PuntoDocumento;
  };
};

type EsquinaDocumento = keyof CapturaManual["puntos"];

type JscanifyScanner = {
  extractPaper: (
    image: HTMLCanvasElement,
    resultWidth: number,
    resultHeight: number
  ) => HTMLCanvasElement | null;
};

type OpenCvRuntime = {
  Mat: new () => CvMat;
  MatVector: new () => CvMatVector;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  Scalar: new (...values: number[]) => unknown;
  CV_32FC2: number;
  COLOR_RGBA2GRAY: number;
  BORDER_DEFAULT: number;
  BORDER_CONSTANT: number;
  CHAIN_APPROX_SIMPLE: number;
  RETR_EXTERNAL: number;
  THRESH_BINARY: number;
  THRESH_OTSU: number;
  INTER_LINEAR: number;
  imread: (source: HTMLCanvasElement) => CvMat;
  imshow: (target: HTMLCanvasElement, source: CvMat) => void;
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  GaussianBlur: (
    src: CvMat,
    dst: CvMat,
    size: unknown,
    sigmaX: number,
    sigmaY: number,
    borderType: number
  ) => void;
  Canny: (src: CvMat, dst: CvMat, threshold1: number, threshold2: number) => void;
  threshold: (
    src: CvMat,
    dst: CvMat,
    threshold: number,
    maxValue: number,
    type: number
  ) => void;
  findContours: (
    image: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ) => void;
  contourArea: (contour: CvMat) => number;
  arcLength: (curve: CvMat, closed: boolean) => number;
  approxPolyDP: (
    curve: CvMat,
    approxCurve: CvMat,
    epsilon: number,
    closed: boolean
  ) => void;
  minAreaRect: (points: CvMat) => CvRotatedRect;
  RotatedRect: {
    points: (rect: CvRotatedRect) => PuntoDocumento[];
  };
  matFromArray: (
    rows: number,
    cols: number,
    type: number,
    data: number[]
  ) => CvMat;
  getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat;
  warpPerspective: (
    src: CvMat,
    dst: CvMat,
    matrix: CvMat,
    size: unknown,
    flags: number,
    borderMode: number,
    borderValue: unknown
  ) => void;
};

type CvMat = {
  rows: number;
  cols: number;
  data32S: Int32Array;
  delete: () => void;
};

type CvMatVector = {
  size: () => number;
  get: (index: number) => CvMat;
  delete: () => void;
};

type CvRotatedRect = {
  center: PuntoDocumento;
  size: {
    width: number;
    height: number;
  };
  angle: number;
};

type PuntoDocumento = {
  x: number;
  y: number;
};

type TamanoEditor = {
  width: number;
  height: number;
};

const ANCHO_HOJA_ESCANEADA = 1240;
const ALTO_HOJA_ESCANEADA = 1754;

declare global {
  interface Window {
    cv?: OpenCvRuntime & {
      onRuntimeInitialized?: () => void;
    };
  }
}

export default function RequisitoDocumentoCard({
  documento,
  onAbrir,
  onActualizado,
  onSubirArchivo,
  inputIdSuffix,
  nombreEscaneo,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [errorEscaner, setErrorEscaner] = useState<string | null>(null);
  const [procesandoEscaneo, setProcesandoEscaneo] = useState(false);
  const [documentoDetectado, setDocumentoDetectado] = useState(false);
  const [revisandoEscaneo, setRevisandoEscaneo] = useState(false);
  const [editandoEsquinas, setEditandoEsquinas] =
    useState<CapturaManual | null>(null);
  const [esquinaActiva, setEsquinaActiva] =
    useState<EsquinaDocumento | null>(null);
  const [paginasEscaneadas, setPaginasEscaneadas] = useState<PaginaEscaneada[]>(
    []
  );
  const [tamanoEditor, setTamanoEditor] = useState<TamanoEditor | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<JscanifyScanner | null>(null);

  const tieneDocumento = Boolean(documento.url_documento);
  const inputPdfId =
    inputIdSuffix ?? `input-doc-${documento.id_proyecto}-${documento.id_requisito}`;
  const anchoCapturaManual = editandoEsquinas?.canvas.width ?? 0;
  const altoCapturaManual = editandoEsquinas?.canvas.height ?? 0;

  async function subirArchivo(archivo: File | undefined) {
    if (!archivo || tieneDocumento) return;

    try {
      setSubiendo(true);

      if (onSubirArchivo) {
        await onSubirArchivo(archivo);
      } else {
        await subirDocumentoProyecto({
          archivo,
          idProyecto: documento.id_proyecto,
          idRequisito: documento.id_requisito,
        });
      }

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

  const crearPaginaDesdeEsquinas = useCallback(
    (
      canvas: HTMLCanvasElement,
      puntos: {
        topLeft: PuntoDocumento;
        topRight: PuntoDocumento;
        bottomLeft: PuntoDocumento;
        bottomRight: PuntoDocumento;
      }
    ) => {
      const imagenNormalizada = normalizarImagenManual(canvas, puntos);

      return {
        dataUrl: imagenNormalizada.dataUrl,
        ancho: imagenNormalizada.ancho,
        alto: imagenNormalizada.alto,
        previewUrl: imagenNormalizada.dataUrl,
      };
    },
    []
  );

  const crearPdfMultipagina = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const primeraPagina = paginasEscaneadas[0];

    if (!primeraPagina) {
      throw new Error("Debe capturar al menos una pagina.");
    }

    const orientacion =
      primeraPagina.ancho > primeraPagina.alto ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation: orientacion,
      unit: "pt",
      format: "a4",
    });

    paginasEscaneadas.forEach((pagina, index) => {
      const paginaEsHorizontal = pagina.ancho > pagina.alto;

      if (index > 0) {
        pdf.addPage("a4", paginaEsHorizontal ? "landscape" : "portrait");
      }

      const anchoPagina = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      const margen = 12;
      const anchoDisponible = anchoPagina - margen * 2;
      const altoDisponible = altoPagina - margen * 2;
      const escala = Math.min(
        anchoDisponible / pagina.ancho,
        altoDisponible / pagina.alto
      );
      const anchoImagen = pagina.ancho * escala;
      const altoImagen = pagina.alto * escala;
      const x = (anchoPagina - anchoImagen) / 2;
      const y = (altoPagina - altoImagen) / 2;

      pdf.addImage(
        pagina.dataUrl,
        "JPEG",
        x,
        y,
        anchoImagen,
        altoImagen
      );
    });

    return new File(
      [pdf.output("blob")],
      nombreEscaneo ??
        `ESCANEO_${documento.id_proyecto}_${documento.id_requisito}.pdf`,
      { type: "application/pdf" }
    );
  }, [
    documento.id_proyecto,
    documento.id_requisito,
    nombreEscaneo,
    paginasEscaneadas,
  ]);

  function manejarClick() {
    if (tieneDocumento) {
      onAbrir(documento.url_documento);
      return;
    }

    const input = document.getElementById(inputPdfId) as HTMLInputElement | null;

    input?.click();
  }

  async function iniciarCamara() {
    try {
      setErrorEscaner(null);
      scannerRef.current = await cargarScannerDocumental();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 4096 },
          height: { ideal: 3072 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error(error);
      setErrorEscaner(
        "No se pudo abrir la camara. Revise permisos del navegador."
      );
    }
  }

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function abrirEscaner() {
    if (tieneDocumento || subiendo) return;

    setEscanerAbierto(true);
  }

  const prepararBorradorEscaneo = useCallback(async () => {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorEscaner("La camara aun no esta lista.");
      return;
    }

    try {
      setProcesandoEscaneo(true);
      setErrorEscaner(null);

      const canvas = document.createElement("canvas");
      const contexto = canvas.getContext("2d");

      if (!contexto) {
        throw new Error("No se pudo preparar la captura.");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

      const paginaAutomatica = extraerPaginaAutomatica(
        canvas,
        scannerRef.current
      );

      if (paginaAutomatica) {
        setPaginasEscaneadas((actual) => [...actual, paginaAutomatica]);
        setEditandoEsquinas(null);
        setRevisandoEscaneo(true);
        setDocumentoDetectado(false);
        return;
      }

      setEditandoEsquinas(crearCapturaManual(canvas));
      setRevisandoEscaneo(false);
      setDocumentoDetectado(false);
    } catch (error) {
      console.error(error);
      setErrorEscaner(
        error instanceof Error ? error.message : "Error escaneando documento."
      );
    } finally {
      setProcesandoEscaneo(false);
    }
  }, []);

  function moverEsquina(
    esquina: EsquinaDocumento,
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    const rect = editorRef.current?.getBoundingClientRect();

    if (!rect || !editandoEsquinas) return;

    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    setEditandoEsquinas((actual) =>
      actual
        ? {
            ...actual,
            puntos: {
              ...actual.puntos,
              [esquina]: {
                x: x * actual.canvas.width,
                y: y * actual.canvas.height,
              },
            },
          }
        : actual
    );
  }

  function aplicarEsquinasManuales() {
    if (!editandoEsquinas) return;

    try {
      setProcesandoEscaneo(true);
      const pagina = crearPaginaDesdeEsquinas(
        editandoEsquinas.canvas,
        editandoEsquinas.puntos
      );

      setPaginasEscaneadas((actual) => [...actual, pagina]);
      setEditandoEsquinas(null);
      setRevisandoEscaneo(true);
    } catch (error) {
      console.error(error);
      setErrorEscaner(
        error instanceof Error
          ? error.message
          : "No se pudo aplicar la perspectiva."
      );
    } finally {
      setProcesandoEscaneo(false);
    }
  }

  async function confirmarEscaneo() {
    if (paginasEscaneadas.length === 0) return;

    try {
      setSubiendo(true);
      setErrorEscaner(null);
      const archivo = await crearPdfMultipagina();

      if (onSubirArchivo) {
        await onSubirArchivo(archivo);
      } else {
        await subirDocumentoProyecto({
          archivo,
          idProyecto: documento.id_proyecto,
          idRequisito: documento.id_requisito,
        });
      }

      await onActualizado();
      setEscanerAbierto(false);
    } catch (error) {
      console.error(error);
      setErrorEscaner(
        error instanceof Error ? error.message : "Error subiendo escaneo."
      );
    } finally {
      setSubiendo(false);
    }
  }

  function repetirEscaneo() {
    limpiarUltimaPaginaEscaneada();
    setRevisandoEscaneo(false);
    setEditandoEsquinas(null);
    setEsquinaActiva(null);
    setErrorEscaner(null);
  }

  function limpiarUltimaPaginaEscaneada() {
    setPaginasEscaneadas((actual) => actual.slice(0, -1));
  }

  function continuarEscaneando() {
    setErrorEscaner(null);
    setDocumentoDetectado(false);
    setRevisandoEscaneo(false);
    setEditandoEsquinas(null);
    setEsquinaActiva(null);
  }

  useEffect(() => {
    if (!escanerAbierto) {
      detenerCamara();
      setPaginasEscaneadas([]);
      setRevisandoEscaneo(false);
      setEditandoEsquinas(null);
      setEsquinaActiva(null);
      setTamanoEditor(null);
      return;
    }

    iniciarCamara();

    return () => detenerCamara();
  }, [escanerAbierto]);

  useEffect(() => {
    if (
      !escanerAbierto ||
      Boolean(editandoEsquinas) ||
      revisandoEscaneo ||
      subiendo ||
      procesandoEscaneo
    ) {
      return;
    }

    let deteccionesSeguidas = 0;
    let capturando = false;
    const intervalo = window.setInterval(async () => {
      if (capturando) return;

      const detectado = detectarDocumentoEnVideo(
        videoRef.current,
        scannerRef.current
      );
      setDocumentoDetectado(detectado);

      deteccionesSeguidas = detectado ? deteccionesSeguidas + 1 : 0;

      if (deteccionesSeguidas >= 4) {
        capturando = true;
        await prepararBorradorEscaneo();
      }
    }, 650);

    return () => window.clearInterval(intervalo);
  }, [
    escanerAbierto,
    editandoEsquinas,
    prepararBorradorEscaneo,
    procesandoEscaneo,
    revisandoEscaneo,
    subiendo,
  ]);

  useEffect(() => {
    if (
      anchoCapturaManual <= 0 ||
      altoCapturaManual <= 0 ||
      !editorViewportRef.current
    ) {
      setTamanoEditor(null);
      return;
    }

    const actualizarTamano = () => {
      const rect = editorViewportRef.current?.getBoundingClientRect();

      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      setTamanoEditor(
        calcularTamanoAjustado(
          anchoCapturaManual,
          altoCapturaManual,
          rect.width,
          rect.height
        )
      );
    };

    actualizarTamano();

    const observer = new ResizeObserver(actualizarTamano);

    observer.observe(editorViewportRef.current);
    window.addEventListener("orientationchange", actualizarTamano);
    window.addEventListener("resize", actualizarTamano);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", actualizarTamano);
      window.removeEventListener("resize", actualizarTamano);
    };
  }, [altoCapturaManual, anchoCapturaManual]);

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
        className={`w-full rounded-md border p-3 text-left shadow-sm backdrop-blur-xl transition ${
          tieneDocumento
            ? "border-emerald-300/70 bg-emerald-50/45 hover:bg-emerald-50/70"
            : arrastrando
            ? "border-sky-400/80 bg-sky-50/65 shadow-sky-900/10"
            : "border-red-300/70 bg-white/55 hover:bg-red-50/50"
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
        <div className="mt-2 grid grid-cols-1 gap-2 md:hidden">
          <button
            type="button"
            disabled={subiendo}
            onClick={abrirEscaner}
            title="Escanear documento"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300/70 bg-white/65 px-3 text-[12px] font-medium text-slate-700 shadow-sm backdrop-blur-xl transition hover:border-[#005f48]/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            Escanear documento
          </button>
        </div>
      )}

      {escanerAbierto && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-white md:hidden">
          <div className="grid h-12 grid-cols-[1fr_auto] items-center border-b border-white/10 bg-white/5 px-3 backdrop-blur-xl">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold">
                {documento.nombre_requisito}
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/55">
                Escaner documental
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEscanerAbierto(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10"
              title="Cerrar escaner"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative h-[clamp(300px,58dvh,520px)] flex-none bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            {!revisandoEscaneo && !editandoEsquinas && (
              <>
                <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-[0.707/1] h-[78%] max-h-[82vw] -translate-x-1/2 -translate-y-1/2 border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />

                <div
                  className={[
                    "pointer-events-none absolute left-1/2 top-[7%] -translate-x-1/2 border px-3 py-1 text-[11px] font-semibold",
                    documentoDetectado
                      ? "border-emerald-300 bg-emerald-950/80 text-emerald-50"
                      : "border-white/20 bg-slate-950/70 text-white/70",
                  ].join(" ")}
                >
                  {documentoDetectado
                    ? "Documento detectado. Capturando..."
                    : "Alinee la hoja dentro del marco"}
                </div>
              </>
            )}

            {editandoEsquinas && (
              <div
                ref={editorViewportRef}
                className="absolute inset-0 flex items-center justify-center bg-slate-900 p-3"
              >
                <div
                  ref={editorRef}
                  className="relative touch-none overflow-hidden bg-black"
                  style={{
                    width: tamanoEditor
                      ? `${tamanoEditor.width}px`
                      : "min(100%, 320px)",
                    height: tamanoEditor
                      ? `${tamanoEditor.height}px`
                      : "min(100%, 420px)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editandoEsquinas.dataUrl}
                    alt="Documento capturado"
                    className="h-full w-full select-none object-fill"
                    draggable={false}
                  />

                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${editandoEsquinas.canvas.width} ${editandoEsquinas.canvas.height}`}
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={[
                        editandoEsquinas.puntos.topLeft,
                        editandoEsquinas.puntos.topRight,
                        editandoEsquinas.puntos.bottomRight,
                        editandoEsquinas.puntos.bottomLeft,
                      ]
                        .map((p) => `${p.x},${p.y}`)
                        .join(" ")}
                      fill="rgba(16,185,129,0.16)"
                      stroke="rgb(110,231,183)"
                      strokeWidth="10"
                    />
                  </svg>

                  {(
                    [
                      ["topLeft", "SI"],
                      ["topRight", "SD"],
                      ["bottomLeft", "II"],
                      ["bottomRight", "ID"],
                    ] as const
                  ).map(([key, label]) => {
                    const punto = editandoEsquinas.puntos[key];

                    return (
                      <button
                        key={key}
                        type="button"
                        onPointerDown={(event) => {
                          setEsquinaActiva(key);
                          event.currentTarget.setPointerCapture(
                            event.pointerId
                          );
                          moverEsquina(key, event);
                        }}
                        onPointerMove={(event) => {
                          if (
                            event.currentTarget.hasPointerCapture(
                              event.pointerId
                            )
                          ) {
                            moverEsquina(key, event);
                          }
                        }}
                        onPointerUp={(event) => {
                          if (
                            event.currentTarget.hasPointerCapture(
                              event.pointerId
                            )
                          ) {
                            event.currentTarget.releasePointerCapture(
                              event.pointerId
                            );
                          }
                        }}
                        onFocus={() => setEsquinaActiva(key)}
                        className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-bold text-white shadow-lg"
                        style={{
                          left: `${(punto.x / editandoEsquinas.canvas.width) * 100}%`,
                          top: `${(punto.y / editandoEsquinas.canvas.height) * 100}%`,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}

                  {esquinaActiva && (
                    <div className="pointer-events-none absolute right-2 top-2 h-32 w-32 overflow-hidden rounded-full border-2 border-white bg-black shadow-2xl">
                      <div
                        className="h-full w-full"
                        style={{
                          backgroundImage: `url(${editandoEsquinas.dataUrl})`,
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "300% 300%",
                          backgroundPosition: `${calcularPosicionLupa(
                            editandoEsquinas.puntos[esquinaActiva].x,
                            editandoEsquinas.canvas.width
                          )}% ${calcularPosicionLupa(
                            editandoEsquinas.puntos[esquinaActiva].y,
                            editandoEsquinas.canvas.height
                          )}%`,
                        }}
                      />

                      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-red-500" />
                      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-red-500" />
                      <div className="absolute inset-1 rounded-full border border-white/70" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {revisandoEscaneo && paginasEscaneadas.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={paginasEscaneadas[paginasEscaneadas.length - 1].previewUrl}
                  alt="Vista previa del escaneo"
                  className="max-h-full max-w-full border border-white/20 bg-white object-contain"
                />

                <div className="absolute left-3 top-3 border border-white/20 bg-slate-950/80 px-2 py-1 text-[11px] font-semibold">
                  Pagina {paginasEscaneadas.length}
                </div>
              </div>
            )}

            {errorEscaner && (
              <div className="absolute inset-x-4 top-4 border border-red-300 bg-red-950/85 px-3 py-2 text-[12px] text-red-50">
                {errorEscaner}
              </div>
            )}
          </div>

          <div className="grid gap-2 border-t border-white/10 bg-slate-950 p-3">
            {editandoEsquinas ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={procesandoEscaneo}
                  onClick={() => setEditandoEsquinas(null)}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Repetir
                </button>

                <button
                  type="button"
                  disabled={procesandoEscaneo}
                  onClick={aplicarEsquinasManuales}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white text-[13px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  {procesandoEscaneo ? "Aplicando..." : "Aplicar"}
                </button>
              </div>
            ) : revisandoEscaneo && paginasEscaneadas.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={subiendo}
                  onClick={repetirEscaneo}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Repetir
                </button>

                <button
                  type="button"
                  disabled={subiendo}
                  onClick={continuarEscaneando}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilePlus className="h-4 w-4" aria-hidden="true" />
                  Agregar
                </button>

                <button
                  type="button"
                  disabled={subiendo}
                  onClick={confirmarEscaneo}
                  className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white text-[13px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {subiendo
                    ? "Subiendo..."
                    : `Confirmar ${paginasEscaneadas.length} pagina${
                        paginasEscaneadas.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={procesandoEscaneo}
                onClick={prepararBorradorEscaneo}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-white text-[13px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {procesandoEscaneo ? "Procesando..." : "Capturar"}
              </button>
            )}

            <div className="text-center text-[11px] leading-4 text-white/55">
              {editandoEsquinas
                ? "Mueva los cuatro puntos a las esquinas reales del documento."
                : paginasEscaneadas.length > 0
                ? "Revise la ultima pagina, agregue mas paginas o confirme el PDF."
                : "El sistema puede capturar automaticamente cuando detecte la hoja estable."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function cargarScannerDocumental(): Promise<JscanifyScanner> {
  await cargarOpenCv();
  const modulo = await import("jscanify/client");
  const Jscanify = modulo.default as new () => JscanifyScanner;

  return new Jscanify();
}

function cargarOpenCv() {
  return new Promise<void>((resolve, reject) => {
    if (window.cv?.Mat) {
      resolve();
      return;
    }

    const scriptExistente = document.querySelector<HTMLScriptElement>(
      'script[data-opencv="true"]'
    );

    if (scriptExistente) {
      scriptExistente.addEventListener("load", () => esperarOpenCv(resolve));
      scriptExistente.addEventListener("error", () =>
        reject(new Error("No se pudo cargar OpenCV."))
      );
      return;
    }

    const script = document.createElement("script");

    script.src = "/vendor/opencv.js";
    script.async = true;
    script.dataset.opencv = "true";
    script.onload = () => esperarOpenCv(resolve);
    script.onerror = () => reject(new Error("No se pudo cargar OpenCV."));
    document.body.appendChild(script);
  });
}

function esperarOpenCv(resolve: () => void) {
  if (window.cv?.Mat) {
    resolve();
    return;
  }

  if (window.cv) {
    window.cv.onRuntimeInitialized = () => resolve();
  }
}

function normalizarImagenManual(
  imagen: HTMLCanvasElement,
  puntos: CapturaManual["puntos"]
) {
  const canvasEscaneado = extraerDocumentoConPuntos(imagen, puntos);
  const contextoEscaneado = canvasEscaneado.getContext("2d");

  if (!contextoEscaneado) {
    throw new Error("No se pudo procesar la imagen escaneada.");
  }

  aplicarFiltroEscalaGrises(
    contextoEscaneado,
    canvasEscaneado.width,
    canvasEscaneado.height
  );

  return {
    ancho: canvasEscaneado.width,
    alto: canvasEscaneado.height,
    dataUrl: canvasEscaneado.toDataURL("image/jpeg", 0.95),
  };
}

function extraerPaginaAutomatica(
  captura: HTMLCanvasElement,
  scanner: JscanifyScanner | null
): PaginaEscaneada | null {
  if (!scanner) return null;

  try {
    const hoja = scanner.extractPaper(
      captura,
      ANCHO_HOJA_ESCANEADA,
      ALTO_HOJA_ESCANEADA
    );

    if (!hoja) return null;

    const contexto = hoja.getContext("2d");

    if (!contexto) return null;

    aplicarFiltroEscalaGrises(contexto, hoja.width, hoja.height);

    const dataUrl = hoja.toDataURL("image/jpeg", 0.95);

    return {
      dataUrl,
      ancho: hoja.width,
      alto: hoja.height,
      previewUrl: dataUrl,
    };
  } catch {
    return null;
  }
}

function crearCapturaManual(canvas: HTMLCanvasElement): CapturaManual {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const margenX = canvas.width * 0.12;
  const margenY = canvas.height * 0.08;

  return {
    canvas,
    dataUrl,
    puntos: {
      topLeft: { x: margenX, y: margenY },
      topRight: { x: canvas.width - margenX, y: margenY },
      bottomLeft: { x: margenX, y: canvas.height - margenY },
      bottomRight: { x: canvas.width - margenX, y: canvas.height - margenY },
    },
  };
}

function extraerDocumentoConPuntos(
  canvas: HTMLCanvasElement,
  puntos: CapturaManual["puntos"]
) {
  const cv = window.cv;

  if (!cv?.Mat) {
    throw new Error("OpenCV no esta disponible.");
  }

  const src = cv.imread(canvas);

  try {
    return corregirPerspectiva(cv, src, puntos);
  } finally {
    src.delete();
  }
}

function corregirPerspectiva(
  cv: OpenCvRuntime,
  src: CvMat,
  esquinas: {
    topLeft: PuntoDocumento;
    topRight: PuntoDocumento;
    bottomLeft: PuntoDocumento;
    bottomRight: PuntoDocumento;
  }
) {
  const anchoSuperior = distanciaPuntos(esquinas.topLeft, esquinas.topRight);
  const anchoInferior = distanciaPuntos(esquinas.bottomLeft, esquinas.bottomRight);
  const altoIzquierdo = distanciaPuntos(esquinas.topLeft, esquinas.bottomLeft);
  const altoDerecho = distanciaPuntos(esquinas.topRight, esquinas.bottomRight);
  const ancho = Math.max(1, Math.round(Math.max(anchoSuperior, anchoInferior)));
  const alto = Math.max(1, Math.round(Math.max(altoIzquierdo, altoDerecho)));
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    esquinas.topLeft.x,
    esquinas.topLeft.y,
    esquinas.topRight.x,
    esquinas.topRight.y,
    esquinas.bottomLeft.x,
    esquinas.bottomLeft.y,
    esquinas.bottomRight.x,
    esquinas.bottomRight.y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    ancho,
    0,
    0,
    alto,
    ancho,
    alto,
  ]);
  const matriz = cv.getPerspectiveTransform(srcTri, dstTri);
  const destino = new cv.Mat();
  const salida = document.createElement("canvas");

  try {
    cv.warpPerspective(
      src,
      destino,
      matriz,
      new cv.Size(ancho, alto),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    );
    cv.imshow(salida, destino);
  } finally {
    srcTri.delete();
    dstTri.delete();
    matriz.delete();
    destino.delete();
  }

  return salida;
}

function distanciaPuntos(a: PuntoDocumento, b: PuntoDocumento) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function calcularPosicionLupa(valor: number, maximo: number) {
  return Math.max(0, Math.min(100, (valor / maximo) * 100));
}

function calcularTamanoAjustado(
  anchoImagen: number,
  altoImagen: number,
  anchoDisponible: number,
  altoDisponible: number
): TamanoEditor {
  const escala = Math.min(
    anchoDisponible / anchoImagen,
    altoDisponible / altoImagen
  );

  return {
    width: Math.max(1, Math.floor(anchoImagen * escala)),
    height: Math.max(1, Math.floor(altoImagen * escala)),
  };
}

function detectarDocumentoEnVideo(
  video: HTMLVideoElement | null,
  scanner: JscanifyScanner | null
) {
  if (!video || !scanner || video.videoWidth === 0 || video.videoHeight === 0) {
    return false;
  }

  const anchoAnalisis = 420;
  const escala = anchoAnalisis / video.videoWidth;
  const altoAnalisis = Math.max(1, Math.round(video.videoHeight * escala));
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");

  if (!contexto) return false;

  canvas.width = anchoAnalisis;
  canvas.height = altoAnalisis;
  contexto.drawImage(video, 0, 0, anchoAnalisis, altoAnalisis);

  try {
    return Boolean(scanner.extractPaper(canvas, 360, 510));
  } catch {
    return false;
  }
}

function aplicarFiltroEscalaGrises(
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

  const min = obtenerPercentil(histograma, totalPixeles, 0.01);
  const max = obtenerPercentil(histograma, totalPixeles, 0.99);
  const rango = Math.max(1, max - min);

  for (let indice = 0; indice < totalPixeles; indice += 1) {
    const grisOriginal = grises[indice];
    const normalizado = Math.max(
      0,
      Math.min(255, ((grisOriginal - min) / rango) * 255)
    );
    const nivelado = 255 * Math.pow(normalizado / 255, 0.96);
    const valor = Math.round(grisOriginal * 0.28 + nivelado * 0.72);
    const pixel = indice * 4;

    pixeles[pixel] = valor;
    pixeles[pixel + 1] = valor;
    pixeles[pixel + 2] = valor;
    pixeles[pixel + 3] = 255;
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
