# Auditoría de arquitectura y modularización

Fecha: 3 de septiembre de 2026

## Alcance

Se revisaron las páginas, Route Handlers, componentes React, hooks, servicios,
reglas de dominio, pruebas, SQL y recursos documentales del sistema. La
reorganización conserva URLs, contratos HTTP y comportamiento funcional.

## Hallazgos iniciales

| Severidad | Hallazgo | Impacto |
| --- | --- | --- |
| Alta | El código estaba separado por tipo técnico (`components`, `services`, `lib`, `sql`) y no por capacidad de negocio. | Un cambio funcional exigía navegar y modificar varias carpetas sin dueño explícito. |
| Alta | Los Route Handlers contenían implementación de negocio de hasta varios cientos de líneas. | La capa de transporte y la lógica del dominio quedaban acopladas a Next.js. |
| Media | Los SQL no indicaban qué funcionalidad los consumía. | Era fácil desplegar una función sin su migración o modificar el módulo equivocado. |
| Media | No existía una comprobación automatizada de límites arquitectónicos. | La estructura horizontal podía reaparecer sin señal en CI. |
| Media | El lint analizaba `public/vendor/opencv.js`, código de terceros minificado. | Generaba cientos de falsos positivos y ocultaba errores del código propio. |
| Media | Varios componentes son muy extensos, especialmente el dashboard de CxP y el reporte de egresos. | Eleva el costo de revisión interna aunque ahora tengan un propietario modular claro. |

## Reorganización aplicada

- Se crearon 16 módulos funcionales bajo `modules/`.
- Se trasladaron 204 archivos de implementación, pruebas, SQL y recursos.
- Todas las implementaciones de páginas se movieron a `modules/<modulo>/pages`.
- Todos los Route Handlers delegan desde `app/api/**/route.ts` hacia
  `modules/<modulo>/api` o `shared/infrastructure/api`.
- La infraestructura Supabase y las utilidades realmente transversales quedaron
  en `shared/`.
- Cada SQL quedó bajo `modules/<modulo>/database`.
- La plantilla de orden de inicio quedó bajo `modules/proyectos/templates`.
- Se eliminaron imports hacia las antiguas carpetas horizontales.
- Se agregó una comprobación de arquitectura y un comando único de verificación.
- Se excluyó del lint únicamente el código vendorizado y se tiparon los puntos que
  impedían que el código propio pasara lint.

## Estructura resultante

```text
app/                    # adaptadores de Next.js
modules/                # capacidades de negocio
  <modulo>/
    api/
    components/
    database/
    domain/
    pages/
    services/
shared/
  components/
  infrastructure/
  utils/
scripts/
  check-module-boundaries.mjs
```

## Decisiones de límites

- `documentos` es un módulo transversal de negocio, no una utilidad: contiene la
  carga, escaneo y combinación de expedientes usados por proyectos y órdenes.
- `beneficiarios` se separó porque es consumido tanto por CxP como por órdenes de
  pago y búsqueda global.
- `pendientes`, `dashboard` y `busqueda-global` son módulos de composición: por
  definición consultan capacidades de varios módulos sin trasladar sus reglas.
- `shared` solo contiene piezas que no conocen ningún módulo funcional.

## Riesgos residuales y siguientes cortes seguros

La modularización solicitada está completa. Como evolución posterior, sin ser
requisito para la separación actual, conviene dividir internamente
`CXPDashboard.tsx`, `EgresosReport.tsx` y `ConciliacionBancariaModal.tsx` en
subcomponentes del mismo módulo. Ese trabajo debe abordarse con pruebas de UI,
porque ya implica cambiar unidades de comportamiento y no solo organización.

## Puertas de calidad

```bash
npm run check:architecture
npm run typecheck
npm run test
npm run lint
npm run build
```

`npm run verify` ejecuta la secuencia completa.
