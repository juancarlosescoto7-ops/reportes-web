"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Maximize, Printer } from "lucide-react";
import type { ControlTopeBorrador, RespuestaBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";
import { construirPresentacionBorrador, numeroPresupuesto, type NodoPresentacion, type PresentacionBorrador as ModeloPresentacion } from "@/modules/presupuesto/domain/presentacion-borrador";
import styles from "./PresentacionBorrador.module.css";

const moneda = (value: number | null) => value === null ? "Pendiente" : `L ${value.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PresentacionBorrador({ data }: { data: RespuestaBorrador }) {
  const modelo = useMemo(() => construirPresentacionBorrador(data), [data]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState("");
  const contenedor = useRef<HTMLDivElement>(null);
  const documento = useRef<HTMLDivElement>(null);

  function irA(seccion: string) {
    documento.current?.querySelector(`[data-seccion="${seccion}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function imprimir() {
    setError("");
    flushSync(() => setImprimiendo(true));
    const limpiar = () => setImprimiendo(false);
    window.addEventListener("afterprint", limpiar, { once: true });
    try { window.print(); }
    catch {
      window.removeEventListener("afterprint", limpiar);
      limpiar();
      setError("No se pudo abrir la impresión. Intenta nuevamente desde el navegador.");
    }
  }

  async function pantallaCompleta() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await contenedor.current?.requestFullscreen();
    } catch { setError("El navegador no permite abrir la presentación en pantalla completa."); }
  }

  return (
    <div ref={contenedor} className={styles.workspace}>
      <div className={styles.toolbar}>
        <nav aria-label="Secciones de la presentación">
          <button data-shortcut="349" type="button" onClick={() => irA("introduccion")}>Introducción</button>
          <button data-shortcut="350" type="button" onClick={() => irA("ingresos")}>Ingresos</button>
          <button data-shortcut="351" type="button" onClick={() => irA("egresos")}>Árbol de egresos</button>
        </nav>
        <div className={styles.actions}>
          <button data-shortcut="353" type="button" onClick={() => void pantallaCompleta()} title="Alternar pantalla completa"><Maximize size={15} aria-hidden="true" />Ampliar</button>
          <button data-shortcut="354" type="button" onClick={imprimir} className={styles.primary}><Printer size={15} aria-hidden="true" />Imprimir / PDF</button>
        </div>
      </div>
      {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
      <div className={styles.scroller} ref={documento}>
        <DocumentoPresentacion data={data} modelo={modelo} />
      </div>
      {imprimiendo ? createPortal(
        <div id="borrador-presupuesto-impresion" className={styles.printRoot}>
          <DocumentoPresentacion data={data} modelo={modelo} />
        </div>, document.body,
      ) : null}
    </div>
  );
}

