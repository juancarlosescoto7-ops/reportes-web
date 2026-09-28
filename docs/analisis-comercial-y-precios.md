# Análisis comercial y propuesta preliminar de precios

Fecha: 25 de septiembre de 2026. Estado: contenido para revisión del propietario; todavía no se crea la presentación dentro del sistema.

## 1. Recomendación comercial

**«La documentación de su municipalidad, organizada y conectada con su gestión, para encontrar respuestas y preparar expedientes cuando los necesita».**

La puerta de entrada comercial debe ser la documentación: localizar respaldos, reunir expedientes y atender revisiones. El presupuesto, los pagos, los ingresos y la asistencia con IA aportan contexto y amplían el valor del servicio. La presentación debe explicar resultados de trabajo, sin recorrer cada pantalla.

Público propuesto: alcaldía, gerencia municipal, tesorería, presupuesto, responsables de proyectos y auditoría interna. Los problemas siguientes son hipótesis comerciales a contrastar con cada municipalidad, no hechos comprobados sobre sus procesos actuales.

## 2. Problema → solución → resultado esperado

| Problema del cliente | Qué aporta el sistema | Qué obtiene la municipalidad |
| --- | --- | --- |
| Encontrar el respaldo de un pago o proyecto requiere buscar en distintos lugares. | Guarda PDF asociados a proyectos, requisitos y órdenes; ofrece consulta y búsqueda de registros relacionados. | Documentos localizables dentro de su contexto administrativo. |
| Preparar una revisión exige reunir archivos uno por uno. | Filtra egresos por proveedor y fechas; reúne los PDF disponibles y genera expedientes de proyectos. | Menos trabajo de recopilación y una entrega documental ordenada. |
| Los documentos pendientes se descubren tarde. | Muestra requisitos, archivos faltantes y bandejas de pendientes. | Un equipo que puede completar respaldos durante la gestión. |
| Es difícil reconstruir qué se ha hecho y pagado en una obra. | Relaciona proyectos, obras presupuestarias, requisitos y órdenes de pago. | Una consulta conjunta del proyecto y su respaldo documental y financiero. |
| Preparar documentos administrativos consume trabajo repetitivo. | Reutiliza datos, genera órdenes de inicio y ayuda a redactar borradores y descripciones. | Menos transcripción y una base editable para revisión del responsable. |
| La autoridad depende de reportes separados para conocer la situación. | Reúne ingresos, egresos, obligaciones, presupuesto y pendientes. | Mejor visibilidad para dar seguimiento y priorizar gestiones. |
| Convertir reportes y contrastar depósitos exige trabajo manual. | Convierte rubros SAFT a SAMI mediante equivalencias y apoya la conciliación de depósitos. | Menos reprocesamiento y diferencias más fáciles de revisar. |
| El conocimiento de dónde están los documentos depende de personas concretas. | Centraliza registros y documentación, con accesos por función. | Continuidad de consulta cuando cambia el personal, siempre que se mantenga la carga y administración del archivo. |

Los beneficios de tiempo y continuidad son esperados. No hay mediciones locales que permitan prometer porcentajes de ahorro o plazos exactos.

## 3. Qué se puede afirmar y qué falta

