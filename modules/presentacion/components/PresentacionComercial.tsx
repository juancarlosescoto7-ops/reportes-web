"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LayoutList, Maximize, Minimize, NotebookPen, Printer, X } from "lucide-react";
import { diapositivas, planes } from "../config/contenido";
import styles from "./PresentacionComercial.module.css";

export default function PresentacionComercial() {
  const [actual, setActual] = useState(0);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const [error, setError] = useState("");
  const contenedor = useRef<HTMLDivElement>(null);
  const escenario = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function teclado(event: KeyboardEvent) {
      const elemento = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || elemento?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "Escape") { setIndiceAbierto(false); setNotasAbiertas(false); return; }
      if (indiceAbierto) return;
      const direccion = ["ArrowRight", "PageDown"].includes(event.key) ? 1 : ["ArrowLeft", "PageUp"].includes(event.key) ? -1 : 0;
      if (direccion) {
        event.preventDefault();
        setActual((valor) => Math.max(0, Math.min(diapositivas.length - 1, valor + direccion)));
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        setActual(event.key === "Home" ? 0 : diapositivas.length - 1);
      }
    }
    function sincronizarPantalla() { setAmpliada(document.fullscreenElement === contenedor.current); }
    document.addEventListener("keydown", teclado);
    document.addEventListener("fullscreenchange", sincronizarPantalla);
    return () => {
      document.removeEventListener("keydown", teclado);
      document.removeEventListener("fullscreenchange", sincronizarPantalla);
    };
  }, [indiceAbierto]);

  useEffect(() => { escenario.current?.scrollTo({ top: 0 }); }, [actual]);

  function irA(indice: number) {
    setActual(Math.max(0, Math.min(diapositivas.length - 1, indice)));
    setIndiceAbierto(false);
  }

  async function pantallaCompleta() {
    setError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (contenedor.current?.requestFullscreen) await contenedor.current.requestFullscreen();
      else setError("Este navegador no admite pantalla completa. Puedes usar la presentación en esta vista.");
    } catch { setError("No se pudo activar la pantalla completa. Puedes continuar en esta vista."); }
  }

  function imprimir() {
    setError("");
    try { window.print(); }
    catch { setError("No se pudo abrir la impresión. Intenta desde el menú del navegador."); }
  }

  return (
    <div className={styles.presentation} ref={contenedor}>
      <header className={styles.toolbar}>
        <Link data-shortcut-ignore href="/" className={styles.brand} aria-label="Volver al sistema"><ArrowLeft size={16} aria-hidden="true" /><span>REPORTES <b>WEB</b></span></Link>
        <span className={styles.toolbarCaption}>Documentación y gestión municipal</span>
        <div className={styles.tools}>
          <button data-shortcut-ignore type="button" aria-label="Contenido de la presentación" aria-expanded={indiceAbierto} aria-controls="indice-presentacion" onClick={() => setIndiceAbierto(!indiceAbierto)}><LayoutList size={17} aria-hidden="true" /><span>Contenido</span></button>
          <button data-shortcut-ignore type="button" aria-label="Imprimir o guardar presentación como PDF" onClick={imprimir}><Printer size={17} aria-hidden="true" /><span>PDF</span></button>
          <button data-shortcut-ignore type="button" aria-label={ampliada ? "Salir de pantalla completa" : "Pantalla completa"} onClick={() => void pantallaCompleta()}>{ampliada ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}<span>{ampliada ? "Reducir" : "Presentar"}</span></button>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}<button data-shortcut-ignore type="button" aria-label="Cerrar aviso" onClick={() => setError("")}><X size={16} /></button></p>}

      {indiceAbierto && <nav id="indice-presentacion" className={styles.index} aria-label="Diapositivas">
        <div className={styles.indexHeading}><strong>Contenido</strong><button data-shortcut-ignore type="button" aria-label="Cerrar contenido" onClick={() => setIndiceAbierto(false)}><X size={20} /></button></div>
        {diapositivas.map((diapositiva, i) => <button data-shortcut-ignore key={diapositiva.titulo} type="button" aria-current={i === actual ? "step" : undefined} onClick={() => irA(i)}><span>{String(i + 1).padStart(2, "0")}</span>{diapositiva.titulo}</button>)}
      </nav>}

      <main className={styles.stage} ref={escenario} aria-label="Presentación comercial">
        <Diapositiva key={actual} numero={actual} />
      </main>

      {notasAbiertas && <aside id="notas-presentacion" className={styles.notes} aria-label="Notas del expositor"><strong>Notas del expositor</strong><p>{diapositivas[actual].nota}</p><button data-shortcut-ignore type="button" aria-label="Cerrar notas" onClick={() => setNotasAbiertas(false)}><X size={18} /></button></aside>}

      <footer className={styles.controls}>
        <button data-shortcut-ignore type="button" className={styles.notesButton} aria-expanded={notasAbiertas} aria-controls="notas-presentacion" onClick={() => setNotasAbiertas(!notasAbiertas)}><NotebookPen size={16} aria-hidden="true" /><span>Notas</span></button>
        <nav className={styles.dots} aria-label="Ir a diapositiva">{diapositivas.map((slide, i) => <button data-shortcut-ignore type="button" key={slide.titulo} aria-label={`Diapositiva ${i + 1}: ${slide.titulo}`} aria-current={i === actual ? "step" : undefined} onClick={() => irA(i)}><span /></button>)}</nav>
        <div className={styles.arrows}>
          <span className={styles.counter} aria-live="polite" aria-atomic="true">{String(actual + 1).padStart(2, "0")} <span>/ {String(diapositivas.length).padStart(2, "0")}</span></span>
          <button data-shortcut-ignore type="button" aria-label="Diapositiva anterior" disabled={actual === 0} onClick={() => irA(actual - 1)}><ChevronLeft size={22} aria-hidden="true" /></button>
          <button data-shortcut-ignore type="button" aria-label="Diapositiva siguiente" disabled={actual === diapositivas.length - 1} onClick={() => irA(actual + 1)}><ChevronRight size={22} aria-hidden="true" /></button>
        </div>
      </footer>
      <div className={styles.progress} aria-hidden="true"><span style={{ width: `${((actual + 1) / diapositivas.length) * 100}%` }} /></div>

      <div className={styles.printDeck} aria-hidden="true">{diapositivas.map((slide, i) => <Diapositiva key={slide.titulo} numero={i} />)}</div>
    </div>
  );
}