function DocumentoPresentacion({ data, modelo }: { data: RespuestaBorrador; modelo: ModeloPresentacion }) {
  return (
    <div className={styles.document}>
      <section className={`${styles.sheet} ${styles.cover}`} data-seccion="introduccion" aria-label="Introducción">
        <div className={styles.eyebrow}>Formulación presupuestaria · {data.borrador?.estado.replaceAll("_", " ")}</div>
        <div className={styles.coverHeading}>
          <div><p className={styles.kicker}>Borrador municipal</p><h1>Presupuesto<br /><span>{data.borrador?.anio}</span></h1></div>
          <div className={styles.coverNote}><span>Documento de trabajo</span><strong>Ingresos proyectados<br />y techos presupuestarios</strong></div>
        </div>
        <div className={styles.introduction}>
          <h2>Introducción</h2>
          <p>Esta presentación expone la propuesta de estructura del presupuesto municipal para el ejercicio {data.borrador?.anio}. Reúne la proyección de ingresos propios por rubro, los ingresos previstos por transferencias del gobierno central y los techos que orientan la distribución de los recursos.</p>
          <p>El árbol presupuestario organiza los programas, subprogramas, proyectos, actividades, obras y objetos del gasto registrados en el borrador. Los techos se presentan como límites de planificación; la asignación de montos a las partidas se desarrollará en la formulación detallada.</p>
        </div>
        <div className={styles.steps}>
          <div><span>01</span><strong>Ingresos</strong><p>Recursos propios y transferencias previstas.</p></div>
          <div><span>02</span><strong>Árbol de egresos</strong><p>Funcionamiento e inversión en una estructura común.</p></div>
          <div><span>Dentro del árbol</span><strong>Techos y programas</strong><p>Límites compartidos por grupo y transferencias por programa.</p></div>
        </div>
        <p className={styles.caption}>Cifras en lempiras (L). Información del borrador {data.borrador?.anio}; los valores pendientes se identifican expresamente.</p>
      </section>

      <section className={styles.sheet} data-seccion="ingresos" aria-label="Resumen de ingresos">
        <Encabezado numero="01" titulo="Resumen de ingresos" detalle="Proyección de recursos para financiar el presupuesto municipal." />
        <div className={styles.metrics}>
          <Metrica label="Ingresos propios" value={modelo.propios} detalle={`${modelo.ingresos.length} rubros registrados`} />
          <Metrica label="Transferencias del gobierno central" value={modelo.transferencias} detalle="Proyección registrada en el borrador" />
          <Metrica label="Total propios + transferencias" value={modelo.total} detalle="Suma de las dos fuentes presentadas" principal />
        </div>
        <div className={styles.tableHeading}><h3>Ingresos propios por rubro</h3><span>Fuente 15-013-01</span></div>
        {modelo.ingresos.length ? <table className={styles.incomeTable}>
          <thead><tr><th scope="col">Código SAFT</th><th scope="col">Nombre del rubro</th><th scope="col">Proyección</th></tr></thead>
          <tbody>{modelo.ingresos.map((rubro) => <tr key={rubro.codigo}><td>{rubro.codigo}</td><td>{rubro.nombre}</td><td>{moneda(rubro.monto)}</td></tr>)}</tbody>
          <tfoot><tr><th colSpan={2} scope="row">Total de ingresos propios</th><td>{moneda(modelo.propios)}</td></tr></tfoot>
        </table> : <p className={styles.empty}>Todavía no se han registrado proyecciones de ingresos propios.</p>}
        {modelo.sinProyeccion ? <p className={styles.caption}>{modelo.sinProyeccion} rubros del catálogo aún no tienen una proyección en este borrador y no se incluyen en el total.</p> : null}
        <div className={styles.transfer}>
          <div><p className={styles.kicker}>Transferencias del gobierno central</p><h3>Fuente 11-001-01</h3><p>Base de ingresos registrada para calcular los techos de transferencias del borrador.</p></div>
          <strong>{moneda(modelo.transferencias)}</strong>
        </div>
        {modelo.otrasFuentes.length ? <aside className={styles.note}><strong>Otras fuentes registradas</strong><p>Se muestran por separado y no se suman al total de propios y transferencias.</p>{modelo.otrasFuentes.map((fuente) => <p key={fuente.id}>{fuente.fuente} · {fuente.nombre_fuente || "Sin nombre"}: <strong>{moneda(numeroPresupuesto(fuente.monto_base))}</strong></p>)}</aside> : null}
      </section>

      <section className={`${styles.sheet} ${styles.budgetTree}`} data-seccion="egresos" aria-label="Árbol presupuestario de egresos">
        <Encabezado numero="02" titulo="Árbol presupuestario de egresos" detalle="Una estructura común de programas, con los techos de financiamiento en el nivel que les corresponde." />
        <LeyendaArbol tieneAsignaciones={modelo.tieneAsignaciones} />
        <div className={styles.budgetRoot}><span>Presupuesto de egresos {data.borrador?.anio}</span><small>Estructura en formulación</small></div>
        <ul className={styles.groupBranches}>
          <li className={styles.budgetGroup}>
            <div className={styles.groupNode}>
              <div className={styles.groupTitle}><h3>Funcionamiento</h3><span>Programas 1–6</span></div>
              <div className={styles.ceilings}>{modelo.techosFuncionamiento.map((item) => <Techo key={item.fuente} {...item} compartido />)}</div>
              <p className={styles.groupCaption}>Techos compartidos por todos los programas de esta rama.</p>
            </div>
            <ul className={styles.programBranches}>
              {modelo.funcionamiento.length ? modelo.funcionamiento.map((programa) => <Programa key={programa.id} programa={programa} techo={modelo.techosPrograma.get(programa.id) ?? null} baseTransferencias={modelo.transferencias} />) : <li className={styles.empty}>Sin programas de funcionamiento registrados.</li>}
            </ul>
          </li>
          <li className={styles.budgetGroup}>
            <div className={styles.groupNode}>
              <div className={styles.groupTitle}><h3>Inversión</h3><span>Programas 11–16</span></div>
              <Techo {...modelo.techoInversionPropios} compartido />
              <p className={styles.groupCaption}>Fondos propios compartidos por esta rama. Transferencias específicas sobre cada programa.</p>
            </div>
            <ul className={styles.programBranches}>
              {modelo.inversion.length ? modelo.inversion.map((programa) => <Programa key={programa.id} programa={programa} techo={modelo.techosPrograma.get(programa.id) ?? null} baseTransferencias={modelo.transferencias} mostrarTecho />) : <li className={styles.empty}>Sin programas de inversión registrados.</li>}
            </ul>
          </li>
          {modelo.otros.length ? <li className={styles.budgetGroup}>
            <div className={styles.groupNode}><div className={styles.groupTitle}><h3>Otros programas</h3></div><p className={styles.groupCaption}>Programas fuera de los grupos 1–6 y 11–16.</p></div>
            <ul className={styles.programBranches}>{modelo.otros.map((programa) => <Programa key={programa.id} programa={programa} techo={modelo.techosPrograma.get(programa.id) ?? null} baseTransferencias={modelo.transferencias} />)}</ul>
          </li> : null}
        </ul>
      </section>
      {modelo.ramasSinPadre ? <p role="alert" className={styles.alert}>Hay {modelo.ramasSinPadre} elementos sin una rama superior disponible. Revisa la estructura del borrador para incluirlos en el árbol.</p> : null}
      <footer className={styles.footer}>Borrador de presupuesto {data.borrador?.anio} · Proyecciones de ingresos y techos de planificación · Cifras en lempiras</footer>
    </div>
  );
}

