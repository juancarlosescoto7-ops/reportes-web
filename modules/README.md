# Arquitectura modular

Cada carpeta de primer nivel representa una capacidad funcional. La estructura
interna usa únicamente las capas que el módulo necesita:

```text
modules/<modulo>/
├── api/          # implementación de Route Handlers
├── components/   # interfaz del módulo
├── config/       # configuración propia
├── database/     # funciones, vistas y migraciones SQL
├── domain/       # reglas puras, tipos y pruebas colocadas
├── hooks/        # hooks React
├── pages/        # implementación de páginas
├── services/     # acceso a datos y casos de uso
└── templates/    # plantillas documentales
```

No todas las carpetas son obligatorias. Se crean únicamente cuando existe código
de esa responsabilidad.

## Catálogo de módulos

| Módulo | Responsabilidad |
| --- | --- |
| `app-shell` | Navegación lateral y configuración del contenedor principal. |
| `arqueos` | Arqueos, depósitos y conversión SAFT/SAMI. |
| `auditoria` | Acceso y reporte auditable de egresos, incluido expediente PDF. |
| `autenticacion` | Sesión, permisos, ruta inicial y pantallas de acceso. |
| `beneficiarios` | Catálogo, selector y creación de beneficiarios. |
| `busqueda-global` | Búsqueda universal y asistente financiero contextual. |
| `cuentas-por-pagar` | CxP, requisitos documentales y recomendaciones presupuestarias. |
| `dashboard` | Resúmenes e indicadores. |
| `diagnosticos` | Pantallas y servicios de comprobación administrativa. |
| `editor-datos` | Consulta y edición directa de siete tablas de Supabase, exclusiva de Presupuesto. |
| `documentos` | Carga, escaneo y combinación de documentos PDF. |
| `ingresos` | Reporte, edición y conciliación bancaria de ingresos. |
| `oficina-mujer` | Reporte presupuestario y control de acceso de Oficina de la Mujer. |
| `ordenes-pago` | Egresos, órdenes, ejecución y faltantes documentales. |
| `pendientes` | Vista consolidada de saldos y documentos pendientes. |
| `presupuesto` | Exploración, borradores, contextos, modificaciones y ejecución presupuestaria. |
| `proyectos` | Proyectos, obras, expediente y orden de inicio. |

## Reglas de dependencia

1. `app/` solo adapta las convenciones de Next.js y delega en `modules/` o `shared/`.
2. Un módulo puede consumir una capacidad pública de otro módulo cuando el flujo
   de negocio lo requiere, pero no puede importar desde `app/`.
3. `shared/` no depende de módulos de negocio.
4. Componentes, servicios, reglas y SQL nuevos deben agregarse al módulo dueño;
   no se deben recrear carpetas globales `components/`, `services/`, `lib/`,
   `hooks/` o `sql/`.
5. Las pruebas de reglas de dominio se colocan junto a la regla que verifican.

Ejecute `npm run check:architecture` para detectar automáticamente violaciones de
estas reglas y rutas de importación legadas.
