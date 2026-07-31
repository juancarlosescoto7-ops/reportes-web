-- Instalación incremental: gestión de equivalencias SAFT -> SAMI.
--
-- Este archivo NO crea ni modifica tablas, políticas RLS ni funciones de
-- arqueos. Reutiliza las estructuras existentes:
--   public.rubros_ingresos_sami (codigo, descripcion)
--   public.rubros_ingresos_saft (codigo, descripcion)
--   public.equivalencias_rubros_ingresos (codigo_saft, codigo_sami)
--   public.obtener_mis_permisos()

begin;

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
  'Crea o actualiza un código SAFT y lo vincula con una cuenta SAMI existente.';

commit;