function Encabezado({ numero, titulo, detalle }: { numero: string; titulo: string; detalle: string }) {
  return <header className={styles.heading}><span>{numero}</span><div><h2>{titulo}</h2><p>{detalle}</p></div></header>;
}

function Metrica({ label, value, detalle, principal }: { label: string; value: number | null; detalle: string; principal?: boolean }) {
  return <div className={`${styles.metric} ${principal ? styles.metricPrimary : ""}`}><p>{label}</p><strong>{moneda(value)}</strong><span>{detalle}</span></div>;
}

function Techo({ titulo, fuente, base, techo, compartido }: { titulo: string; fuente: string; base: number | null; techo: ControlTopeBorrador | null; compartido?: boolean }) {
  const porcentaje = numeroPresupuesto(techo?.porcentaje_tope);
  const monto = base === null ? null : numeroPresupuesto(techo?.monto_permitido);
  return <div className={`${styles.ceiling} ${fuente === "15-013-01" ? styles.ownCeiling : styles.transferCeiling}`}>
    <div className={styles.ceilingTop}><span>{compartido ? "Techo compartido" : "Techo del programa"}</span><span>Fuente {fuente}</span></div>
    <h3>{titulo}</h3><strong className={styles.ceilingAmount}>{moneda(monto)}</strong>
    <p>{!techo ? "Techo no configurado en el borrador." : base === null ? "Proyección de ingresos pendiente." : porcentaje === null ? "Porcentaje no disponible." : `${porcentaje.toLocaleString("es-HN", { maximumFractionDigits: 2 })}% de ${moneda(numeroPresupuesto(techo.monto_fuente))}`}</p>
  </div>;
}

function LeyendaArbol({ tieneAsignaciones }: { tieneAsignaciones: boolean }) {
  return <div className={styles.treeLegend}><strong>Árbol presupuestario · Estructura sin montos de partidas</strong><p>Programa → Subprograma → Proyecto → Actividad → Obra → Objeto del gasto</p>{tieneAsignaciones ? <p>El borrador ya tiene algunas asignaciones. Esta presentación muestra únicamente la estructura y los techos.</p> : <p>Las partidas aún están pendientes de asignación; los techos indican los límites para formularlas.</p>}</div>;
}

function Programa({ programa, techo, baseTransferencias, mostrarTecho }: { programa: NodoPresentacion; techo: ControlTopeBorrador | null; baseTransferencias: number | null; mostrarTecho?: boolean }) {
  return <li className={styles.program}>
    {mostrarTecho || techo ? <div className={styles.programHeader}><Techo titulo={`Transferencias · Programa ${programa.codigo}`} fuente="11-001-01" base={baseTransferencias} techo={techo} /></div> : null}
    <details open className={styles.programDetails}>
      <summary className={styles.programTitle}><span className={styles.disclosure} aria-hidden="true" /><span>Programa {programa.codigo}</span><strong>{programa.nombre}</strong></summary>
      {programa.hijos.length ? <ul className={styles.tree}>{programa.hijos.map((nodo) => <Rama key={nodo.id} nodo={nodo} />)}</ul> : <p className={styles.empty}>Este programa aún no tiene subprogramas registrados.</p>}
    </details>
  </li>;
}

function Rama({ nodo }: { nodo: NodoPresentacion }) {
  return <li><div className={styles.treeRow}><span className={styles.level}>{nodo.nivel}</span><code>{nodo.codigo}</code><span>{nodo.nombre}</span></div>{nodo.hijos.length ? <ul>{nodo.hijos.map((hijo) => <Rama key={hijo.id} nodo={hijo} />)}</ul> : null}</li>;
}
