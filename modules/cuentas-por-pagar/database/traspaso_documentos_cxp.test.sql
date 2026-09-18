-- Ejecutar en PostgreSQL. Usa solo tablas temporales y revierte al terminar.
-- Prueba el INSERT real de la RPC instalada, sin registrar pagos ni egresos.
begin;

create temp table tmp_pago_cxps (
  no_cxp bigint, tipo_movimiento text, monto_pago numeric, no_cheque integer
) on commit drop;
create temp table cuentas_por_pagar (
  no_cxp bigint, tipo_movimiento text, fecha date, descripcion text,
  haber numeric, debe numeric, id_beneficiario text
) on commit drop;
create temp table documentos_cxp (
  no_cxp bigint, tipo_movimiento text, tipo_documento text,
  nombre_documento text, estado text
) on commit drop;
create temp table beneficiarios (id text, nombre text) on commit drop;
create temp table documentos_faltantes_orden_pago (
  no_orden bigint, nombre_documento text, observacion text,
  estado text, usuario_registro text
) on commit drop;

insert into tmp_pago_cxps values
  (1, 'Compra', 100, 101), (2, 'Compra', 100, 101),
  (3, 'Compra', 50, 101), (4, 'Compra', 100, 101),
  (5, 'Compra', 100, 101), (5, 'Servicio', 100, 101),
  (7, '', 100, 101);
insert into cuentas_por_pagar
select no_cxp, nullif(tipo_movimiento, ''), date '2026-01-01',
  'Compra de prueba ' || no_cxp, 100, 0, 'proveedor-prueba'
from tmp_pago_cxps;
insert into beneficiarios values ('proveedor-prueba', 'Proveedor de prueba');

insert into documentos_cxp values
  -- Todos cumplidos, incluido un requisito fuera de la antigua lista fija.
  (1, 'Compra', 'SOLICITUD', 'Solicitud', 'CUMPLIDO'),
  (1, 'Compra', 'LIQUIDACION', 'Liquidacion', 'CUMPLIDO'),
  (1, 'Compra', 'ACTA_ENTREGA', 'Acta de entrega', 'CUMPLIDO'),
  -- La CxP 2 no tiene requisitos: no se deben inventar faltantes.
  -- Pago parcial: trasladar los dos pendientes y excluir el cumplido.
  (3, 'Compra', 'ACTA_ENTREGA', 'Acta de entrega de medicamentos', 'PENDIENTE'),
  (3, 'Compra', 'COTIZACION', 'Cotizacion autorizada', 'PENDIENTE'),
  (3, 'Compra', 'SOLICITUD', 'Solicitud', 'CUMPLIDO'),
  -- Los tipos generales siguen copiandose cuando realmente estan pendientes.
  (4, 'Compra', 'SOLICITUD', 'Solicitud', 'PENDIENTE'),
  (4, 'Compra', 'LIQUIDACION', 'Liquidacion', 'PENDIENTE'),
  -- Un mismo numero con distintos tipos de movimiento no mezcla checklists.
  (5, 'Compra', 'CONTRATO', 'Contrato de compra', 'CUMPLIDO'),
  (5, 'Servicio', 'CONTRATO', 'Contrato de servicio', 'PENDIENTE'),
  -- Una CxP no seleccionada tampoco aporta documentos.
  (6, 'Compra', 'FACTURA', 'Factura de otra cuenta', 'PENDIENTE'),
  (7, '', 'CONSTANCIA', 'Constancia', 'PENDIENTE');

do $test$
declare
  v_definicion text;
  v_insert text;
  v_parametro text;
  v_valor text;
begin
  select pg_get_functiondef(
    'public.procesar_pago_multiple_cxp_con_compromiso(jsonb,date,integer,text,text,text,integer)'::regprocedure
  ) into v_definicion;

  v_insert := substring(v_definicion from
    'insert into documentos_faltantes_orden_pago[\s\S]*?;');
  if v_insert is null then
    raise exception 'No se encontro el INSERT documental de la RPC.';
  end if;

  -- Vincular las variables de la RPC a datos sinteticos de esta prueba.
  for v_parametro, v_valor in
    select * from (values
      ('v_no_orden', '99001'),
      ('p_fecha', 'date ''2026-01-02'''),
      ('p_cuenta', '''Bancos de prueba'''),
      ('p_descripcion_pago', '''Pago de prueba'''),
      ('v_total_pago', '650'),
      ('p_usuario_registro', '''prueba-documental''')
    ) as parametros(nombre, valor)
  loop
    v_insert := regexp_replace(v_insert, '\m' || v_parametro || '\M', v_valor, 'g');
  end loop;
  execute v_insert;

  if (select count(*) from documentos_faltantes_orden_pago) <> 6 then
    raise exception 'Se esperaban exactamente 6 pendientes del checklist; recibidos: %',
      (select count(*) from documentos_faltantes_orden_pago);
  end if;

  if exists (
    (select nombre_documento from documentos_faltantes_orden_pago
     except all
     select nombre from (values
       ('Acta de entrega de medicamentos - Orden de compra #3'),
       ('Cotizacion autorizada - Orden de compra #3'),
       ('Solicitud - Orden de compra #4'),
       ('Liquidacion - Orden de compra #4'),
       ('Contrato de servicio - Orden de compra #5'),
       ('Constancia - Orden de compra #7')
     ) as esperados(nombre))
  ) then
    raise exception 'Los documentos transferidos no coinciden con los pendientes.';
  end if;

  if exists (
    select 1 from documentos_faltantes_orden_pago
    where no_orden <> 99001 or estado <> 'FALTANTE'
       or usuario_registro <> 'prueba-documental'
       or observacion not like '%Orden de pago: #99001.%'
       or observacion not like '%Cheque: #101.%'
  ) then
    raise exception 'Se perdio el contexto de la orden de pago.';
  end if;

  if not exists (
    select 1 from documentos_faltantes_orden_pago
    where nombre_documento = 'Acta de entrega de medicamentos - Orden de compra #3'
      and observacion like '%(ACTA_ENTREGA)%'
      and observacion like '%Monto pagado para esta compra: 50.00.%'
  ) or not exists (
    select 1 from documentos_faltantes_orden_pago
    where nombre_documento = 'Contrato de servicio - Orden de compra #5'
      and observacion like '%Tipo de movimiento: Servicio.%'
  ) then
    raise exception 'Se perdio el tipo de documento, el movimiento o el monto parcial.';
  end if;
end;
$test$;

select 'OK: checklist completo, sin requisitos, personalizados, pago parcial, '
  || 'varias CxP, tipos de movimiento y cuenta no seleccionada' as resultado;
rollback;
