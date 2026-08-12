-- Ejecutar una vez en el SQL Editor de Supabase.
-- El PDF se elimina desde Supabase Storage y esta RPC elimina su registro.

begin;

create or replace function public.eliminar_archivo_orden_pago(
  p_orden_pago integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminados integer;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para eliminar documentos.'
      using errcode = '42501';
  end if;

  if p_orden_pago is null or p_orden_pago <= 0 then
    raise exception 'El número de orden de pago no es válido.'
      using errcode = '22023';
  end if;

  delete from public.orden_pago_archivos
  where orden_pago = p_orden_pago;

  get diagnostics v_eliminados = row_count;

  if v_eliminados = 0 then
    raise exception 'La orden de pago % no tiene un documento registrado.',
      p_orden_pago
      using errcode = 'P0002';
  end if;

  return v_eliminados;
end;
$$;

revoke all on function public.eliminar_archivo_orden_pago(integer)
from public, anon;

grant execute on function public.eliminar_archivo_orden_pago(integer)
to authenticated;

-- Supabase Storage exige una política DELETE para poder remover el PDF.
drop policy if exists "ordenes_pago_delete_authenticated"
on storage.objects;

create policy "ordenes_pago_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'ordenes_pago');

commit;
