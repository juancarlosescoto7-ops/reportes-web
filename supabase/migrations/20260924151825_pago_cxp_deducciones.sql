-- monto_pago conserva el abono total; deduccion es opcional para clientes anteriores.
create or replace function public.procesar_pago_multiple_cxp_con_compromiso(
  p_cxps jsonb,
  p_fecha date,
  p_no_cheque integer,
  p_usuario_registro text,
  p_cuenta text,
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
  v_total_cheques integer := 0;
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
    monto_pago numeric not null,
    deduccion numeric not null,
    no_cheque integer
  ) on commit drop;

  insert into tmp_pago_cxps (no_cxp, tipo_movimiento, monto_pago, deduccion, no_cheque)
  select distinct
    x.no_cxp,
    coalesce(x.tipo_movimiento, ''),
    coalesce(x.monto_pago, 0),
    coalesce(x.deduccion, 0),
    coalesce(x.no_cheque, p_no_cheque)
  from jsonb_to_recordset(p_cxps) as x(
    no_cxp bigint,
    tipo_movimiento text,
    monto_pago numeric,
    deduccion numeric,
    no_cheque integer
  )
  where x.no_cxp is not null;

  select count(*) into v_total_items from tmp_pago_cxps;

  if v_total_items = 0 then
    raise exception 'La lista de CxP no contiene numeros validos.';
  end if;

  if exists (
    select 1 from tmp_pago_cxps
    where monto_pago::text in ('NaN', 'Infinity', '-Infinity')
       or deduccion::text in ('NaN', 'Infinity', '-Infinity')
       or deduccion < 0 or deduccion > monto_pago
       or monto_pago <> round(monto_pago, 2)
       or deduccion <> round(deduccion, 2)
  ) then
    raise exception 'Banco y deducciones deben ser montos no negativos de hasta dos decimales; su suma es el abono total.';
  end if;

  if exists (
    select 1 from tmp_pago_cxps
    group by no_cxp, tipo_movimiento having count(*) > 1
  ) then
    raise exception 'No puede incluir la misma CxP mas de una vez.';
  end if;

  if exists (select 1 from tmp_pago_cxps where monto_pago <= 0) then
    raise exception 'Todos los montos de pago deben ser mayores a cero.';
  end if;

  if exists (
    select 1
    from tmp_pago_cxps
    where no_cheque is null or no_cheque <= 0
  ) then
    raise exception 'Debe indicar un numero de cheque valido para cada proveedor.';
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

  if exists (
    select 1
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    where cp.id_beneficiario is null or trim(cp.id_beneficiario) = ''
  ) then
    raise exception 'Una o mas CxP seleccionadas no tienen beneficiario valido.';
  end if;

  if exists (
    select 1
    from tmp_pago_cxps t
    join cuentas_por_pagar cp
      on cp.no_cxp = t.no_cxp
     and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
    group by cp.id_beneficiario
    having count(distinct t.no_cheque) <> 1
  ) then
    raise exception 'Todas las CxP de un proveedor deben usar el mismo cheque.';
  end if;

  select
    count(distinct cp.id_beneficiario),
    count(distinct t.no_cheque)
  into v_total_beneficiarios, v_total_cheques
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento;

  if v_total_cheques <> v_total_beneficiarios then
    raise exception 'Cada proveedor debe tener un numero de cheque diferente.';
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
  select
    p_fecha,
    v_descripcion_final,
    0,
    round(sum(m.monto), 2),
    v_no_orden,
    cp.id_beneficiario,
    t.no_cheque,
    'Egreso',
    m.cuenta,
    'activo',
    'cxp_multiple_con_compromiso',
    p_usuario_registro,
    now()
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  cross join lateral (
    values (p_cuenta, t.monto_pago - t.deduccion),
           ('Deducciones por pagar', t.deduccion)
  ) as m(cuenta, monto)
  where m.monto > 0
  group by cp.id_beneficiario, t.no_cheque, m.cuenta;

  -- El checklist guardado es la fuente de los documentos por trasladar.
  -- Copiar solo requisitos PENDIENTES, incluidos los personalizados.
  -- Sin requisitos o con todos CUMPLIDOS no se inserta ningun faltante.
  insert into documentos_faltantes_orden_pago (
    no_orden,
    nombre_documento,
    observacion,
    estado,
    usuario_registro
  )
  select
    v_no_orden,
    format(
      '%s - Orden de compra #%s',
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        dc.tipo_documento
      ),
      t.no_cxp
    ),
    format(
      'Contexto exclusivo de la orden de compra/CxP #%s. Tipo de movimiento: %s. Documento pendiente solicitado: %s (%s). Fecha de la compra: %s. Descripcion de la compra: %s. Monto total de la obligacion: %s. Saldo antes del pago: %s. Beneficiario: %s, identificacion %s. Orden de pago: #%s. Cheque: #%s. Fecha del pago: %s. Cuenta de pago: %s. Descripcion general del pago: %s. Monto pagado para esta compra: %s. Total del egreso consolidado: %s. Este documento corresponde solamente a esta compra y no debe combinarse con otras CxP de la misma orden de pago.',
      t.no_cxp,
      coalesce(nullif(t.tipo_movimiento, ''), 'Sin tipo'),
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        dc.tipo_documento
      ),
      dc.tipo_documento,
      coalesce(to_char(cp.fecha, 'YYYY-MM-DD'), 'Sin fecha'),
      coalesce(nullif(trim(cp.descripcion), ''), 'Sin descripcion'),
      to_char(coalesce(cp.haber, 0), 'FM999999999999990.00'),
      to_char(
        greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0),
        'FM999999999999990.00'
      ),
      coalesce(nullif(trim(b.nombre), ''), 'No identificado'),
      coalesce(nullif(trim(cp.id_beneficiario), ''), 'No identificada'),
      v_no_orden,
      t.no_cheque,
      to_char(p_fecha, 'YYYY-MM-DD'),
      p_cuenta,
      trim(p_descripcion_pago),
      to_char(t.monto_pago, 'FM999999999999990.00'),
      to_char(v_total_pago, 'FM999999999999990.00')
    ),
    'FALTANTE',
    p_usuario_registro
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  join documentos_cxp dc
    on dc.no_cxp = t.no_cxp
   and upper(trim(coalesce(dc.tipo_movimiento, ''))) =
       upper(trim(t.tipo_movimiento))
  left join beneficiarios b
    on b.id = cp.id_beneficiario
  where dc.estado = 'PENDIENTE';

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
      'no_cheque', t.no_cheque,
      'descripcion_pago', trim(p_descripcion_pago),
      'monto_pago', t.monto_pago,
      'monto_banco', t.monto_pago - t.deduccion,
      'deduccion', t.deduccion,
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
    'total_cxps', v_total_items,
    'total_beneficiarios', v_total_beneficiarios,
    'total_cheques', v_total_cheques,
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
NOTIFY pgrst, 'reload schema';
