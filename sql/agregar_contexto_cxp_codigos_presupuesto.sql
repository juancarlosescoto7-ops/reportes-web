begin;

alter table public.codigos_presupuesto
  add column if not exists contexto_cxp text;

comment on column public.codigos_presupuesto.contexto_cxp is
  'Descripcion funcional de los tipos de cuentas por pagar que corresponden al codigo presupuestario. Se usa como contexto para recomendaciones asistidas por IA.';

alter table public.codigos_presupuesto
  drop constraint if exists codigos_presupuesto_contexto_cxp_longitud;

alter table public.codigos_presupuesto
  add constraint codigos_presupuesto_contexto_cxp_longitud
  check (contexto_cxp is null or char_length(contexto_cxp) <= 2000);

grant select on table public.codigos_presupuesto to authenticated;
grant update (contexto_cxp) on table public.codigos_presupuesto to authenticated;

commit;
