begin;

drop function if exists public.obtener_recomendaciones_cxp();

create function public.obtener_recomendaciones_cxp()
returns table (
  no_cxp bigint,
  tipo_cxp text,
  fecha date,
  descripcion text,
  beneficiario_id text,
  beneficiario_nombre text,
  estado text,
  monto_obligacion numeric,
  monto_pagado numeric,
  saldo_real_cxp numeric,
  monto_comprometido numeric,
  codigos_presupuestarios text,
  estado_codigos text,
  monto_pendiente_codigos numeric,
  monto_cubierto_por_codigos numeric,
  detalle_codigos jsonb,
  estado_grupos text,
  monto_pendiente_grupos numeric,
  monto_cubierto_por_grupos numeric,
  detalle_grupos jsonb,
  analisis_riesgo text
)
language sql
stable
security invoker
set search_path = public
as $function$
with estado_grupos_base as (
  select
    fuente,
    tipo,
    MontoPermitido,
    MontoEjecutado,
    MontoPermitido - MontoEjecutado as margen_disponible
  from rpc_resumen_por_grupo()
),
saldo_codigo as (
  select
    trim(cp.codigo) as codigo_presupuestario,
    (
      coalesce(pi.monto, 0)
      + coalesce(mp.total_ampliacion, 0)
      - coalesce(mp.total_disminucion, 0)
    ) - coalesce(sum(ep.monto_ejecutado), 0) as saldo_disponible
  from codigos_presupuesto cp
  left join presupuesto_inicial pi
    on trim(cp.codigo) = trim(pi.codigo)
  left join (
    select
      trim(codigo) as codigo,
      sum(coalesce(ampliacion, 0)) as total_ampliacion,
      sum(coalesce(disminucion, 0)) as total_disminucion
    from modificaciones_presupuestarias
    group by trim(codigo)
  ) mp
    on trim(cp.codigo) = mp.codigo
  left join ejecuciones_presupuestarias ep
    on trim(cp.codigo) = trim(ep.codigo_presupuestario)
  group by
    trim(cp.codigo),
    pi.monto,
    mp.total_ampliacion,
    mp.total_disminucion
),
cxp_raw as (
  select
    c.no_cxp,
    c.fecha,
    c.descripcion,
    coalesce(c.haber, 0) as monto_obligacion,
    coalesce(c.debe, 0) as monto_pagado,
    greatest(
      coalesce(c.haber, 0) - coalesce(c.debe, 0),
      0
    ) as saldo_real_cxp,
    trim(cp.codigo_presupuestario) as codigo_presupuestario,
    coalesce(cp.monto_ejecutado, 0) as monto_comprometido_linea,
    cp.fecha_ejecucion,
    cp.ejercicio_fiscal,
    b.id as beneficiario_id,
    b.nombre as beneficiario_nombre,
    c.estado,
    c.tipo_movimiento as tipo_cxp,
    case
      when cod.fuente = '11-001-01' then 'Transferencias'
      when cod.fuente = '15-013-01' then 'Fondos propios'
      else 'Fuente no clasificada'
    end as fuente,
    case
      when cod.fuente = '11-001-01'
       and cod.tipo_inversion = '10'
        then 'Gastos de funcionamiento'
      when cod.fuente = '11-001-01'
       and cod.tipo_inversion = '20'
       and p.nombre is not null
        then p.nombre
      when cod.fuente = '15-013-01'
       and cod.tipo_inversion = '10'
        then 'Gastos de funcionamiento'
      when cod.fuente = '15-013-01'
       and cod.tipo_inversion = '20'
        then 'Gastos de inversion'
      else 'Grupo no clasificado'
    end as tipo
  from cuentas_por_pagar c
  join compromisos_presupuestarios cp
    on cp.cxp_id = c.no_cxp
   and coalesce(cp.tipo_compromiso, '') =
       coalesce(c.tipo_movimiento, '')
  join codigos_presupuesto cod
    on trim(cod.codigo) = trim(cp.codigo_presupuestario)
  left join obras o
    on cod.obra_id = o.id
  left join actividades a
    on o.actividad_id = a.id
  left join proyectos pr
    on a.proyecto_id = pr.id
  left join subprogramas sp
    on pr.sub_programa_id = sp.id
  left join programas p
    on sp.programa_id = p.id
  left join beneficiarios b
    on b.id = c.id_beneficiario
  where coalesce(c.estado, 'pendiente') <> 'pagado'
    and greatest(
      coalesce(c.haber, 0) - coalesce(c.debe, 0),
      0
    ) > 0
),
cxp_con_totales as (
  select
    cr.*,
    sum(
      greatest(coalesce(cr.monto_comprometido_linea, 0), 0)
    ) over (
      partition by cr.no_cxp, cr.tipo_cxp
    ) as total_comprometido_cxp,
    count(*) over (
      partition by cr.no_cxp, cr.tipo_cxp
    ) as cantidad_lineas_cxp
  from cxp_raw cr
),
cxp_lineas as (
  select
    ct.*,
    case
      when coalesce(ct.total_comprometido_cxp, 0) > 0 then
        ct.saldo_real_cxp
        * (
          greatest(coalesce(ct.monto_comprometido_linea, 0), 0)
          / ct.total_comprometido_cxp
        )
      when coalesce(ct.cantidad_lineas_cxp, 0) > 0 then
        ct.saldo_real_cxp / ct.cantidad_lineas_cxp
      else 0
    end as monto_pendiente_linea
  from cxp_con_totales ct
),
cxp_codigo_base as (
  select
    cl.no_cxp,
    cl.tipo_cxp,
    min(cl.fecha) as fecha,
    cl.codigo_presupuestario,
    sum(coalesce(cl.monto_comprometido_linea, 0))
      as monto_comprometido_codigo,
    sum(coalesce(cl.monto_pendiente_linea, 0))
      as monto_pendiente_codigo
  from cxp_lineas cl
  group by
    cl.no_cxp,
    cl.tipo_cxp,
    cl.codigo_presupuestario
),
codigo_con_acumulado as (
  select
    cb.*,
    coalesce(
      sum(cb.monto_pendiente_codigo) over (
        partition by cb.codigo_presupuestario
        order by cb.fecha, cb.no_cxp, cb.tipo_cxp
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as monto_pendiente_previo_codigo
  from cxp_codigo_base cb
),
analisis_codigo as (
  select
    ca.no_cxp,
    ca.tipo_cxp,
    ca.fecha,
    ca.codigo_presupuestario,
    ca.monto_comprometido_codigo,
    ca.monto_pendiente_codigo,
    ca.monto_pendiente_previo_codigo,
    coalesce(sc.saldo_disponible, 0) as saldo_codigo_actual,
    greatest(
      coalesce(sc.saldo_disponible, 0)
      - ca.monto_pendiente_previo_codigo,
      0
    ) as saldo_codigo_proyectado,
    least(
      ca.monto_pendiente_codigo,
      greatest(
        coalesce(sc.saldo_disponible, 0)
        - ca.monto_pendiente_previo_codigo,
        0
      )
    ) as monto_cubierto_codigo,
    case
      when ca.monto_pendiente_codigo <= 0
        then 'Sin monto pendiente'
      when greatest(
        coalesce(sc.saldo_disponible, 0)
        - ca.monto_pendiente_previo_codigo,
        0
      ) <= 0
        then 'Sin saldo'
      when greatest(
        coalesce(sc.saldo_disponible, 0)
        - ca.monto_pendiente_previo_codigo,
        0
      ) < ca.monto_pendiente_codigo
        then 'Saldo parcial'
      else 'Saldo suficiente'
    end as estado_codigo
  from codigo_con_acumulado ca
  left join saldo_codigo sc
    on trim(ca.codigo_presupuestario) =
       trim(sc.codigo_presupuestario)
),
cxp_grupo_base as (
  select
    cl.no_cxp,
    cl.tipo_cxp,
    min(cl.fecha) as fecha,
    cl.fuente,
    cl.tipo,
    sum(coalesce(cl.monto_pendiente_linea, 0))
      as monto_pendiente_grupo
  from cxp_lineas cl
  group by
    cl.no_cxp,
    cl.tipo_cxp,
    cl.fuente,
    cl.tipo
),
grupo_con_acumulado as (
  select
    gb.*,
    coalesce(
      sum(gb.monto_pendiente_grupo) over (
        partition by gb.fuente, gb.tipo
        order by gb.fecha, gb.no_cxp, gb.tipo_cxp
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as monto_pendiente_previo_grupo
  from cxp_grupo_base gb
),
analisis_grupo as (
  select
    ga.no_cxp,
    ga.tipo_cxp,
    ga.fecha,
    ga.fuente,
    ga.tipo,
    ga.monto_pendiente_grupo,
    ga.monto_pendiente_previo_grupo,
    coalesce(eg.margen_disponible, 0) as saldo_grupo_actual,
    greatest(
      coalesce(eg.margen_disponible, 0)
      - ga.monto_pendiente_previo_grupo,
      0
    ) as saldo_grupo_proyectado,
    least(
      ga.monto_pendiente_grupo,
      greatest(
        coalesce(eg.margen_disponible, 0)
        - ga.monto_pendiente_previo_grupo,
        0
      )
    ) as monto_cubierto_grupo,
    case
      when ga.monto_pendiente_grupo <= 0
        then 'Sin monto pendiente'
      when greatest(
        coalesce(eg.margen_disponible, 0)
        - ga.monto_pendiente_previo_grupo,
        0
      ) <= 0
        then 'Sin saldo'
      when greatest(
        coalesce(eg.margen_disponible, 0)
        - ga.monto_pendiente_previo_grupo,
        0
      ) < ga.monto_pendiente_grupo
        then 'Saldo parcial'
      else 'Saldo suficiente'
    end as estado_grupo
  from grupo_con_acumulado ga
  left join estado_grupos_base eg
    on eg.fuente = ga.fuente
   and eg.tipo = ga.tipo
),
resumen_codigos as (
  select
    ac.no_cxp,
    ac.tipo_cxp,
    sum(ac.monto_pendiente_codigo) as monto_pendiente_codigos,
    sum(ac.monto_cubierto_codigo) as monto_cubierto_por_codigos,
    case
      when sum(ac.monto_cubierto_codigo) >=
           sum(ac.monto_pendiente_codigo)
        then 'Cobertura suficiente'
      when sum(ac.monto_cubierto_codigo) > 0
        then 'Cobertura parcial'
      else 'Sin cobertura'
    end as estado_codigos,
    jsonb_agg(
      jsonb_build_object(
        'codigo_presupuestario', ac.codigo_presupuestario,
        'monto_comprometido', ac.monto_comprometido_codigo,
        'monto_pendiente', ac.monto_pendiente_codigo,
        'saldo_codigo_actual', ac.saldo_codigo_actual,
        'monto_pendiente_anterior', ac.monto_pendiente_previo_codigo,
        'saldo_codigo_proyectado', ac.saldo_codigo_proyectado,
        'monto_cubierto', ac.monto_cubierto_codigo,
        'estado', ac.estado_codigo
      )
      order by ac.codigo_presupuestario
    ) as detalle_codigos
  from analisis_codigo ac
  group by ac.no_cxp, ac.tipo_cxp
),
resumen_grupos as (
  select
    ag.no_cxp,
    ag.tipo_cxp,
    sum(ag.monto_pendiente_grupo) as monto_pendiente_grupos,
    sum(ag.monto_cubierto_grupo) as monto_cubierto_por_grupos,
    case
      when sum(ag.monto_cubierto_grupo) >=
           sum(ag.monto_pendiente_grupo)
        then 'Cobertura suficiente'
      when sum(ag.monto_cubierto_grupo) > 0
        then 'Cobertura parcial'
      else 'Sin cobertura'
    end as estado_grupos,
    jsonb_agg(
      jsonb_build_object(
        'fuente', ag.fuente,
        'grupo', ag.tipo,
        'monto_pendiente', ag.monto_pendiente_grupo,
        'saldo_grupo_actual', ag.saldo_grupo_actual,
        'monto_pendiente_anterior', ag.monto_pendiente_previo_grupo,
        'saldo_grupo_proyectado', ag.saldo_grupo_proyectado,
        'monto_cubierto', ag.monto_cubierto_grupo,
        'estado', ag.estado_grupo
      )
      order by ag.fuente, ag.tipo
    ) as detalle_grupos
  from analisis_grupo ag
  group by ag.no_cxp, ag.tipo_cxp
),
resumen_cxp as (
  select
    cr.no_cxp,
    cr.tipo_cxp,
    min(cr.fecha) as fecha,
    max(cr.descripcion) as descripcion,
    max(cr.beneficiario_id) as beneficiario_id,
    max(cr.beneficiario_nombre) as beneficiario_nombre,
    max(cr.estado) as estado,
    max(cr.monto_obligacion) as monto_obligacion,
    max(cr.monto_pagado) as monto_pagado,
    max(cr.saldo_real_cxp) as saldo_real_cxp,
    sum(coalesce(cr.monto_comprometido_linea, 0))
      as monto_comprometido,
    string_agg(
      distinct trim(cr.codigo_presupuestario),
      ', '
    ) as codigos_presupuestarios
  from cxp_raw cr
  group by cr.no_cxp, cr.tipo_cxp
)
select
  cxp.no_cxp::bigint,
  cxp.tipo_cxp::text,
  cxp.fecha::date,
  cxp.descripcion::text,
  cxp.beneficiario_id::text,
  cxp.beneficiario_nombre::text,
  cxp.estado::text,
  cxp.monto_obligacion::numeric,
  cxp.monto_pagado::numeric,
  cxp.saldo_real_cxp::numeric,
  cxp.monto_comprometido::numeric,
  cxp.codigos_presupuestarios::text,
  coalesce(rc.estado_codigos, 'Sin analisis')::text
    as estado_codigos,
  coalesce(rc.monto_pendiente_codigos, 0)::numeric
    as monto_pendiente_codigos,
  coalesce(rc.monto_cubierto_por_codigos, 0)::numeric
    as monto_cubierto_por_codigos,
  coalesce(rc.detalle_codigos, '[]'::jsonb)
    as detalle_codigos,
  coalesce(rg.estado_grupos, 'Sin analisis')::text
    as estado_grupos,
  coalesce(rg.monto_pendiente_grupos, 0)::numeric
    as monto_pendiente_grupos,
  coalesce(rg.monto_cubierto_por_grupos, 0)::numeric
    as monto_cubierto_por_grupos,
  coalesce(rg.detalle_grupos, '[]'::jsonb)
    as detalle_grupos,
  case
    when rc.estado_codigos is null
      or rg.estado_grupos is null
      then 'No fue posible completar el analisis de disponibilidad.'
    when rc.estado_codigos = 'Cobertura suficiente'
     and rg.estado_grupos = 'Cobertura suficiente'
      then 'Existe saldo suficiente tanto en los codigos presupuestarios como en los grupos financieros.'
    when rc.estado_codigos = 'Cobertura suficiente'
     and rg.estado_grupos <> 'Cobertura suficiente'
      then 'Los codigos presupuestarios tienen saldo suficiente, pero existe riesgo porque el grupo financiero no posee margen suficiente.'
    when rc.estado_codigos <> 'Cobertura suficiente'
     and rg.estado_grupos = 'Cobertura suficiente'
      then 'El grupo financiero posee margen suficiente, pero uno o mas codigos presupuestarios no tienen saldo suficiente.'
    else 'Existe insuficiencia simultanea en los codigos presupuestarios y en los grupos financieros.'
  end::text as analisis_riesgo
from resumen_cxp cxp
left join resumen_codigos rc
  on rc.no_cxp = cxp.no_cxp
 and coalesce(rc.tipo_cxp, '') =
     coalesce(cxp.tipo_cxp, '')
left join resumen_grupos rg
  on rg.no_cxp = cxp.no_cxp
 and coalesce(rg.tipo_cxp, '') =
     coalesce(cxp.tipo_cxp, '')
order by cxp.fecha, cxp.no_cxp;
$function$;

grant execute
on function public.obtener_recomendaciones_cxp()
to anon, authenticated, service_role;

commit;
