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
  contexto_documental text null,
  origen_requisito text not null default 'GENERAL',
  confianza_ia numeric(5,4) null,
  justificacion_contexto text null,
  constraint documentos_cxp_tipo_documento_chk
    check (tipo_documento ~ '^[A-Z0-9_]+$'),
  constraint documentos_cxp_estado_chk
    check (estado in ('PENDIENTE', 'CUMPLIDO')),
  constraint documentos_cxp_origen_requisito_chk
    check (origen_requisito in ('GENERAL', 'REGLA', 'IA', 'USUARIO')),
  constraint documentos_cxp_confianza_ia_chk
    check (confianza_ia is null or (confianza_ia >= 0 and confianza_ia <= 1)),
  constraint documentos_cxp_unq
    unique (no_cxp, tipo_movimiento, tipo_documento)
);

create index if not exists documentos_cxp_cxp_idx
on public.documentos_cxp (no_cxp, tipo_movimiento);

alter table public.documentos_cxp
add column if not exists contexto_documental text null,
add column if not exists origen_requisito text not null default 'GENERAL',
add column if not exists confianza_ia numeric(5,4) null,
add column if not exists justificacion_contexto text null;

alter table public.documentos_cxp
drop constraint if exists documentos_cxp_tipo_documento_chk;

alter table public.documentos_cxp
add constraint documentos_cxp_tipo_documento_chk
check (tipo_documento ~ '^[A-Z0-9_]+$');

alter table public.documentos_cxp
drop constraint if exists documentos_cxp_origen_requisito_chk;

alter table public.documentos_cxp
add constraint documentos_cxp_origen_requisito_chk
check (origen_requisito in ('GENERAL', 'REGLA', 'IA', 'USUARIO'));

alter table public.documentos_cxp
drop constraint if exists documentos_cxp_confianza_ia_chk;

alter table public.documentos_cxp
add constraint documentos_cxp_confianza_ia_chk
check (confianza_ia is null or (confianza_ia >= 0 and confianza_ia <= 1));

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
