-- Registro de arqueos independiente del conversor SAFT-SAMI.
-- Conserva la función interna crear_arqueo_completo y expone un punto de
-- entrada autorizado que recibe únicamente el arqueo y sus depósitos.

begin;

-- Retira el punto de entrada anterior, que exigía un total proveniente del
-- conversor. La función interna de persistencia se mantiene intacta.
drop function if exists public.crear_arqueo_completo_validado(
  date,
  text,
  jsonb,
  numeric
);

revoke all on function public.crear_arqueo_completo(
  date,
  text,
  jsonb
) from public, anon, authenticated;

create or replace function public.crear_arqueo_con_depositos(
  p_fecha date,
  p_descripcion text,
  p_depositos jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debe iniciar sesión para registrar el arqueo.';
  end if;

  if not exists (
    select 1
    from public.obtener_mis_permisos() as permiso
    where permiso.permiso_codigo = 'VER_ARQUEOS'
       or permiso.rol_codigo in ('TESORERIA', 'PRESUPUESTO', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'El módulo de arqueos está disponible para Presupuesto, Tesorería, Administración o usuarios con VER_ARQUEOS.';
  end if;

  if p_fecha is null then
    raise exception 'La fecha del arqueo es obligatoria.';
  end if;

  if p_depositos is null
    or jsonb_typeof(p_depositos) <> 'array'
    or jsonb_array_length(p_depositos) = 0
  then
    raise exception 'Debe incluir al menos un depósito bancario.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_depositos) as deposito
    where jsonb_typeof(deposito) <> 'object'
      or nullif(trim(deposito ->> 'monto'), '') is null
      or not (trim(deposito ->> 'monto') ~ '^[0-9]+([.][0-9]+)?$')
      or nullif(trim(deposito ->> 'cuenta'), '') is null
      or nullif(trim(deposito ->> 'tipo_ingreso'), '') is null
      or nullif(trim(deposito ->> 'fecha_deposito'), '') is null
  ) then
    raise exception 'Todos los depósitos deben contener cuenta, tipo, fecha y un monto válido.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_depositos) as deposito
    where (deposito ->> 'monto')::numeric <= 0
  ) then
    raise exception 'Los montos de los depósitos deben ser mayores que cero.';
  end if;

  select public.crear_arqueo_completo(
    p_fecha,
    coalesce(p_descripcion, ''),
    p_depositos
  )::text
  into v_resultado;

  if nullif(trim(v_resultado), '') is null then
    raise exception 'La función de registro no devolvió el identificador del arqueo.';
  end if;

  return v_resultado;
end;
$$;

revoke all on function public.crear_arqueo_con_depositos(
  date,
  text,
  jsonb
) from public, anon;

grant execute on function public.crear_arqueo_con_depositos(
  date,
  text,
  jsonb
) to authenticated;

comment on function public.crear_arqueo_con_depositos(
  date,
  text,
  jsonb
) is
  'Registra un arqueo y sus depósitos sin depender de reportes ni conversiones SAFT-SAMI.';

commit;
