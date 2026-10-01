# Recomendaciones de auditoría

Cada orden del módulo de auditoría dispone de un formulario de recomendaciones.
El botón **Guardar recomendaciones** registra el texto en Supabase. El campo es
opcional, admite hasta 10,000 caracteres y permite retirar una recomendación
dejando el texto vacío y guardando. No modifica la descripción ni los egresos.

El módulo **Informes de auditoría**, accesible desde el menú Reportes y la ruta
`/informes-auditoria`, contiene el panel **Informe mensual de recomendaciones**
con un selector de mes y año. Auditoría (`/auditoria`) se dedica a consultar las
órdenes y registrar sus recomendaciones. El selector distingue los meses con
informe generado de los pendientes e incluye períodos con informes históricos,
aunque sus órdenes ya no aparezcan en la lista. Al seleccionar un mes se consulta
el último informe guardado y su vigencia. **Generar informe con IA** analiza las
recomendaciones guardadas de todas las órdenes de ese mes y año. Una orden con
varios cheques cuenta una sola vez. Las órdenes sin fecha no se incluyen en ningún
período mensual. El período corresponde a la fecha de la orden, no a la fecha de
edición de su recomendación.

El informe muestra primero todas las recomendaciones íntegras por orden y después
el análisis de IA: resumen general, aspectos positivos y buenas prácticas, aspectos
negativos y oportunidades de mejora, temas recurrentes, recomendaciones generales
y seguimiento sugerido. El análisis referencia las órdenes que lo sustentan y no
inventa fortalezas ni problemas para forzar un balance entre positivos y negativos.
El contexto incluye fecha,
descripción, proveedores, importe y recomendaciones; no se envían documentos ni
datos de ejecución presupuestaria. Las órdenes sin recomendaciones únicamente
cuentan para informar la cobertura del mes.

El informe se guarda y se descarga como texto con las dos secciones completas en
el mismo orden que la pantalla. Las recomendaciones originales siempre son visibles;
no se sustituyen por la síntesis de IA. Cuando cambia el contexto, el panel identifica
el informe como desactualizado y permite regenerarlo. Mientras tanto se muestra su
copia guardada, sin mezclar el análisis anterior con recomendaciones nuevas. Cada
generación conserva su registro anterior en la base de datos. Si el informe sigue
vigente, el servidor lo reutiliza sin hacer otra solicitud a la IA.

## Persistencia y permisos

La migración `auditoria_recomendaciones_resumen_mensual` está aplicada al proyecto
Supabase de esta aplicación. Su SQL reproducible está en
`modules/auditoria/database/recomendaciones_auditoria.sql`; requiere previamente
`reporte_egresos_auditoria.sql` y se aplica una sola vez en otros entornos.
También está aplicada `auditoria_informes_mensuales_analisis_completo`, cuyo SQL está
en `modules/auditoria/database/informes_mensuales_auditoria.sql` y se ejecuta después
de la anterior. Agrega el catálogo de meses y `version_informe`; los informes de la
versión 1 se pueden regenerar con la versión 2 para incorporar el análisis ampliado.

- `auditoria_recomendaciones`: una fila por número de orden, texto, versión,
  fecha de modificación y usuario responsable.
- `auditoria_resumenes_mensuales`: historial de resúmenes, período, fuentes,
  huella del contexto, cobertura, modelo, uso de tokens, fecha y usuario.
- `auditoria_obtener_recomendaciones`: carga inicial sin truncamiento por
  paginación de filas REST.
- `auditoria_guardar_recomendacion`: guardado con control de versión para
  evitar sobrescribir cambios de otra persona.
- `auditoria_contexto_mensual`: obtiene las órdenes del mes completo y el último
  resumen. Usa la fecha máxima de las filas del reporte para cada orden,
  coincidiendo con la primera fila del reporte ordenado por fecha descendente.
- `auditoria_meses_informe`: lista los meses de las órdenes y de los informes
  guardados, sin depender de los filtros o la paginación de la lista visible.

Las tablas tienen RLS y los mismos roles que el módulo: `AUDITORIA`, `ADMIN` y
`PRESUPUESTO`. Todas las funciones nuevas son `SECURITY INVOKER`. Los triggers
asignan usuario, fecha y versión desde la sesión y la base de datos. Se valida
que la orden exista y que las fuentes no hayan cambiado al guardar el resumen.
Los resúmenes no admiten edición ni eliminación desde los roles de aplicación.

## Configuración y límites

Se reutiliza `OPENAI_API_KEY` del servidor. Opcionalmente se puede configurar
`OPENAI_AUDITORIA_MODEL`; el valor predeterminado es `gpt-5.6-luna`, consistente
con las otras funciones de IA del proyecto. No se necesitan dependencias nuevas.

La integración utiliza Responses API con `store: false`. La aplicación conserva
su propia copia del resultado en Supabase. No se generan resúmenes vacíos ni se
guardan respuestas incompletas. Una entrada mayor de 300,000 bytes se rechaza con
un mensaje explícito; nunca se omiten recomendaciones silenciosamente.

El formulario conserva los borradores al cambiar los filtros. Si hay un conflicto
de edición, permite cargar y consultar el texto del equipo sin perder el borrador.
El módulo de informes utiliza únicamente las recomendaciones ya guardadas en
Supabase. **Actualizar** consulta los cambios guardados por otros usuarios.

## Organización del módulo de informes

La página, los componentes, la API y la carga inicial del catálogo de meses están
en `modules/informes-auditoria/`. La página de órdenes ya no carga ese catálogo ni
monta los componentes del informe. Ambos módulos comparten las recomendaciones y
las mismas reglas de acceso: Auditoría, Administración y Presupuesto.

La API actual es `/api/informes-auditoria`; la ruta anterior
`/api/auditoria/resumen-mensual` se conserva como adaptador compatible. El menú,
el buscador universal y el atajo de navegación `Shift + IAUD` incluyen el nuevo
módulo. No se modifica el historial almacenado en Supabase.

## Alcance de la entrega

No se ejecutaron pruebas, compilación, lint, comprobación de tipos ni consultas
de verificación posteriores, conforme a la instrucción del usuario.
