-- Corrección controlada de un depósito individual.
--
-- La función:
--   1. exige una sesión autenticada;
--   2. exige que el usuario tenga acceso al módulo mediante VER_INGRESOS;
--   3. exige la confirmación literal CORREGIR y un motivo;
--   4. bloquea la fila para evitar correcciones simultáneas;
--   5. recalcula el total del arqueo;
--   6. conserva valores anteriores y nuevos en una bitácora privada.

create table if not exists public.bitacora_ingresos (
  id bigint generated always as identity primary key,
  ingreso_id text not null,
  arqueo_id text null,
  usuario_id uuid not null,
  accion text not null default 'CORRECCION',
  motivo text not null,
  datos_anteriores jsonb not null,
  datos_nuevos jsonb not null,
  fecha_registro timestamptz not null default now(),
  constraint bitacora_ingresos_accion_chk
    check (accion in ('CORRECCION')),
  constraint bitacora_ingresos_motivo_chk
    check (length(trim(motivo)) between 10 and 500)
);

create index if not exists bitacora_ingresos_ingreso_idx
on public.bitacora_ingresos (ingreso_id, fecha_registro desc);

create index if not exists bitacora_ingresos_arqueo_idx
on public.bitacora_ingresos (arqueo_id, fecha_registro desc);

alter table public.bitacora_ingresos enable row level security;

-- La bitácora se escribe únicamente desde la función SECURITY DEFINER.
-- No se expone lectura o escritura directa a clientes.
revoke all on table public.bitacora_ingresos from anon, authenticated;

create or replace function public.actualizar_ingreso(
  p_id text,
  p_monto numeric,
  p_tipo_ingreso text,
  p_cuenta text,
  p_fecha_deposito date,
  p_motivo text,
  p_confirmacion text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_anterior jsonb;
  v_nuevo jsonb;
  v_id_arqueo text;
begin
  if v_usuario_id is null then
    raise exception using
      errcode = '42501',
      message = 'Debe iniciar sesión para corregir un ingreso.';
  end if;

  if not exists (
    select 1
    from public.obtener_mis_permisos() as permiso
    where permiso.permiso_codigo = 'VER_INGRESOS'
  ) then
    raise exception using
      errcode = '42501',
      message = 'No tiene autorización para corregir ingresos.';
  end if;

  if trim(coalesce(p_confirmacion, '')) <> 'CORREGIR' then
    raise exception 'La confirmación de la corrección no es válida.';
  end if;

  if p_id is null or trim(p_id) = '' then
    raise exception 'El identificador del ingreso es obligatorio.';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;

  if p_tipo_ingreso is null or trim(p_tipo_ingreso) = '' then
    raise exception 'El tipo de ingreso es obligatorio.';
  end if;

  if p_cuenta is null or trim(p_cuenta) = '' then
    raise exception 'La cuenta bancaria es obligatoria.';
  end if;

  if p_fecha_deposito is null then
    raise exception 'La fecha del depósito es obligatoria.';
  end if;

  if length(trim(coalesce(p_motivo, ''))) not between 10 and 500 then
    raise exception 'El motivo debe contener entre 10 y 500 caracteres.';
  end if;

  select to_jsonb(ingreso), ingreso.id_arqueo::text
  into v_anterior, v_id_arqueo
  from public.ingresos as ingreso
  where ingreso.id::text = trim(p_id)
  for update;

  if v_anterior is null then
    raise exception 'El ingreso indicado no existe.';
  end if;

  if (v_anterior ->> 'cuenta') is not distinct from trim(p_cuenta)
    and (v_anterior ->> 'tipo_ingreso') is not distinct from trim(p_tipo_ingreso)
    and round(coalesce((v_anterior ->> 'monto')::numeric, 0), 2)
      = round(p_monto, 2)
    and (v_anterior ->> 'fecha_deposito')::date = p_fecha_deposito
  then
    raise exception 'No hay cambios para guardar.';
  end if;

  update public.ingresos as ingreso
  set
    monto = round(p_monto, 2),
    tipo_ingreso = trim(p_tipo_ingreso),
    cuenta = trim(p_cuenta),
    fecha_deposito = p_fecha_deposito
  where ingreso.id::text = trim(p_id)
  returning to_jsonb(ingreso) into v_nuevo;

  update public.arqueos as arqueo
  set total = (
    select coalesce(sum(ingreso.monto), 0)
    from public.ingresos as ingreso
    where ingreso.id_arqueo::text = v_id_arqueo
  )
  where arqueo.id::text = v_id_arqueo;

  insert into public.bitacora_ingresos (
    ingreso_id,
    arqueo_id,
    usuario_id,
    accion,
    motivo,
    datos_anteriores,
    datos_nuevos
  )
  values (
    trim(p_id),
    v_id_arqueo,
    v_usuario_id,
    'CORRECCION',
    trim(p_motivo),
    v_anterior,
    v_nuevo
  );

  return jsonb_build_object(
    'ok', true,
    'id', trim(p_id),
    'id_arqueo', v_id_arqueo
  );
end;
$$;

revoke all on function public.actualizar_ingreso(
  text,
  numeric,
  text,
  text,
  date,
  text,
  text
) from public, anon;

grant execute on function public.actualizar_ingreso(
  text,
  numeric,
  text,
  text,
  date,
  text,
  text
) to authenticated;
