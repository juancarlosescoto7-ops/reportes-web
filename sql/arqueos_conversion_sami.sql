-- INSTALACIÓN COMPLETA PARA UNA BASE NUEVA.
-- Si la base ya contiene los catálogos y funciones de arqueos, NO ejecute
-- este archivo. Para habilitar únicamente la creación de equivalencias use:
--   sql/guardar_equivalencia_rubro_ingreso.sql
--
-- Módulo Conversor SAFT -> SAMI.
-- Incluye los catálogos y la administración de equivalencias utilizados por
-- la conversión independiente.
-- Presupuesto, Tesorería y Administración tienen acceso automático. El
-- permiso VER_ARQUEOS permite habilitar usuarios de otros roles.
--
-- Orden recomendado para cargar los datos:
--   1. public.rubros_ingresos_sami
--   2. public.rubros_ingresos_saft
--   3. public.equivalencias_rubros_ingresos
--
-- La conversión detallada NO se guarda. Estas tablas solo contienen los
-- catálogos y la relación vigente SAFT -> SAMI.

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

create or replace function public.guardar_equivalencia_rubro_ingreso(
  p_codigo_saft text,
  p_descripcion_saft text,
  p_codigo_sami text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_saft text;
  v_descripcion_saft text;
  v_codigo_sami_solicitado text;
  v_codigo_sami_catalogo text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debe iniciar sesión para administrar equivalencias.';
  end if;

  if not exists (
    select 1
    from public.obtener_mis_permisos() as permiso
    where permiso.permiso_codigo = 'VER_ARQUEOS'
       or permiso.rol_codigo in ('TESORERIA', 'PRESUPUESTO', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Las equivalencias SAFT-SAMI solo pueden ser administradas por Tesorería, Presupuesto y Administración.';
  end if;

  v_codigo_saft := regexp_replace(
    regexp_replace(trim(coalesce(p_codigo_saft, '')), '^''+', ''),
    '\.0+$',
    ''
  );
  v_descripcion_saft := trim(coalesce(p_descripcion_saft, ''));
  v_codigo_sami_solicitado := regexp_replace(
    regexp_replace(trim(coalesce(p_codigo_sami, '')), '^''+', ''),
    '\.0+$',
    ''
  );

  if v_codigo_saft = ''
    or length(v_codigo_saft) > 100
    or v_codigo_saft !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
  then
    raise exception 'El código SAFT no es válido.';
  end if;

  if v_descripcion_saft = '' or length(v_descripcion_saft) > 500 then
    raise exception 'La descripción SAFT es obligatoria y no puede exceder 500 caracteres.';
  end if;

  if v_codigo_sami_solicitado = '' then
    raise exception 'Debe seleccionar una cuenta SAMI.';
  end if;

  select rubro.codigo
  into v_codigo_sami_catalogo
  from public.rubros_ingresos_sami as rubro
  where regexp_replace(
    regexp_replace(trim(rubro.codigo), '^''+', ''),
    '\.0+$',
    ''
  ) = v_codigo_sami_solicitado
  limit 1;

  if v_codigo_sami_catalogo is null then
    raise exception 'La cuenta SAMI % no existe en el catálogo.',
      v_codigo_sami_solicitado;
  end if;

  insert into public.rubros_ingresos_saft (codigo, descripcion)
  values (v_codigo_saft, v_descripcion_saft)
  on conflict (codigo) do update
  set descripcion = excluded.descripcion;

  insert into public.equivalencias_rubros_ingresos (
    codigo_saft,
    codigo_sami
  )
  values (v_codigo_saft, v_codigo_sami_catalogo)
  on conflict (codigo_saft) do update
  set codigo_sami = excluded.codigo_sami;

  return v_codigo_saft;
end;
$$;

revoke all on function public.guardar_equivalencia_rubro_ingreso(
  text,
  text,
  text
) from public, anon;

grant execute on function public.guardar_equivalencia_rubro_ingreso(
  text,
  text,
  text
) to authenticated;

comment on function public.guardar_equivalencia_rubro_ingreso(
  text,
  text,
  text
) is
  'Crea o actualiza un código SAFT y lo vincula con una cuenta SAMI existente. Disponible solo para usuarios autorizados del módulo.';

commit;