| Tema solicitado | Evidencia encontrada | Formulación comercial adecuada |
| --- | --- | --- |
| Resguardo documental | Carga, escaneo y combinación de PDF, vinculados principalmente a proyectos, pagos y obligaciones. | «Organice y consulte la documentación que respalda su gestión». No equivale todavía a un archivo general de todas las dependencias municipales. |
| Expedientes por proyecto | Generación de PDF con requisitos disponibles y órdenes relacionadas. | «Reúna en un expediente los documentos disponibles de cada proyecto». Un PDF generado puede seguir incompleto si faltan documentos de origen. |
| Expedientes por proveedor y fecha | Auditoría filtra órdenes por proveedor y rango de fechas y combina sus PDF. | «Prepare el respaldo de los egresos de un proveedor o período». No es todavía una carpeta integral del proveedor con todos sus contratos, trámites y documentos ajenos a esos egresos. |
| Expedientes por programa | Hay jerarquía presupuestaria y búsqueda por relaciones de programa/proyecto/actividad/obra. | La consulta relacionada tiene base; un generador específico de expediente completo por programa no fue identificado. Tratarlo como ampliación. |
| Automatización de auditoría | Filtrado, totales, detección de ausencia de PDF y recopilación de archivos. La vista de auditoría indica que no incluye ejecución presupuestaria. | «Automatice la recopilación de respaldos y facilite la revisión de egresos». No prometer dictámenes, detección integral de irregularidades ni auditoría autónoma. |
| Formulación de proyectos | Creación desde obras, relación presupuestaria, expediente, orden de inicio y borradores administrativos. | «Agilice la preparación documental y el seguimiento de proyectos». No se identificó formulación técnica integral: estudios, diseños, factibilidad o perfiles completos validados. |
| Relación con SAMI | Catálogos y equivalencias SAFT/SAMI; carga de Excel SAFT y generación de informe convertido. | «Facilite la preparación de información compatible con los rubros SAMI». La vinculación documental directa con registros externos necesita comprobar el flujo real de importación y sus identificadores. No se encontró conector automático bidireccional. |
| IA | Consulta contextual, requisitos según descripción, recomendaciones y redacción. | «Asistencia para consultar, clasificar necesidades documentales y preparar borradores». La búsqueda revisada usa datos y metadatos; no se identificó OCR general ni lectura inteligente de todos los PDF. |
| Planeación y control | Borradores presupuestarios, ingresos/gastos, modificaciones, techos y seguimiento. | «Prepare y dé seguimiento a la planificación financiera con información reunida». El saldo presupuestario no acredita efectivo en banco. |

## 4. Cobertura del sistema revisado

Se contrastó el catálogo completo de capacidades con rutas, componentes, servicios, reglas y SQL relevantes:

- Documentos, proyectos y auditoría: núcleo de la oferta comercial.
- Búsqueda global, beneficiarios y autenticación: consulta contextual y trabajo según funciones.
- Cuentas por pagar, órdenes de pago y pendientes: continuidad entre obligación, pago, presupuesto y respaldo.
- Presupuesto: planeación, modificaciones, ejecución y control por fuente.
- Ingresos y arqueos: depósitos, conciliación y conversión de reportes SAFT/SAMI.
- Dashboard y Oficina de la Mujer: seguimiento general y por área/programa específico.
- App shell, diagnósticos y editor de datos: soporte interno del producto; no necesitan protagonismo en la venta.

Esta revisión es estática y comercial. No se accedió a registros financieros reales, facturas de proveedores ni configuración productiva; no se ejecutó una prueba funcional en producción. Una función presente en el repositorio necesita validación en la instalación que se ofrecerá al cliente. Se respetaron los cambios locales existentes.

## 5. Relato propuesto para la futura presentación

Duración sugerida: 8–10 minutos, con ocho momentos. Esto es un esquema para aprobación, no la presentación final.

1. **«Cuando le piden un documento, su municipalidad debe poder encontrarlo».** Abrir con una solicitud de respaldo de un proyecto o proveedor.
2. **El costo de la información dispersa.** Tiempo de búsqueda, repetición de trabajo y dificultad para responder.
3. **Documentos conectados con la gestión.** Mostrar la relación proyecto → pagos → documentos, con un ejemplo ficticio.
4. **Expedientes para responder.** Mostrar una selección por proyecto, proveedor o período y sus PDF disponibles.
5. **Preparar la revisión desde el trabajo diario.** Visibilidad de faltantes y preparación de evidencia para auditoría.
6. **Menos trabajo repetitivo, más seguimiento.** Preparación documental, apoyo de IA y panorama de gestión; la conversión SAFT/SAMI como ejemplo complementario.
7. **Una puesta en marcha acompañada.** Configuración, carga inicial acotada, capacitación y soporte.
8. **Una inversión clara.** Precio del alcance recomendado, alternativa de entrada y ampliación. Cierre con demostración usando un expediente de prueba.

Frase de cierre propuesta: **«Su equipo carga y organiza la información; el sistema le ayuda a encontrarla, relacionarla y reunirla para responder».**

En la futura sección del sistema se recomienda modo presentación a pantalla completa, navegación simple y datos de demostración. El presupuesto interno de costos no se mostrará en las diapositivas comerciales.

## 6. Oferta y precios sugeridos

Montos en lempiras. Son una propuesta propia basada en costos supuestos, no tarifas de mercado verificadas ni cotización contractual. No incluyen impuestos aplicables. Incluyen el uso del servicio; no la cesión del código fuente ni exclusividad.

