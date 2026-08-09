create table if not exists public.contextos_documentales_cxp (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  descripcion text not null default '',
  palabras_clave text[] not null default '{}',
  ejemplos text[] not null default '{}',
  requisitos jsonb not null default '[]'::jsonb,
  es_general boolean not null default false,
  activo boolean not null default true,
  prioridad integer not null default 0,
  origen text not null default 'USUARIO',
  fecha_registro timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  usuario_registro uuid null references auth.users(id),
  constraint contextos_documentales_cxp_codigo_unq unique (codigo),
  constraint contextos_documentales_cxp_codigo_chk
    check (codigo ~ '^[A-Z0-9_]+$'),
  constraint contextos_documentales_cxp_requisitos_chk
    check (jsonb_typeof(requisitos) = 'array' and jsonb_array_length(requisitos) > 0),
  constraint contextos_documentales_cxp_origen_chk
    check (origen in ('SISTEMA', 'USUARIO', 'IA_REVISADA'))
);

create unique index if not exists contextos_documentales_cxp_general_unq
on public.contextos_documentales_cxp (es_general)
where es_general = true;

create index if not exists contextos_documentales_cxp_activos_idx
on public.contextos_documentales_cxp (activo, prioridad desc, nombre);

insert into public.contextos_documentales_cxp (
  codigo,
  nombre,
  descripcion,
  palabras_clave,
  ejemplos,
  requisitos,
  es_general,
  prioridad,
  origen
)
values
  (
    'GENERAL',
    'Requisitos generales',
    'Respaldo general para cuentas por pagar que todavía no tienen una regla específica.',
    '{}',
    '{}',
    '[
      {"codigo":"SOLICITUD","nombre":"Solicitud","descripcion":"Solicitud que da origen al trámite de pago."},
      {"codigo":"LIQUIDACION","nombre":"Liquidación","descripcion":"Liquidación o soporte de cierre de la obligación."}
    ]'::jsonb,
    true,
    0,
    'SISTEMA'
  ),
  (
    'MEDICAMENTOS_CLINICA_MUNICIPAL',
    'Medicamentos para clínica municipal',
    'Compra de medicamentos, insumos médicos o productos farmacéuticos destinados a la clínica municipal.',
    array['medicamento','medicamentos','clínica municipal','insumo médico','productos farmacéuticos'],
    array['Compra de medicamentos para la clínica municipal'],
    '[
      {"codigo":"SOLICITUD","nombre":"Solicitud","descripcion":"Solicitud que da origen al trámite de pago."},
      {"codigo":"ACTA_ENTREGA","nombre":"Acta de entrega","descripcion":"Constancia de recepción y entrega de los medicamentos."}
    ]'::jsonb,
    false,
    100,
    'SISTEMA'
  ),
  (
    'MATERIALES_PROYECTO',
    'Materiales para proyecto',
    'Compra de materiales, suministros o insumos que serán utilizados en un proyecto municipal.',
    array['materiales para proyecto','materiales del proyecto','insumos para proyecto','obra municipal'],
    array['Compra de materiales para un proyecto'],
    '[
      {"codigo":"REQUISICION_MATERIALES","nombre":"Requisición de materiales","descripcion":"Detalle de los materiales requeridos por el proyecto."},
      {"codigo":"PERFIL_PROYECTO","nombre":"Perfil de proyecto","descripcion":"Perfil técnico o ficha que sustenta el proyecto."}
    ]'::jsonb,
    false,
    100,
    'SISTEMA'
  ),
  (
    'ALIMENTACION_ACTIVIDAD_INTERNA',
    'Alimentación para actividad interna',
    'Compra de alimentos, refrigerios o alimentación para reuniones y actividades internas municipales.',
    array['alimentación','alimentos','refrigerios','actividad interna','reunión interna'],
    array['Compra de alimentación para actividades internas'],
    '[
      {"codigo":"MEMORANDUM_ALCALDE","nombre":"Memorándum del alcalde","descripcion":"Memorándum que autoriza o justifica la actividad."},
      {"codigo":"SOLICITUD","nombre":"Solicitud","descripcion":"Solicitud que da origen al trámite de pago."},
      {"codigo":"LISTADO_ASISTENCIA","nombre":"Listado de asistencia","descripcion":"Listado de las personas que participaron en la actividad."}
    ]'::jsonb,
    false,
    100,
    'SISTEMA'
  ),
  (
    'CONTRATO',
    'Contrato',
    'Pago originado en un contrato de obra, bienes, servicios profesionales u otra relación contractual.',
    array['contrato','contratación','servicios profesionales','contratista'],
    array['Pago de contrato por servicios profesionales'],
    '[
      {"codigo":"SOLICITUD_CONTRATO","nombre":"Solicitud de contrato","descripcion":"Solicitud formal que da inicio a la contratación."},
      {"codigo":"LIQUIDACION","nombre":"Liquidación","descripcion":"Liquidación o soporte de cierre de la obligación."},
      {"codigo":"PERFIL","nombre":"Perfil","descripcion":"Perfil o alcance que sustenta la contratación."}
    ]'::jsonb,
    false,
    100,
    'SISTEMA'
  ),
  (
    'PASIVO_LABORAL',
    'Pasivo laboral',
    'Pago de prestaciones, derechos o liquidación laboral por terminación de una relación de trabajo.',
    array['pasivo laboral','prestaciones laborales','finiquito','renuncia','despido','cesantía'],
    array['Pago de pasivo laboral por renuncia de empleado municipal'],
    '[
      {"codigo":"CALCULO_PRESTACIONES","nombre":"Cálculo de prestaciones","descripcion":"Cálculo detallado de las prestaciones laborales."},
      {"codigo":"NOTA_RECURSOS_HUMANOS","nombre":"Nota de Recursos Humanos","descripcion":"Nota emitida por Recursos Humanos que sustenta el trámite."},
      {"codigo":"FINIQUITO","nombre":"Finiquito","descripcion":"Documento de finiquito de la relación laboral."},
      {"codigo":"RENUNCIA_O_DESPIDO","nombre":"Renuncia o constancia de despido","descripcion":"Documento que acredita la renuncia o la decisión de despido, según corresponda."}
    ]'::jsonb,
    false,
    100,
    'SISTEMA'
  )
