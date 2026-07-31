-- Módulo Arqueos: conversión SAFT -> SAMI, cuadre y registro del arqueo.
-- Presupuesto, Tesorería y Administración tienen acceso automático. El
-- permiso VER_ARQUEOS permite habilitar usuarios de otros roles.
--
-- Orden recomendado para cargar los datos:
--   1. public.rubros_ingresos_sami
--   2. public.rubros_ingresos_saft
--   3. public.equivalencias_rubros_ingresos
--
-- La conversión detallada NO se guarda. Estas tablas solo contienen los
-- catálogos y la relación vigente SAFT -> SAMI. La función validada recibe
-- únicamente el total de control del informe (convertido a SAMI más rubros
-- para registro manual) para compararlo con los depósitos antes de delegar el
-- guardado a la función crear_arqueo_completo ya existente.

begin;

create table if not exists public.rubros_ingresos_sami (
  codigo text primary key,
  descripcion text not null,
  constraint rubros_ingresos_sami_codigo_chk
    check (length(trim(codigo)) > 0),
  constraint rubros_ingresos_sami_descripcion_chk
    check (length(trim(descripcion)) > 0)
);

create table if not exists public.rubros_ingresos_saft (
  codigo text primary key,
  descripcion text not null,
  constraint rubros_ingresos_saft_codigo_chk
    check (length(trim(codigo)) > 0),
  constraint rubros_ingresos_saft_descripcion_chk
    check (length(trim(descripcion)) > 0)
);

create table if not exists public.equivalencias_rubros_ingresos (
  codigo_saft text primary key
    references public.rubros_ingresos_saft (codigo)
    on update cascade
    on delete restrict,
  codigo_sami text not null
    references public.rubros_ingresos_sami (codigo)
    on update cascade
    on delete restrict,
  constraint equivalencias_rubros_codigo_saft_chk
    check (length(trim(codigo_saft)) > 0),
  constraint equivalencias_rubros_codigo_sami_chk
    check (length(trim(codigo_sami)) > 0)
);

create index if not exists equivalencias_rubros_codigo_sami_idx
on public.equivalencias_rubros_ingresos (codigo_sami);

comment on table public.rubros_ingresos_sami is
  'Catálogo de rubros de ingresos del sistema SAMI.';
comment on table public.rubros_ingresos_saft is
  'Catálogo de rubros de ingresos reportados por SAFT.';
comment on table public.equivalencias_rubros_ingresos is
  'Equivalencia vigente de cada rubro SAFT a un rubro SAMI. Un SAMI puede agrupar muchos SAFT.';

alter table public.rubros_ingresos_sami enable row level security;
alter table public.rubros_ingresos_saft enable row level security;
alter table public.equivalencias_rubros_ingresos enable row level security;

drop policy if exists rubros_ingresos_sami_lectura on public.rubros_ingresos_sami;
create policy rubros_ingresos_sami_lectura
on public.rubros_ingresos_sami
for select
to authenticated
using (true);

drop policy if exists rubros_ingresos_saft_lectura on public.rubros_ingresos_saft;
create policy rubros_ingresos_saft_lectura
on public.rubros_ingresos_saft
for select
to authenticated
using (true);

drop policy if exists equivalencias_rubros_ingresos_lectura
on public.equivalencias_rubros_ingresos;
create policy equivalencias_rubros_ingresos_lectura
on public.equivalencias_rubros_ingresos
for select
to authenticated
using (true);

revoke all on table public.rubros_ingresos_sami from anon;
revoke all on table public.rubros_ingresos_saft from anon;
revoke all on table public.equivalencias_rubros_ingresos from anon;

revoke insert, update, delete, truncate
on table public.rubros_ingresos_sami
from authenticated;
revoke insert, update, delete, truncate
on table public.rubros_ingresos_saft
from authenticated;
revoke insert, update, delete, truncate
on table public.equivalencias_rubros_ingresos
from authenticated;

grant select on table public.rubros_ingresos_sami to authenticated;
grant select on table public.rubros_ingresos_saft to authenticated;
grant select on table public.equivalencias_rubros_ingresos to authenticated;

create or replace function public.crear_arqueo_completo_validado(
  p_fecha date,
  p_descripcion text,
  p_depositos jsonb,
  p_total_conversion numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_depositos numeric;
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

  if p_total_conversion is null or round(p_total_conversion, 2) <= 0 then
    raise exception 'El total recaudado del informe debe ser mayor que cero.';
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

  select round(sum((deposito ->> 'monto')::numeric), 2)
  into v_total_depositos
  from jsonb_array_elements(p_depositos) as deposito;

  if v_total_depositos <> round(p_total_conversion, 2) then
    raise exception using
      errcode = '22000',
      message = format(
        'El arqueo no cuadra. Total de depósitos: %s; total del informe: %s.',
        to_char(v_total_depositos, 'FM999999999999990.00'),
        to_char(round(p_total_conversion, 2), 'FM999999999999990.00')
      );
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

-- La función anterior queda disponible solo para el propietario de la base.
-- Así, todos los clientes autenticados deben pasar por el cuadre obligatorio.
revoke all on function public.crear_arqueo_completo(
  date,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.crear_arqueo_completo_validado(
  date,
  text,
  jsonb,
  numeric
) from public, anon;

grant execute on function public.crear_arqueo_completo_validado(
  date,
  text,
  jsonb,
  numeric
) to authenticated;

comment on function public.crear_arqueo_completo_validado(
  date,
  text,
  jsonb,
  numeric
) is
  'Valida que los depósitos cuadren con el total del informe, incluidos los rubros de registro manual. No persiste la conversión.';

commit;