| Alcance | Implementación única | Mensualidad | Primer año: implementación + 12 meses |
| --- | ---: | ---: | ---: |
| **Archivo y expedientes** | L 30,000 | L 6,000 | L 102,000 |
| **Documentación y control — recomendado** | L 50,000 | L 9,000 | L 158,000 |
| **Acompañamiento ampliado** | L 80,000 | L 14,000 | L 248,000 |

La diferencia se vende por alcance de implantación, volumen y acompañamiento, no por cantidad de botones.

| Inclusión propuesta | Archivo y expedientes | Documentación y control | Acompañamiento ampliado |
| --- | --- | --- | --- |
| Resultado principal | Consulta de respaldos y preparación de expedientes | Respaldo conectado con seguimiento financiero, proyectos y pendientes | Mayor adopción entre áreas y seguimiento operativo |
| Usuarios nominales incluidos | 10 | 25 | 50 |
| Archivos activos incluidos | 25 GB | 75 GB | 150 GB |
| Transferencia mensual de archivos presupuestada | 50 GB | 100 GB | 200 GB |
| Carga inicial de PDF ya digitalizados y con índice utilizable | Hasta 500 | Hasta 1,500 | Hasta 3,000 |
| Fuentes tabulares estructuradas para carga inicial | 1 | Hasta 3 | Hasta 5 |
| Capacitación remota inicial | 4 horas | 8 horas | 12 horas |
| Soporte remoto de uso mensual | 3 horas | 5 horas | 8 horas |
| Bolsa interna de consumo de IA por mes | Sin IA incluida | Hasta L 270 de costo del proveedor | Hasta L 540 de costo del proveedor |
| Seguimiento de adopción | Durante la puesta en marcha | Revisión trimestral | Revisión mensual |

Son límites comerciales propuestos, no cuotas ya implementadas en la aplicación. Deben instalarse medición y alertas antes de vender consumo incluido. La bolsa de IA mide gasto real, no equivale a un número garantizado de consultas. Al agotarla, se acuerda ampliación; el archivo y las consultas convencionales siguen disponibles.

Todos los alcances contemplan configuración institucional, usuarios y permisos, operación alojada, correcciones del producto y mantenimiento ordinario. Se propone incorporar copias diarias de datos y archivos con 30 días de retención, verificación de ejecución y prueba periódica de recuperación. Esta política es trabajo pendiente de preparación comercial, no una capacidad productiva confirmada.

La carga inicial exige archivos legibles y una relación documento–registro proporcionada por el cliente; clasificar cajas de papel, escanear, reconstruir expedientes o depurar información inconsistente se cotiza aparte. Un archivo no equivale a una página. La carga de datos debe validarse por muestreo y aceptación de la municipalidad.

El nivel ampliado incorpora más áreas y acompañamiento usando capacidades existentes. No incluye por ese precio desarrollos ilimitados, conector directo SAMI, OCR masivo ni formulación técnica de proyectos.

## 7. Costos y fundamento de los precios

Referencias públicas consultadas el 25 de septiembre de 2026:

