-- Ejecutar una vez en el SQL Editor de Supabase.
-- Registra la cuenta bancaria de la que sale cada orden de pago (egreso).
-- Se guarda por número de orden para no alterar la tabla egresos ni la RPC
-- obtener_egresos_con_ejecucion.

begin;

create table if not exists public.egresos_cuentas_bancarias (
  no_orden integer primary key,
  cuenta_bancaria text not null,
  actualizado_por uuid not null,
  actualizado_en timestamptz not null default now(),
  constraint egresos_cuentas_bancarias_no_orden_chk
    check (no_orden > 0),
  constraint egresos_cuentas_bancarias_cuenta_chk
    check (length(trim(cuenta_bancaria)) > 0)
);

alter table public.egresos_cuentas_bancarias enable row level security;

revoke all on table public.egresos_cuentas_bancarias from anon, authenticated;
grant select on table public.egresos_cuentas_bancarias to authenticated;

drop policy if exists "egresos_cuentas_bancarias_select_authenticated"
on public.egresos_cuentas_bancarias;

create policy "egresos_cuentas_bancarias_select_authenticated"
on public.egresos_cuentas_bancarias
for select
to authenticated
using (true);

-- La escritura se hace únicamente desde esta función.
-- p_cuenta_bancaria vacío o null elimina la asignación.
create or replace function public.asignar_cuenta_bancaria_egreso(
  p_no_orden integer,
  p_cuenta_bancaria text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_cuenta text := nullif(trim(coalesce(p_cuenta_bancaria, '')), '');
begin
  if v_usuario_id is null then
    raise exception using
      errcode = '42501',
      message = 'Debe iniciar sesión para asignar la cuenta bancaria.';
  end if;

  if not exists (
    select 1
    from public.obtener_mis_permisos() as permiso
    where permiso.permiso_codigo = 'VER_EGRESOS'
  ) then
    raise exception using
      errcode = '42501',
      message = 'No tiene autorización para modificar egresos.';
  end if;

  if p_no_orden is null or p_no_orden <= 0 then
    raise exception using
      errcode = '22023',
      message = 'El número de orden de pago no es válido.';
  end if;

  if not exists (
    select 1 from public.egresos as e where e.no_orden = p_no_orden
  ) then
    raise exception using
      errcode = 'P0002',
      message = format('La orden de pago %s no existe.', p_no_orden);
  end if;

  if v_cuenta is null then
    delete from public.egresos_cuentas_bancarias
    where no_orden = p_no_orden;
  else
    insert into public.egresos_cuentas_bancarias (
      no_orden,
      cuenta_bancaria,
      actualizado_por,
      actualizado_en
    )
    values (p_no_orden, v_cuenta, v_usuario_id, now())
    on conflict (no_orden) do update
    set
      cuenta_bancaria = excluded.cuenta_bancaria,
      actualizado_por = excluded.actualizado_por,
      actualizado_en = excluded.actualizado_en;
  end if;

  return jsonb_build_object(
    'ok', true,
    'no_orden', p_no_orden,
    'cuenta_bancaria', v_cuenta
  );
end;
$$;

revoke all on function public.asignar_cuenta_bancaria_egreso(integer, text)
from public, anon;

grant execute on function public.asignar_cuenta_bancaria_egreso(integer, text)
to authenticated;

commit;

-- Hace que la API de Supabase reconozca la tabla y la función nuevas.
notify pgrst, 'reload schema';
