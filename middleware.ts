import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type PermisoRuta = {
  permiso_codigo: string;
  ruta: string | null;
};

const rutasPrioridad = [
  "/",
  "/controles/proyectos",
  "/reportes/ordenes-de-pago",
  "/reportes/presupuesto",
  "/reportes/compromisos-presupuestarios",
];

function redirigir(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

function rutaCoincide(rutaActual: string, rutaPermitida: string) {
  if (rutaPermitida === "/") {
    return rutaActual === "/";
  }

  return (
    rutaActual === rutaPermitida ||
    rutaActual.startsWith(`${rutaPermitida}/`)
  );
}

function obtenerPrimeraRutaPermitida(permisos: PermisoRuta[]) {
  const rutasPermitidas = permisos
    .map((permiso) => permiso.ruta)
    .filter((ruta): ruta is string => Boolean(ruta));

  for (const ruta of rutasPrioridad) {
    if (rutasPermitidas.includes(ruta)) {
      return ruta;
    }
  }

  return rutasPermitidas[0] ?? "/sin-acceso";
}

function tieneAccesoARuta(rutaActual: string, permisos: PermisoRuta[]) {
  return permisos.some((permiso) => {
    if (!permiso.ruta) return false;
    return rutaCoincide(rutaActual, permiso.ruta);
  });
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const rutaActual = request.nextUrl.pathname;

  const esLogin = rutaActual === "/login";
  const esSinAcceso = rutaActual === "/sin-acceso";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Usuario sin sesión: solo puede entrar a /login
  if (!user) {
    if (esLogin) {
      return response;
    }

    return redirigir(request, "/login");
  }

  // 2. Usuario con sesión puede ver /sin-acceso
  if (esSinAcceso) {
    return response;
  }

  // 3. Usuario con sesión: consultar sus permisos reales
  const { data: permisos, error } = await supabase.rpc("obtener_mis_permisos");

  if (error || !permisos || permisos.length === 0) {
    return redirigir(request, "/sin-acceso");
  }

  const permisosRuta = permisos as PermisoRuta[];

  // 4. Si ya inició sesión y entra a /login, enviarlo a su primera ruta permitida
  if (esLogin) {
    const primeraRuta = obtenerPrimeraRutaPermitida(permisosRuta);
    return redirigir(request, primeraRuta);
  }

  // 5. Validar acceso a la ruta actual
  const tieneAcceso = tieneAccesoARuta(rutaActual, permisosRuta);

  if (!tieneAcceso) {
    return redirigir(request, "/sin-acceso");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};