create table if not exists public.documentos_cxp (
  id uuid primary key default gen_random_uuid(),
  no_cxp bigint not null,
  tipo_movimiento text not null default '',
  tipo_documento text not null,
  nombre_documento text not null,
  estado text not null default 'PENDIENTE',
  fecha_registro timestamptz not null default now(),
  fecha_cumplido timestamptz null,
  usuario_registro text null,
  usuario_cumple text null,
  constraint documentos_cxp_tipo_documento_chk
    check (tipo_documento in ('SOLICITUD', 'LIQUIDACION')),
  constraint documentos_cxp_estado_chk
    check (estado in ('PENDIENTE', 'CUMPLIDO')),
  constraint documentos_cxp_unq
    unique (no_cxp, tipo_movimiento, tipo_documento)
);

create index if not exists documentos_cxp_cxp_idx
on public.documentos_cxp (no_cxp, tipo_movimiento);

delete from public.documentos_cxp
where tipo_documento = 'ORDEN_COMPRA';

alter table public.documentos_cxp
drop constraint if exists documentos_cxp_tipo_documento_chk;

alter table public.documentos_cxp
add constraint documentos_cxp_tipo_documento_chk
check (tipo_documento in ('SOLICITUD', 'LIQUIDACION'));

alter table public.documentos_cxp enable row level security;

drop policy if exists "documentos_cxp_select_authenticated" on public.documentos_cxp;
create policy "documentos_cxp_select_authenticated"
on public.documentos_cxp
for select
to authenticated
using (true);

drop policy if exists "documentos_cxp_insert_authenticated" on public.documentos_cxp;
create policy "documentos_cxp_insert_authenticated"
on public.documentos_cxp
for insert
to authenticated
with check (true);

drop policy if exists "documentos_cxp_update_authenticated" on public.documentos_cxp;
create policy "documentos_cxp_update_authenticated"
on public.documentos_cxp
for update
to authenticated
using (true)
with check (true);
