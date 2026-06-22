-- RPC 1: reemplaza la RPC actual y permite pagos parciales.
-- El payload p_cxps debe incluir: no_cxp, tipo_movimiento, monto_pago.
create or replace function public.procesar_pago_multiple_cxp_con_compromiso(
  p_cxps jsonb,
  p_no_cheque bigint,
  p_usuario_registro text,
  p_cuenta text,
  p_fecha date,
  p_descripcion_pago text,
  p_ejercicio_fiscal integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_items integer := 0;
  v_total_encontradas integer := 0;
  v_total_beneficiarios integer := 0;
  v_beneficiario text;
  v_total_pago numeric := 0;
  v_no_orden bigint;
  v_descripcion_final text;
  v_total_ejecuciones numeric := 0;
  v_total_codigos integer := 0;
  v_invalidas integer := 0;
begin
  if p_cxps is null or jsonb_typeof(p_cxps) <> 'array' then
    raise exception 'Debe enviar una lista JSON de CxP.';
  end if;

  if jsonb_array_length(p_cxps) = 0 then
    raise exception 'Debe seleccionar al menos una CxP.';
  end if;

  if p_no_cheque is null then
    raise exception 'Debe indicar el numero de cheque.';
  end if;

  if p_usuario_registro is null or trim(p_usuario_registro) = '' then
    raise exception 'Debe indicar el usuario que registra el pago.';
  end if;

  if p_cuenta is null or trim(p_cuenta) = '' then
    raise exception 'Debe indicar la cuenta de pago.';
  end if;

  if p_descripcion_pago is null or trim(p_descripcion_pago) = '' then
    raise exception 'Debe indicar una descripcion general para el egreso.';
  end if;

  drop table if exists tmp_pago_cxps;

  create temporary table tmp_pago_cxps (
    no_cxp bigint not null,
    tipo_movimiento text not null,
    monto_pago numeric not null
  ) on commit drop;

  insert into tmp_pago_cxps (no_cxp, tipo_movimiento, monto_pago)
  select distinct
    x.no_cxp,
    coalesce(x.tipo_movimiento, ''),
    coalesce(x.monto_pago, 0)
  from jsonb_to_recordset(p_cxps) as x(
    no_cxp bigint,
    tipo_movimiento text,
    monto_pago numeric
  )
  where x.no_cxp is not null;

  select count(*) into v_total_items from tmp_pago_cxps;

  if v_total_items = 0 then
    raise exception 'La lista de CxP no contiene numeros validos.';
  end if;

  if exists (select 1 from tmp_pago_cxps where monto_pago <= 0) then
    raise exception 'Todos los montos de pago deben ser mayores a cero.';
  end if;

  perform 1
  from cuentas_por_pagar cp
  join tmp_pago_cxps t
    on t.no_cxp = cp.no_cxp
   and t.tipo_movimiento = coalesce(cp.tipo_movimiento, '')
  for update;

  select count(*)
  into v_total_encontradas
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  if v_total_encontradas <> v_total_items then
    raise exception 'Una o mas CxP seleccionadas no existen.';
  end if;

  select count(distinct coalesce(cp.id_beneficiario, ''))
  into v_total_beneficiarios
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  if v_total_beneficiarios <> 1 then
    raise exception 'Todas las CxP seleccionadas deben pertenecer al mismo beneficiario.';
  end if;

  select max(cp.id_beneficiario)
  into v_beneficiario
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  if v_beneficiario is null or trim(v_beneficiario) = '' then
    raise exception 'Las CxP seleccionadas no tienen beneficiario valido.';
  end if;

  if exists (
    select 1
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    where coalesce(cp.estado, 'pendiente') = 'anulado'
  ) then
    raise exception 'Una o mas CxP estan anuladas.';
  end if;

  if exists (
    select 1
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    where coalesce(cp.estado, 'pendiente') = 'pagado'
  ) then
    raise exception 'Una o mas CxP ya estan pagadas.';
  end if;

  if exists (select 1 from egresos e where e.no_cheque = p_no_cheque) then
    raise exception 'El numero de cheque ya existe.';
  end if;

  select count(*)
  into v_invalidas
  from (
    select
      cp.no_cxp,
      coalesce(cp.tipo_movimiento, '') as tipo_movimiento,
      greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0) as saldo_real_cxp,
      coalesce(sum(c.monto_ejecutado), 0) as monto_comprometido
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    left join compromisos_presupuestarios c
      on c.cxp_id = cp.no_cxp
     and coalesce(c.tipo_compromiso, '') = coalesce(cp.tipo_movimiento, '')
     and c.ejercicio_fiscal = p_ejercicio_fiscal
    group by
      cp.no_cxp,
      coalesce(cp.tipo_movimiento, ''),
      greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0)
  ) x
  where round(x.saldo_real_cxp, 2) <> round(x.monto_comprometido, 2);

  if v_invalidas > 0 then
    raise exception 'Una o mas CxP no tienen compromiso igual al saldo real pendiente.';
  end if;

  if exists (
    select 1
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    where round(t.monto_pago, 2) > round(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 2)
       or round(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 2) <= 0
  ) then
    raise exception 'Una o mas CxP tienen monto de pago mayor al saldo real.';
  end if;

  select coalesce(sum(monto_pago), 0)
  into v_total_pago
  from tmp_pago_cxps;

  if v_total_pago <= 0 then
    raise exception 'El total del pago debe ser mayor a cero.';
  end if;

  perform pg_advisory_xact_lock(hashtext('egresos_no_orden'));

  select coalesce(max(no_orden), 0) + 1
  into v_no_orden
  from egresos;

  v_descripcion_final :=
    'Orden de Pago No. ' || v_no_orden ||
    ' | Cheque No. ' || p_no_cheque ||
    ' | ' || trim(p_descripcion_pago);

  insert into egresos (
    fecha,
    descripcion,
    debe,
    haber,
    no_orden,
    id_beneficiario,
    no_cheque,
    tipo_movimiento,
    cuenta,
    estado,
    origen,
    usuario_registro,
    fecha_registro
  )
  values (
    p_fecha,
    v_descripcion_final,
    0,
    v_total_pago,
    v_no_orden,
    v_beneficiario,
    p_no_cheque,
    'Egreso',
    p_cuenta,
    'activo',
    'cxp_multiple_con_compromiso',
    p_usuario_registro,
    now()
  );

  insert into ejecuciones_presupuestarias (
    orden_pago_id,
    codigo_presupuestario,
    actividad_id,
    proyecto_id,
    monto_ejecutado,
    fecha_ejecucion,
    ejercicio_fiscal,
    usuario_registro,
    fecha_registro
  )
  select
    v_no_orden,
    c.codigo_presupuestario,
    c.actividad_id,
    c.proyecto_id,
    round(
      sum(
        c.monto_ejecutado
        * (
          t.monto_pago
          / nullif(greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0), 0)
        )
      ),
      2
    ),
    p_fecha,
    c.ejercicio_fiscal,
    p_usuario_registro,
    now()
  from compromisos_presupuestarios c
  join tmp_pago_cxps t
    on t.no_cxp = c.cxp_id
   and t.tipo_movimiento = coalesce(c.tipo_compromiso, '')
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  where c.ejercicio_fiscal = p_ejercicio_fiscal
  group by c.codigo_presupuestario, c.actividad_id, c.proyecto_id, c.ejercicio_fiscal;

  select coalesce(sum(ep.monto_ejecutado), 0), count(*)
  into v_total_ejecuciones, v_total_codigos
  from ejecuciones_presupuestarias ep
  where ep.orden_pago_id = v_no_orden
    and ep.ejercicio_fiscal = p_ejercicio_fiscal;

  -- Reducir el compromiso presupuestario asociado a cada CxP pagada.
  -- Si el pago liquida la CxP, el compromiso restante seria 0.00; como la
  -- tabla no permite monto_ejecutado en cero, se elimina el compromiso.
  -- La relacion debe diferenciar no_cxp y tipo_movimiento:
  -- compromisos_presupuestarios.cxp_id = cuentas_por_pagar.no_cxp
  -- compromisos_presupuestarios.tipo_compromiso = cuentas_por_pagar.tipo_movimiento
  delete from compromisos_presupuestarios c
  using tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  where c.cxp_id = t.no_cxp
    and coalesce(c.tipo_compromiso, '') = t.tipo_movimiento
    and c.ejercicio_fiscal = p_ejercicio_fiscal
    and round(
      greatest(
        coalesce(cp.haber, 0) - (coalesce(cp.debe, 0) + t.monto_pago),
        0
      ),
      2
    ) <= 0;

  update compromisos_presupuestarios c
  set
    monto_ejecutado = round(
      c.monto_ejecutado
      * (
        greatest(
          coalesce(cp.haber, 0) - (coalesce(cp.debe, 0) + t.monto_pago),
          0
        )
        / nullif(greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0), 0)
      ),
      2
    )
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  where c.cxp_id = t.no_cxp
    and coalesce(c.tipo_compromiso, '') = t.tipo_movimiento
    and c.ejercicio_fiscal = p_ejercicio_fiscal
    and round(
      greatest(
        coalesce(cp.haber, 0) - (coalesce(cp.debe, 0) + t.monto_pago),
        0
      ),
      2
    ) > 0;

  update cuentas_por_pagar cp
  set
    debe = least(coalesce(cp.haber, 0), coalesce(cp.debe, 0) + t.monto_pago),
    estado = case
      when round(coalesce(cp.debe, 0) + t.monto_pago, 2) >= round(coalesce(cp.haber, 0), 2)
      then 'pagado'
      else coalesce(cp.estado, 'pendiente')
    end,
    fecha_pago = case
      when round(coalesce(cp.debe, 0) + t.monto_pago, 2) >= round(coalesce(cp.haber, 0), 2)
      then p_fecha
      else cp.fecha_pago
    end,
    no_orden_pago = case
      when round(coalesce(cp.debe, 0) + t.monto_pago, 2) >= round(coalesce(cp.haber, 0), 2)
      then v_no_orden
      else cp.no_orden_pago
    end
  from tmp_pago_cxps t
  where cp.no_cxp = t.no_cxp
    and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  insert into bitacora_cxp (
    no_cxp,
    tipo_movimiento,
    accion,
    detalle,
    usuario,
    metadata
  )
  select
    t.no_cxp,
    nullif(t.tipo_movimiento, ''),
    'pago_parcial_con_compromiso',
    'Se proceso pago de CxP con compromiso presupuestario.',
    p_usuario_registro,
    jsonb_build_object(
      'no_orden', v_no_orden,
      'no_cheque', p_no_cheque,
      'descripcion_pago', trim(p_descripcion_pago),
      'monto_pago', t.monto_pago,
      'saldo_anterior', coalesce(cp.haber, 0) - (coalesce(cp.debe, 0) - t.monto_pago),
      'saldo_nuevo', coalesce(cp.haber, 0) - coalesce(cp.debe, 0),
      'total_pago_egreso', v_total_pago,
      'cuenta', p_cuenta,
      'fecha_pago', p_fecha,
      'ejercicio_fiscal', p_ejercicio_fiscal
    )
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  return json_build_object(
    'ok', true,
    'mensaje', 'Pago procesado correctamente.',
    'no_orden', v_no_orden,
    'no_cheque', p_no_cheque,
    'total_cxps', v_total_items,
    'total_pago', v_total_pago,
    'total_codigos_presupuestarios', v_total_codigos,
    'monto_ejecutado_presupuestario', v_total_ejecuciones,
    'descripcion', v_descripcion_final
  );