- [Supabase](https://supabase.com/pricing): Pro desde US$25/mes; incluye un proyecto Micro con el crédito de cómputo, 100 GB de archivos y cuotas de transferencia. Excedentes y proyectos adicionales se facturan según consumo. Los límites de una organización no deben multiplicarse automáticamente por cada cliente.
- [Vercel](https://vercel.com/pricing): Pro desde US$20/mes y consumo adicional según recursos. Los asientos de desarrollador corresponden al equipo técnico, no a cada usuario municipal.
- [Respaldos de Supabase](https://supabase.com/docs/guides/platform/backups): las copias de base de datos no incluyen los objetos del almacenamiento. Los PDF necesitan su propia estrategia de copia.

La base de lista de US$45/mes es solamente alojamiento y base de datos bajo esos supuestos. No es el costo total del servicio. No se confirmó que las cuentas actuales estén en esos planes.

Para elaborar el presupuesto se utiliza **L 27 por US$1 como supuesto de planificación, no como cotización cambiaria actual**, y **L 300/hora como costo interno supuesto de trabajo**. Deben sustituirse por costos reales antes de emitir una oferta. La IA se reserva como bolsa de consumo; no se atribuye una tarifa por consulta a modelos cuya configuración efectiva no fue verificada.

### Operación mensual estimada por municipalidad

| Costo interno | Archivo y expedientes | Documentación y control | Acompañamiento ampliado |
| --- | ---: | ---: | ---: |
| Alojamiento, datos, archivos, copias y consumo/IA previsto | L 1,800 | L 2,400 | L 3,500 |
| Soporte de uso: 3 / 5 / 8 h × L 300 | L 900 | L 1,500 | L 2,400 |
| Mantenimiento asignado: 2 / 3 / 4 h × L 300 | L 600 | L 900 | L 1,200 |
| Contingencia: 10% del subtotal | L 330 | L 480 | L 710 |
| **Costo mensual estimado** | **L 3,630** | **L 5,280** | **L 7,810** |
| Mensualidad propuesta | L 6,000 | L 9,000 | L 14,000 |
| Contribución antes de gastos generales e impuestos | L 2,370 | L 3,720 | L 6,190 |
| Margen de contribución aproximado | 39.5% | 41.3% | 44.2% |

La primera fila es una provisión presupuestaria, no una factura desglosada comprobada. Las copias externas, transferencia por respaldos, restauraciones y uso intensivo pueden exigir aumentarla. El margen debe financiar ventas, administración, evolución compartida del producto y cobros demorados; no es utilidad neta.

Regla de precio: **mensualidad = costo esperado / (1 − margen objetivo)**. Con 40% de margen objetivo, los pisos calculados son aproximadamente L 6,050, L 8,800 y L 13,017. El alcance básico redondeado a L 6,000 queda ligeramente por debajo de ese objetivo; no conviene descontarlo sin reducir alcance o costos.

### Implementación por cliente

| Supuesto | Archivo y expedientes | Documentación y control | Acompañamiento ampliado |
| --- | ---: | ---: | ---: |
| Trabajo total estimado, incluida capacitación | 40 h | 70 h | 110 h |
| Mano de obra × L 300/h | L 12,000 | L 21,000 | L 33,000 |
| Preparación, carga y gastos directos adicionales | L 1,200 | L 2,400 | L 6,000 |
| Contingencia 20% del subtotal | L 2,640 | L 4,680 | L 7,800 |
| **Costo de implementación estimado** | **L 15,840** | **L 28,080** | **L 46,800** |
| Precio propuesto | L 30,000 | L 50,000 | L 80,000 |

Las horas cubren diagnóstico, configuración, carga acotada, capacitación y validación. Estimación preliminar de calendario: 2–3, 3–5 y 4–6 semanas, sujeta a calidad de datos y disponibilidad de responsables; no es un compromiso de entrega.

**Preparación compartida del producto:** reservar inicialmente 40–80 horas adicionales (L 12,000–24,000 de costo supuesto) para evaluar y resolver configuración por institución, instalación reproducible, copias/recuperación y controles de consumo. Esta reserva no demuestra que alcance para todos los pendientes. Se afina tras la revisión técnica y se recupera entre los primeros contratos. No está incluida en los costos de implementación individual anteriores; si el primer contrato debe financiarla completa, recalcular su precio.

No se puede inferir el costo histórico de desarrollar el sistema a partir de archivos o líneas de código. Para recuperarlo comercialmente debe añadirse una asignación: inversión histórica pendiente / número previsto de clientes y meses de recuperación.

### Sensibilidad

En el alcance recomendado, cinco horas adicionales de soporte consumen L 1,500 y reducen la contribución de L 3,720 a L 2,220. Un incremento de L 1 por dólar añade L 100 si el gasto expuesto es US$100/mes. El volumen documental y las horas de atención son variables que deben medirse desde el piloto.

Para validar el valor con un cliente: comparar horas de búsqueda, preparación de expedientes y transcripción antes/después. Ejemplo únicamente ilustrativo: L 9,000 mensuales / L 150 por hora administrativa = 60 horas/mes de ahorro equivalente. No representa ahorro ya alcanzado ni necesariamente reducción de nómina.

## 8. Condiciones comerciales propuestas

- Implementación: 50% al iniciar y 50% al aceptar la puesta en marcha; mensualidad desde la activación. Adaptar el calendario a las condiciones de contratación de cada cliente.
- Soporte remoto en horario laboral acordado; las horas incluidas no se acumulan. Correcciones de defectos del producto se cubren con mantenimiento, separadas de consultas de uso y solicitudes nuevas.
- Hora adicional de asistencia o configuración estándar: propuesta de L 650. Integraciones y desarrollos nuevos requieren estimación propia.
- Digitalización física, desplazamientos, equipos, limpieza histórica compleja, almacenamiento/transferencia extraordinarios y licencias comerciales de escáner: cotización adicional.
- Se puede mantener carga convencional de PDF y escaneo básico; el escáner profesional Dynamsoft depende de una licencia que no fue verificada ni incluida en estos precios.
- Los documentos y datos municipales siguen siendo del cliente. Incluir entrega de archivos e índice al terminar el servicio; preparar y probar este procedimiento antes de comprometerlo.
- No comprometer disponibilidad contractual, recuperación inmediata o atención 24/7 sin infraestructura y personal presupuestados.

## 9. Preparación necesaria para comercializar

Estos puntos afectan directamente la promesa de resguardo y el costo de atender otras instituciones:

1. **Separación institucional:** no se identificó en la revisión local un modelo explícito de múltiples municipalidades. Para primeros clientes, presupuestar instalación y datos separados por municipalidad, con una base de código común. No mezclar registros hasta diseñar y probar aislamiento.
2. **Instalación reproducible:** existen funciones de base de datos consumidas por el código cuya definición completa no se confirmó en el repositorio. Inventariar esquema, RPC, catálogos, permisos y políticas para crear una instalación vacía.
3. **Identidad configurable:** membretes, firmas, nombres, catálogos y ejercicios deben parametrizarse por cliente.
4. **Respaldo recuperable:** implementar y probar copia de base de datos más archivos, retención y restauración; el almacenamiento en nube por sí solo no prueba recuperación.
5. **Privacidad de archivos:** el código de auditoría construye enlaces `storage/v1/object/public`. Esto exige revisar buckets y accesos antes de prometer documentación confidencial; no demuestra por sí solo que todos los archivos productivos sean públicos.
6. **Control de consumo y acceso a IA:** comprobar autenticación en todos los endpoints, límites y medición por cliente. El generador de documentos faltantes revisado no contiene una comprobación de sesión en su propio handler; debe comprobarse si otra capa lo protege. No se afirma una explotación productiva.
7. **Prueba de aceptación:** cargar, localizar y exportar un expediente de muestra; verificar permisos; restaurar una copia; comprobar el flujo real con reportes SAMI/SAFT y validar los totales con el responsable municipal.

Estos son preparativos internos; la presentación comercial debe concentrarse en los resultados y en el alcance ofrecido.

## 10. Evidencia local principal

- [Catálogo funcional](../modules/README.md).
- [Carga documental](../modules/documentos/services/documentosProyecto.service.ts) y [escaneo](../modules/documentos/components/RequisitoDocumentoCard.tsx).
- [Expedientes de proyectos](../modules/proyectos/components/DocumentacionProyectos.tsx), [organización del PDF](../modules/proyectos/domain/expedienteProyectoPdf.ts) y [orden de inicio](../modules/proyectos/api/orden-inicio.ts).
- [Filtros y expediente de auditoría](../modules/auditoria/components/AuditoriaEgresos.tsx), [reglas](../modules/auditoria/domain/auditoria-egresos.ts) y [API](../modules/auditoria/api/expediente-pdf.ts).
- [Búsqueda transversal](../modules/busqueda-global/domain/busqueda-universal.ts) y [asistente contextual](../modules/busqueda-global/api/asistente-financiero.ts).
- [Requisitos documentales](../modules/cuentas-por-pagar/domain/requisitos-documentales-cxp.ts) y [redacción de borradores](../modules/ordenes-pago/api/generar-documento-faltante.ts).
- [Conversión SAFT/SAMI](../modules/arqueos/components/ConversorSamiSaft.tsx) y [catálogos](../modules/arqueos/services/conversor-sami-saft.service.ts).
- [Conciliación](../modules/ingresos/domain/conciliacion-bancaria.ts), [borrador presupuestario](../modules/presupuesto/components/BorradorPresupuestoExplorer.tsx), [pendientes](../modules/pendientes/domain/pendientes.ts) y [panel](../modules/dashboard/pages/DashboardPage.tsx).
- [Permisos](../modules/autenticacion/domain/permisos-sistema.ts) y [seguimiento de Oficina de la Mujer](../modules/oficina-mujer/domain/reporte-oficina-mujer.ts).

## 11. Decisión pendiente del propietario

Validar el enfoque documental como argumento central, el alcance recomendado de L 50,000 de implementación y L 9,000 mensuales, y el relato de ocho momentos. Sustituir los supuestos de costos cuando se disponga de facturas, volumen de archivos y responsable de soporte. Después de esta revisión se podrá construir la presentación dentro del sistema, tal como se solicitó.
