-- Centraliza en Supabase el calculo que antes se realizaba en Next.js.
-- La funcion conserva el contexto del usuario (SECURITY INVOKER) y solo puede
-- ser ejecutada por usuarios autenticados o por el rol de servicio.

create or replace function public.rpc_reporte_oficina_mujer()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
with permisos as (
  select pg_catalog.to_jsonb(p) as fila
  from public.obtener_mis_permisos() as p
),
autorizacion as (
  select coalesce(
    pg_catalog.bool_or(
      pg_catalog.upper(pg_catalog.regexp_replace(
        trim(coalesce(fila ->> 'rol_codigo', '')),
        '[^A-Za-z0-9]+', '_', 'g'
      )) in ('OFICINA_MUJER', 'PRESUPUESTO', 'ADMINISTRADOR', 'ADMIN')
      or pg_catalog.upper(pg_catalog.regexp_replace(
        trim(coalesce(fila ->> 'nombre_usuario', '')),
        '[^A-Za-z0-9]+', '_', 'g'
      )) = 'OFICINA_MUJER'
    ),
    false
  ) as permitido
  from permisos
),
presupuesto as materialized (
  select pg_catalog.to_jsonb(p) as fila
  from public.rpc_presupuesto_base(
    p_busqueda := null,
    p_fecha_desde := null,
    p_fecha_hasta := null
  ) as p
  where (select permitido from autorizacion)
),
resumen as materialized (
  select pg_catalog.to_jsonb(r) as fila
  from public.rpc_resumen_por_grupo() as r
  where (select permitido from autorizacion)
),
resumen_mujer as (
  select
    case
      when pg_catalog.upper(coalesce(fila ->> 'tipo', fila ->> 'Tipo', '')) like '%MUJER%'
        or pg_catalog.upper(coalesce(fila ->> 'tipo', fila ->> 'Tipo', '')) ~ '(^|[[:space:]])OMM([[:space:]]|$)'
        then coalesce(fila ->> 'tipo', fila ->> 'Tipo', '')
      else coalesce(fila ->> 'fuente', fila ->> 'Fuente', '')
    end as nombre,
    coalesce(
      nullif(fila ->> 'montopermitido', '')::numeric,
      nullif(fila ->> 'MontoPermitido', '')::numeric,
      0
    ) as monto_permitido
  from resumen
  where
    pg_catalog.upper(coalesce(fila ->> 'tipo', fila ->> 'Tipo', '')) like '%MUJER%'
    or pg_catalog.upper(coalesce(fila ->> 'fuente', fila ->> 'Fuente', '')) like '%MUJER%'
    or pg_catalog.upper(coalesce(fila ->> 'tipo', fila ->> 'Tipo', '')) ~ '(^|[[:space:]])OMM([[:space:]]|$)'
    or pg_catalog.upper(coalesce(fila ->> 'fuente', fila ->> 'Fuente', '')) ~ '(^|[[:space:]])OMM([[:space:]]|$)'
),
niveles as (
  select *
  from (values
    (0, 'Programa', array['programa_nombre', 'nombre_programa', 'programa']::text[]),
    (1, 'Subprograma', array['subprograma_nombre', 'nombre_subprograma', 'sub_programa_nombre', 'subprograma', 'sub_programa']::text[]),
    (2, 'Proyecto', array['proyecto_nombre', 'nombre_proyecto', 'proyecto']::text[]),
    (3, 'Actividad', array['actividad_nombre', 'nombre_actividad', 'actividad']::text[]),
    (4, 'Obra', array['obra_nombre', 'nombre_obra', 'obra']::text[])
  ) as n(indice, etiqueta, campos)
),
valores_nivel as (
  select p.fila, n.indice, n.etiqueta, n.campos,
    coalesce((
      select p.fila ->> campo
      from pg_catalog.unnest(n.campos) as campo
      where nullif(trim(p.fila ->> campo), '') is not null
      limit 1
    ), '') as nombre
  from presupuesto p
  cross join niveles n
),
grupo_detectado as (
  select indice, etiqueta, campos, nombre
  from valores_nivel
  where pg_catalog.upper(nombre) like '%MUJER%'
     or pg_catalog.upper(nombre) ~ '(^|[[:space:]])OMM([[:space:]]|$)'
  order by indice
  limit 1
),
filas_grupo as (
  select distinct v.fila
  from valores_nivel v
  join grupo_detectado g on g.indice = v.indice
  where pg_catalog.upper(v.nombre) = pg_catalog.upper(g.nombre)
),
estadisticas_eje as (
  select n.indice, n.etiqueta, n.campos,
    pg_catalog.count(distinct pg_catalog.upper(v.nombre)) filter (where v.nombre <> '') as nombres_unicos,
    pg_catalog.bool_or(pg_catalog.upper(v.nombre) ~ '(^|[[:space:]])EJE([[:space:]]|$|[-:0-9])') as tiene_eje,
    pg_catalog.bool_or(v.nombre <> '') as tiene_datos
  from niveles n
  left join valores_nivel v
    on v.indice = n.indice
   and v.fila in (select fila from filas_grupo)
  where n.indice > coalesce((select indice from grupo_detectado), 0)
  group by n.indice, n.etiqueta, n.campos
),
nivel_eje as (
  select indice, etiqueta, campos
  from estadisticas_eje
  order by
    case when tiene_eje then 0 when nombres_unicos > 1 then 1 when tiene_datos then 2 else 3 end,
    indice
  limit 1
),
filas_eje as (
  select
    coalesce((
      select f.fila ->> campo
      from pg_catalog.unnest(n.campos) as campo
      where nullif(trim(f.fila ->> campo), '') is not null
      limit 1
    ), 'Sin eje presupuestario identificado') as eje,
    coalesce(nullif(f.fila ->> 'presupuesto_vigente', '')::numeric, 0) as vigente,
    coalesce(nullif(f.fila ->> 'ejecutado', '')::numeric, 0) as ejecutado,
    coalesce(
      nullif(f.fila ->> 'comprometido', '')::numeric,
      nullif(f.fila ->> 'total_comprometido', '')::numeric,
      nullif(f.fila ->> 'saldo_comprometido', '')::numeric,
      nullif(f.fila ->> 'monto_comprometido', '')::numeric,
      0
    ) as comprometido
  from filas_grupo f
  cross join nivel_eje n
),
ejes_base as (
  select eje, pg_catalog.sum(vigente) as vigente,
    pg_catalog.sum(ejecutado) as ejecutado,
    pg_catalog.sum(comprometido) as comprometido
  from filas_eje
  group by eje
),
totales as (
  select
    coalesce((select pg_catalog.sum(vigente) from ejes_base), 0) as vigente,
    coalesce((select pg_catalog.sum(monto_permitido) from resumen_mujer), 0) as ejecutable,
    coalesce((select pg_catalog.sum(ejecutado) from ejes_base), 0) as ejecutado,
    coalesce((select pg_catalog.sum(comprometido) from ejes_base), 0) as comprometido
),
ejes_resultado as (
  select e.eje, e.vigente, e.ejecutado, e.comprometido,
    case when t.vigente > 0 then e.vigente / t.vigente * 100 else 0 end as porcentaje,
    case when t.vigente > 0 then t.ejecutable * e.vigente / t.vigente else 0 end as ejecutable
  from ejes_base e
  cross join totales t
)
select case
  when not (select permitido from autorizacion) then
    pg_catalog.jsonb_build_object('error', 'sin_acceso')
  else pg_catalog.jsonb_build_object(
    'grupo', coalesce(
      (select nombre from grupo_detectado),
      (select nombre from resumen_mujer limit 1),
      'Oficina de la Mujer'
    ),
    'nivelEje', coalesce((select etiqueta from nivel_eje), 'Subprograma'),
    'montoVigenteGrupo', t.vigente,
    'ejecutableGeneralGrupo', t.ejecutable,
    'montoEjecutadoGrupo', t.ejecutado,
    'montoComprometidoGrupo', t.comprometido,
    'saldoEjecutableGrupo', t.ejecutable - t.ejecutado - t.comprometido,
    'ejes', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'eje', e.eje,
          'montoVigente', e.vigente,
          'porcentajeEjecutable', e.porcentaje,
          'montoEjecutable', e.ejecutable,
          'montoEjecutado', e.ejecutado,
          'montoComprometido', e.comprometido,
          'saldoEjecutable', e.ejecutable - e.ejecutado - e.comprometido
        ) order by e.eje
      )
      from ejes_resultado e
    ), '[]'::jsonb)
  )
end
from totales t;
$function$;

comment on function public.rpc_reporte_oficina_mujer() is
  'Calcula el ejecutable y saldo por eje de Oficina de la Mujer.';

revoke execute on function public.rpc_reporte_oficina_mujer() from public;
revoke execute on function public.rpc_reporte_oficina_mujer() from anon;
grant execute on function public.rpc_reporte_oficina_mujer() to authenticated;
grant execute on function public.rpc_reporte_oficina_mujer() to service_role;