exception
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- Permisos de ejecucion de la RPC desde Supabase.
grant execute on function public.procesar_pago_multiple_cxp_con_compromiso(
  jsonb,
  bigint,
  text,
  text,
  date,
  text,
  integer
) to authenticated;

grant execute on function public.procesar_pago_multiple_cxp_con_compromiso(
  jsonb,
  bigint,
  text,
  text,
  date,
  text,
  integer
) to anon;

-- Si bitacora_cxp tiene RLS activo, esta politica permite registrar bitacora
-- desde el cliente autenticado. Si prefieres que solo la RPC escriba bitacora,
-- deja la funcion como security definer y omite esta politica.
drop policy if exists "permitir_insert_bitacora_cxp_rpc" on public.bitacora_cxp;

create policy "permitir_insert_bitacora_cxp_rpc"
on public.bitacora_cxp
for insert
to authenticated
with check (true);

-- RPC 2: recomendaciones basadas en saldo real de CxP (haber - debe).
create or replace function public.obtener_recomendaciones_cxp()
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
  recomendacion_financiera text,
  motivo_recomendacion_financiera text
)
language sql
as $$
with estado_grupos as (
  select
    fuente,
    tipo,
    MontoPermitido,
    MontoEjecutado,
    (MontoPermitido - MontoEjecutado) as margen_disponible
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
      sum(ampliacion) as total_ampliacion,
      sum(disminucion) as total_disminucion
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
cxp_base as (
  select
    c.no_cxp as cxp_id,
    c.fecha,
    c.descripcion,
    c.no_cxp,
    coalesce(c.haber, 0) as monto_obligacion,
    coalesce(c.debe, 0) as monto_pagado,
    greatest(coalesce(c.haber, 0) - coalesce(c.debe, 0), 0) as saldo_real_cxp,
    cp.codigo_presupuestario,
    cp.monto_ejecutado,
    cp.fecha_ejecucion,
    cp.ejercicio_fiscal,
    b.id as beneficiario_id,
    b.nombre as beneficiario_nombre,
    c.estado,
    c.tipo_movimiento as tipo_cxp,
    case
      when cod.fuente = '11-001-01' then 'Transferencias'
      when cod.fuente = '15-013-01' then 'Fondos propios'
    end as fuente,
    case
      when cod.fuente = '11-001-01' and cod.tipo_inversion = '10'
        then 'Gastos de funcionamiento'
      when cod.fuente = '11-001-01' and cod.tipo_inversion = '20' and p.nombre is not null
        then p.nombre
      when cod.fuente = '15-013-01' and cod.tipo_inversion = '10'
        then 'Gastos de funcionamiento'
      when cod.fuente = '15-013-01' and cod.tipo_inversion = '20'
        then 'Gastos de inversion'
    end as tipo
  from cuentas_por_pagar c
  join compromisos_presupuestarios cp
    on cp.cxp_id = c.no_cxp
   and coalesce(cp.tipo_compromiso, '') = coalesce(c.tipo_movimiento, '')
  join codigos_presupuesto cod
    on cod.codigo = cp.codigo_presupuestario
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
    and greatest(coalesce(c.haber, 0) - coalesce(c.debe, 0), 0) > 0
),
cxp_con_calculo as (
  select
    cb.*,
    eg.margen_disponible,
    sc.saldo_disponible,
    sum(cb.saldo_real_cxp) over (
      partition by cb.fuente, cb.tipo, cb.tipo_cxp
      order by cb.fecha
      rows between unbounded preceding and current row
    ) as acumulado
  from cxp_base cb
  left join estado_grupos eg
    on eg.fuente = cb.fuente
   and eg.tipo = cb.tipo
  left join saldo_codigo sc
    on trim(cb.codigo_presupuestario) = trim(sc.codigo_presupuestario)
),
recomendacion_lineas as (
  select
    cxp_id,
    fecha,
    descripcion,
    no_cxp,
    monto_obligacion,
    monto_pagado,
    saldo_real_cxp,
    codigo_presupuestario,
    monto_ejecutado,
    fecha_ejecucion,
    ejercicio_fiscal,
    beneficiario_id,
    beneficiario_nombre,
    estado,
    tipo_cxp,
    fuente,
    tipo,
    margen_disponible,
    saldo_disponible,
    acumulado,
    least(
      saldo_real_cxp,
      coalesce(saldo_disponible, 0),
      coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
    ) as monto_recomendado_linea,
    case
      when coalesce(saldo_disponible, 0) <= 0
        or coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0) <= 0
        then 'No pagar'
      when least(
        saldo_real_cxp,
        coalesce(saldo_disponible, 0),
        coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
      ) < saldo_real_cxp
        then 'Pago parcial'
      else 'Pago total'
    end as decision_pago,
    case
      when coalesce(saldo_disponible, 0) <= 0
       and coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0) <= 0
        then 'No se puede pagar; saldo del codigo 0 y margen del grupo agotado'
      when coalesce(saldo_disponible, 0) <= 0
        then 'No se puede pagar; saldo del codigo = ' || coalesce(saldo_disponible, 0)
      when coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0) <= 0
        then 'No se puede pagar; margen del grupo agotado = ' ||
          coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
      when least(
        saldo_real_cxp,
        coalesce(saldo_disponible, 0),
        coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
      ) < saldo_real_cxp
        then 'Pago parcial limitado a ' ||
          least(
            saldo_real_cxp,
            coalesce(saldo_disponible, 0),
            coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
          ) ||
          '; saldo real CxP = ' || saldo_real_cxp ||
          ', saldo codigo = ' || coalesce(saldo_disponible, 0) ||
          ', margen grupo = ' || coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
      else
        'Se puede pagar el saldo real: ' || saldo_real_cxp ||
        '; saldo codigo = ' || coalesce(saldo_disponible, 0) ||
        ', margen grupo = ' || coalesce(margen_disponible - (acumulado - saldo_real_cxp), 0)
    end as motivo_pago
  from cxp_con_calculo
),
recomendacion_resumida as (
  select
    rl.no_cxp,
    rl.tipo_cxp,
    min(rl.fecha) as fecha,
    max(rl.descripcion) as descripcion,
    max(rl.beneficiario_id) as beneficiario_id,
    max(rl.beneficiario_nombre) as beneficiario_nombre,
    max(rl.estado) as estado,
    max(rl.monto_obligacion) as monto_obligacion,
    max(rl.monto_pagado) as monto_pagado,
    max(rl.saldo_real_cxp) as saldo_real_cxp,
    sum(coalesce(rl.monto_ejecutado, 0)) as monto_comprometido,
    string_agg(distinct trim(rl.codigo_presupuestario), ', ') as codigos_presupuestarios,
    case
      when max(case when rl.decision_pago = 'No pagar' then 3 when rl.decision_pago = 'Pago parcial' then 2 when rl.decision_pago = 'Pago total' then 1 else 0 end) = 3
        then 'No pagar'
      when max(case when rl.decision_pago = 'No pagar' then 3 when rl.decision_pago = 'Pago parcial' then 2 when rl.decision_pago = 'Pago total' then 1 else 0 end) = 2
        then 'Pago parcial'
      when max(case when rl.decision_pago = 'No pagar' then 3 when rl.decision_pago = 'Pago parcial' then 2 when rl.decision_pago = 'Pago total' then 1 else 0 end) = 1
        then 'Pago total'
      else 'Sin recomendacion'
    end as recomendacion_financiera,
    string_agg(distinct trim(rl.codigo_presupuestario) || ': ' || rl.motivo_pago, ' / ') as motivo_recomendacion_financiera
  from recomendacion_lineas rl
  group by rl.no_cxp, rl.tipo_cxp
)
select
  rr.no_cxp,
  rr.tipo_cxp,
  rr.fecha,
  rr.descripcion,
  rr.beneficiario_id,
  rr.beneficiario_nombre,
  rr.estado,
  rr.monto_obligacion,
  rr.monto_pagado,
  rr.saldo_real_cxp,
  rr.monto_comprometido,
  rr.codigos_presupuestarios,
  rr.recomendacion_financiera,
  rr.motivo_recomendacion_financiera
from recomendacion_resumida rr
order by
  case
    when rr.recomendacion_financiera = 'Pago total' then 1
    when rr.recomendacion_financiera = 'Pago parcial' then 2
    when rr.recomendacion_financiera = 'No pagar' then 3
    else 4
  end,
  rr.fecha,
  rr.no_cxp;
$$;