function Diapositiva({ numero }: { numero: number }) {
  const slide = diapositivas[numero];
  const oscura = numero === 0 || numero === 4;
  return (
    <section className={`${styles.slide} ${oscura ? styles.dark : ""} ${numero === 7 ? styles.pricingSlide : ""}`} aria-label={`${numero + 1}. ${slide.titulo}`}>
      <div className={styles.slideHeading}><span>{slide.seccion}</span><span>{String(numero + 1).padStart(2, "0")}</span></div>
      {numero === 0 && <div className={styles.cover}>
        <div><h1>La documentación<br />de su municipalidad,<br /><em>a mano.</em></h1><p className={styles.lead}>Documentos organizados y conectados con su gestión, para responder cuando los necesita.</p></div>
        <div className={styles.coverStatement}><span className={styles.smallLabel}>Una solicitud cotidiana</span><blockquote>“Necesitamos{" "}<br />el respaldo{" "}<br />de este proyecto”.</blockquote><div className={styles.coverAnswer}><span>Su equipo encuentra los documentos<br />y reúne el expediente.</span><ArrowRight size={28} aria-hidden="true" /></div></div>
        <div className={styles.coverBottom}><span>Propuesta para municipalidades</span><span>Archivo documental y control de gestión</span></div>
      </div>}

      {numero === 1 && <div className={styles.problem}>
        <h2>El costo de buscar<br /><em>lo que ya existe</em></h2>
        <p className={styles.lead}>Cuando la información está dispersa, cada solicitud vuelve a empezar.</p>
        <div className={styles.problemRows}>{[
          ["01", "Encontrar", "Localizar el archivo y preguntar quién lo tiene."],
          ["02", "Reconstruir", "Relacionar documentos con el proyecto o el pago."],
          ["03", "Responder", "Reunir respaldos y descubrir qué hace falta."],
        ].map(([n, titulo, texto]) => <div key={n}><span>{n}</span><h3>{titulo}</h3><p>{texto}</p></div>)}</div>
        <p className={styles.takeaway}>El tiempo del equipo se va en preparar la información.</p>
      </div>}

      {numero === 2 && <div className={styles.context}>
        <div><h2>Cada documento,<br /><em>en su contexto</em></h2><p className={styles.lead}>Un respaldo tiene más valor cuando sabe a qué proyecto o pago pertenece.</p></div>
        <div className={styles.contextExample}><div className={styles.exampleLabel}>Ejemplo ilustrativo</div><h3>Mejoramiento de una calle</h3><dl><div><dt>Proyecto</dt><dd>Una referencia común para consultar su documentación.</dd></div><div><dt>Pagos</dt><dd>Operaciones relacionadas con la ejecución del proyecto.</dd></div><div><dt>Respaldos</dt><dd>Requisitos y PDF disponibles, con los pendientes a la vista.</dd></div></dl></div>
        <div className={styles.resultLine}><span>El resultado</span><p>Información reunida para encontrar el documento y entender qué respalda.</p></div>
      </div>}

      {numero === 3 && <div className={styles.expedients}>
        <h2>Un expediente<br /><em>para cada consulta</em></h2>
        <p className={styles.lead}>El sistema reúne los PDF disponibles según lo que su equipo necesita revisar.</p>
        <div className={styles.expedientColumns}>{[
          ["Por proyecto", "La historia de una obra", "Requisitos documentales y órdenes de pago relacionadas."],
          ["Por proveedor", "El respaldo de sus egresos", "Documentos de las órdenes seleccionadas para ese proveedor."],
          ["Por período", "La documentación de una fecha", "Egresos filtrados por un rango de fechas para preparar su revisión."],
        ].map(([tipo, titulo, texto]) => <div key={tipo}><span className={styles.smallLabel}>{tipo}</span><h3>{titulo}</h3><p>{texto}</p><span className={styles.pdfLabel}>Expediente PDF <ArrowRight size={17} aria-hidden="true" /></span></div>)}</div>
        <p className={styles.footnote}>La preparación del expediente utiliza los archivos cargados. Los documentos faltantes requieren gestión del equipo.</p>
      </div>}

      {numero === 4 && <div className={styles.audit}>
        <div><h2>La revisión empieza<br /><em>en el trabajo diario</em></h2><p className={styles.lead}>Preparar una auditoría es más sencillo cuando los respaldos se organizan durante la gestión.</p></div>
        <ol className={styles.auditSteps}><li><span>01</span><div><h3>Los pendientes, visibles</h3><p>Identifique requisitos y archivos que aún hace falta completar.</p></div></li><li><span>02</span><div><h3>La evidencia, reunida</h3><p>Filtre egresos y prepare el conjunto de PDF para su revisión.</p></div></li><li><span>03</span><div><h3>El criterio, en su equipo</h3><p>El personal revisa los documentos y determina las acciones.</p></div></li></ol>
        <div className={styles.resultLine}><span>Automatización útil</span><p>Menos recopilación manual para atender las solicitudes de respaldo.</p></div>
      </div>}

      {numero === 5 && <div className={styles.agility}>
        <h2>Más tiempo<br /><em>para dar seguimiento</em></h2>
        <div className={styles.agilityRows}><div><span>Documentos y proyectos</span><h3>Una base para preparar y revisar</h3><p>Reutilice información, genere órdenes de inicio y prepare borradores administrativos con apoyo de IA.</p></div><div><span>Panorama de gestión</span><h3>Información para priorizar</h3><p>Consulte presupuesto, ingresos, pagos y obligaciones pendientes dentro del mismo entorno.</p></div><div><span>Reportes SAFT y SAMI</span><h3>Menos trabajo de conversión</h3><p>Convierta reportes de ingresos SAFT mediante equivalencias con rubros SAMI.</p></div></div>
        <p className={styles.footnote}>El equipo revisa los borradores. El alcance actual de SAMI es conversión de reportes, sin sincronización automática directa.</p>
      </div>}

      {numero === 6 && <div className={styles.rollout}>
        <h2>Una puesta en marcha<br /><em>acompañada</em></h2>
        <p className={styles.lead}>Su municipalidad aporta la información y designa responsables. Nosotros acompañamos la adopción.</p>
        <ol className={styles.rolloutSteps}>{[
          ["Definimos el alcance", "Documentos, áreas y responsables de la primera etapa."],
          ["Organizamos la entrada", "Configuración institucional y carga inicial acordada."],
          ["Preparamos al equipo", "Capacitación y validación con un expediente de muestra."],
          ["Acompañamos el uso", "Soporte y mantenimiento según el plan elegido."],
        ].map(([titulo, texto], i) => <li key={titulo}><span>{String(i + 1).padStart(2, "0")}</span><h3>{titulo}</h3><p>{texto}</p></li>)}</ol>
        <div className={styles.resultLine}><span>Antes de activar</span><p>Acordamos accesos, copias de seguridad y recuperación de documentos.</p></div>
      </div>}

      {numero === 7 && <div className={styles.pricing}>
        <h2>Una inversión clara<br /><em>para su municipalidad</em></h2>
        <div className={styles.plans}>{planes.map((plan) => <div key={plan.nombre} className={`${styles.plan} ${plan.recomendado ? styles.recommended : ""}`}>
          <span className={styles.planLabel}>{plan.recomendado ? "Alcance recomendado" : plan.usuarios}</span><h3>{plan.nombre}</h3><p className={styles.planDescription}>{plan.descripcion}</p>
          <div className={styles.monthly}><span>L</span> {plan.mensual}<small>/ mes</small></div>
          <p className={styles.setup}>Implementación única <strong>L {plan.implementacion}</strong></p>
          <ul><li><Check size={14} aria-hidden="true" />{plan.usuarios} y {plan.almacenamiento} de archivos</li><li><Check size={14} aria-hidden="true" />Carga inicial: hasta {plan.carga}</li><li><Check size={14} aria-hidden="true" />Capacitación: {plan.capacitacion}</li><li><Check size={14} aria-hidden="true" />Soporte remoto: {plan.soporte}</li></ul>
        </div>)}</div>
        <p className={styles.priceTerms}>Propuesta preliminar en lempiras, antes de impuestos y sujeta a diagnóstico. Carga de PDF ya digitalizados y organizados. Digitalización física, integraciones y desarrollos nuevos se cotizan aparte.</p>
        <div className={styles.closing}><strong>El primer paso: un expediente de muestra.</strong><span>Definimos juntos el alcance que necesita su municipalidad.</span></div>
      </div>}
      <div className={styles.slideFooter}><span>REPORTES WEB</span><span>Documentación y gestión municipal</span></div>
    </section>
  );
}
