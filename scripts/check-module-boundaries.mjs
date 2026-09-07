import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const sourceRoots = ["app", "modules", "shared"];
const legacyRoots = ["components", "hooks", "lib", "services", "sql"];
const sourceExtensions = new Set([".ts", ".tsx", ".mjs"]);
const allowedModuleFolders = new Set([
  "api",
  "components",
  "config",
  "database",
  "domain",
  "hooks",
  "pages",
  "services",
  "templates",
]);
const legacyImportPrefixes = [
  "@/components/",
  "@/hooks/",
  "@/lib/",
  "@/services/",
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => []
  );
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(target)));
    else files.push(target);
  }

  return files;
}

const errors = [];
const sourceFiles = (
  await Promise.all(sourceRoots.map((root) => collectFiles(root)))
)
  .flat()
  .filter((file) => sourceExtensions.has(path.extname(file)));

for (const legacyRoot of legacyRoots) {
  const files = await collectFiles(legacyRoot);
  if (files.length > 0) {
    errors.push(
      `${legacyRoot}/ todavía contiene archivos; deben pertenecer a modules/ o shared/.`
    );
  }
}

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const imports = [
    ...source.matchAll(
      /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g
    ),
  ].map((match) => match[1]);

  for (const specifier of imports) {
    if (legacyImportPrefixes.some((prefix) => specifier.startsWith(prefix))) {
      errors.push(`${file}: import legado ${specifier}`);
    }

    if (!file.startsWith(`app${path.sep}`) && specifier.startsWith("@/app/")) {
      errors.push(`${file}: un módulo no debe depender de la capa de rutas (${specifier})`);
    }

    if (file.startsWith(`shared${path.sep}`) && specifier.startsWith("@/modules/")) {
      errors.push(`${file}: shared/ no debe depender de un módulo (${specifier})`);
    }
  }

  const base = path.basename(file);
  if (
    file.startsWith(`app${path.sep}`) &&
    (base === "page.tsx" || base === "route.ts")
  ) {
    const codeLines = source
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("//"));
    if (codeLines.length > 12) {
      errors.push(
        `${file}: el adaptador de Next.js tiene ${codeLines.length} líneas de código; mueva la implementación al módulo.`
      );
    }
  }
}

const moduleEntries = await readdir("modules", { withFileTypes: true });
for (const moduleEntry of moduleEntries.filter((entry) => entry.isDirectory())) {
  const children = await readdir(path.join("modules", moduleEntry.name), {
    withFileTypes: true,
  });
  for (const child of children.filter((entry) => entry.isDirectory())) {
    if (!allowedModuleFolders.has(child.name)) {
      errors.push(
        `modules/${moduleEntry.name}/${child.name}: carpeta de módulo no reconocida.`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Se encontraron violaciones de arquitectura:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Arquitectura modular válida: ${moduleEntries.filter((entry) => entry.isDirectory()).length} módulos y ${sourceFiles.length} archivos fuente revisados.`
  );
}