on conflict (codigo) do nothing;

alter table public.documentos_cxp
drop constraint if exists documentos_cxp_tipo_documento_chk;

alter table public.documentos_cxp
add constraint documentos_cxp_tipo_documento_chk
check (tipo_documento ~ '^[A-Z0-9_]+$');

alter table public.documentos_cxp
add column if not exists contexto_documental text null,
add column if not exists origen_requisito text not null default 'GENERAL',
add column if not exists confianza_ia numeric(5,4) null,
add column if not exists justificacion_contexto text null;

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

alter table public.contextos_documentales_cxp enable row level security;

drop policy if exists "contextos_documentales_cxp_select_authenticated"
on public.contextos_documentales_cxp;
create policy "contextos_documentales_cxp_select_authenticated"
on public.contextos_documentales_cxp
for select
to authenticated
using (true);

drop policy if exists "contextos_documentales_cxp_insert_authenticated"
on public.contextos_documentales_cxp;
create policy "contextos_documentales_cxp_insert_authenticated"
on public.contextos_documentales_cxp
for insert
to authenticated
with check (usuario_registro is null or usuario_registro = auth.uid());

drop policy if exists "contextos_documentales_cxp_update_authenticated"
on public.contextos_documentales_cxp;
create policy "contextos_documentales_cxp_update_authenticated"
on public.contextos_documentales_cxp
for update
to authenticated
using (true)
with check (usuario_registro is null or usuario_registro = auth.uid());

drop policy if exists "contextos_documentales_cxp_delete_authenticated"
on public.contextos_documentales_cxp;
create policy "contextos_documentales_cxp_delete_authenticated"
on public.contextos_documentales_cxp
for delete
to authenticated
using (origen <> 'SISTEMA');

comment on table public.contextos_documentales_cxp is
'Catálogo dinámico de contextos y requisitos que usa la IA para clasificar cada cuenta por pagar.';

comment on column public.contextos_documentales_cxp.requisitos is
'Arreglo JSON de objetos con codigo, nombre y descripcion del documento requerido.';
