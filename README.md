# Reportes Web

Sistema de gestión financiera municipal construido con Next.js 16, React 19 y Supabase.

## Arquitectura

El código se organiza por capacidad de negocio:

- `app/`: adaptadores de rutas y endpoints exigidos por Next.js.
- `modules/`: módulos funcionales con sus páginas, componentes, servicios, dominio, APIs, SQL y recursos.
- `shared/`: infraestructura y componentes reutilizables sin dependencia de módulos de negocio.
- `public/`: recursos estáticos servidos por Next.js.

La descripción de cada módulo y las reglas de dependencia están en
[`modules/README.md`](modules/README.md). El informe de la reorganización está en
[`docs/auditoria-arquitectura.md`](docs/auditoria-arquitectura.md).

## Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## Verificación

```bash
npm run verify
```

El comando comprueba límites modulares, tipos, pruebas, lint y build de producción.

## Migraciones de base de datos

Los archivos SQL viven dentro del módulo que los consume. Por ejemplo, antes de
desplegar el clasificador documental de cuentas por pagar, ejecute en Supabase:

```text
modules/cuentas-por-pagar/database/contextos_documentales_cxp.sql
```

Esta migración crea el catálogo dinámico, carga los contextos iniciales y amplía
`documentos_cxp` para admitir cualquier tipo de requisito.

La clasificación usa `OPENAI_API_KEY` únicamente en el servidor. El modelo se
puede cambiar con `OPENAI_REQUISITOS_CXP_MODEL`; si no se define, se utiliza
`gpt-5.6-luna`. Cuando OpenAI no está disponible, el sistema aplica las palabras
clave y ejemplos del catálogo como alternativa determinista.
