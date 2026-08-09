This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Requisitos documentales de CxP

Antes de desplegar el clasificador documental, ejecute en el SQL Editor de
Supabase el archivo `sql/contextos_documentales_cxp.sql`. La migración crea el
catálogo dinámico, carga los contextos iniciales y amplía `documentos_cxp` para
admitir cualquier tipo de requisito.

La clasificación usa `OPENAI_API_KEY` únicamente en el servidor. El modelo se
puede cambiar con `OPENAI_REQUISITOS_CXP_MODEL`; si no se define, se utiliza
`gpt-5.6-luna`. Cuando OpenAI no está disponible, el sistema aplica las palabras
clave y ejemplos del catálogo como alternativa determinista.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
