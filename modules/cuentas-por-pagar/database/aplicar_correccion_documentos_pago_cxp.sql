-- Correccion limitada al traspaso documental. Conserva la firma, los permisos
-- y el resto de la funcion de pago instalada. No modifica pagos existentes.
-- Requiere autorizacion antes de aplicarse en el proyecto remoto.
begin;

do $correccion$
declare
  v_definicion text;
  v_anterior text := $anterior$  -- Cada documento pendiente se registra como una fila independiente en la
  -- orden de pago. La lista base coincide con la interfaz de CxP: cuando un
  -- registro documental heredado no existe, el documento se considera
  -- pendiente; unicamente CUMPLIDO evita que se copie.
  insert into documentos_faltantes_orden_pago (
    no_orden,
    nombre_documento,
    observacion,
    estado,
    usuario_registro
  )
  select
    v_no_orden,
    format(
      '%s - Orden de compra #%s',
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        documento_base.nombre_documento
      ),
      t.no_cxp
    ),
    format(
      'Contexto exclusivo de la orden de compra/CxP #%s. Tipo de movimiento: %s. Documento pendiente solicitado: %s (%s). Fecha de la compra: %s. Descripcion de la compra: %s. Monto total de la obligacion: %s. Saldo antes del pago: %s. Beneficiario: %s, identificacion %s. Orden de pago: #%s. Cheque: #%s. Fecha del pago: %s. Cuenta de pago: %s. Descripcion general del pago: %s. Monto pagado para esta compra: %s. Total del egreso consolidado: %s. Este documento corresponde solamente a esta compra y no debe combinarse con otras CxP de la misma orden de pago.',
      t.no_cxp,
      coalesce(nullif(t.tipo_movimiento, ''), 'Sin tipo'),
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        documento_base.nombre_documento
      ),
      documento_base.tipo_documento,
      coalesce(to_char(cp.fecha, 'YYYY-MM-DD'), 'Sin fecha'),
      coalesce(nullif(trim(cp.descripcion), ''), 'Sin descripcion'),
      to_char(coalesce(cp.haber, 0), 'FM999999999999990.00'),
      to_char(
        greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0),
        'FM999999999999990.00'
      ),
      coalesce(nullif(trim(b.nombre), ''), 'No identificado'),
      coalesce(nullif(trim(cp.id_beneficiario), ''), 'No identificada'),
      v_no_orden,
      t.no_cheque,
      to_char(p_fecha, 'YYYY-MM-DD'),
      p_cuenta,
      trim(p_descripcion_pago),
      to_char(t.monto_pago, 'FM999999999999990.00'),
      to_char(v_total_pago, 'FM999999999999990.00')
    ),
    'FALTANTE',
    p_usuario_registro
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  cross join (
    values
      ('SOLICITUD'::text, 'Solicitud'::text),
      ('LIQUIDACION'::text, 'Liquidacion de orden de compra'::text)
  ) as documento_base(tipo_documento, nombre_documento)
  left join documentos_cxp dc
    on dc.no_cxp = t.no_cxp
   and upper(trim(coalesce(dc.tipo_movimiento, ''))) =
       upper(trim(t.tipo_movimiento))
   and upper(trim(dc.tipo_documento)) = documento_base.tipo_documento
  left join beneficiarios b
    on b.id = cp.id_beneficiario
  where upper(trim(coalesce(dc.estado, 'PENDIENTE'))) = 'PENDIENTE';
$anterior$;
  v_corregido text := $corregido$  -- El checklist guardado es la fuente de los documentos por trasladar.
  -- Copiar solo requisitos PENDIENTES, incluidos los personalizados.
  -- Sin requisitos o con todos CUMPLIDOS no se inserta ningun faltante.
  insert into documentos_faltantes_orden_pago (
    no_orden,
    nombre_documento,
    observacion,
    estado,
    usuario_registro
  )
  select
    v_no_orden,
    format(
      '%s - Orden de compra #%s',
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        dc.tipo_documento
      ),
      t.no_cxp
    ),
    format(
      'Contexto exclusivo de la orden de compra/CxP #%s. Tipo de movimiento: %s. Documento pendiente solicitado: %s (%s). Fecha de la compra: %s. Descripcion de la compra: %s. Monto total de la obligacion: %s. Saldo antes del pago: %s. Beneficiario: %s, identificacion %s. Orden de pago: #%s. Cheque: #%s. Fecha del pago: %s. Cuenta de pago: %s. Descripcion general del pago: %s. Monto pagado para esta compra: %s. Total del egreso consolidado: %s. Este documento corresponde solamente a esta compra y no debe combinarse con otras CxP de la misma orden de pago.',
      t.no_cxp,
      coalesce(nullif(t.tipo_movimiento, ''), 'Sin tipo'),
      coalesce(
        nullif(trim(dc.nombre_documento), ''),
        dc.tipo_documento
      ),
      dc.tipo_documento,
      coalesce(to_char(cp.fecha, 'YYYY-MM-DD'), 'Sin fecha'),
      coalesce(nullif(trim(cp.descripcion), ''), 'Sin descripcion'),
      to_char(coalesce(cp.haber, 0), 'FM999999999999990.00'),
      to_char(
        greatest(coalesce(cp.haber, 0) - coalesce(cp.debe, 0), 0),
        'FM999999999999990.00'
      ),
      coalesce(nullif(trim(b.nombre), ''), 'No identificado'),
      coalesce(nullif(trim(cp.id_beneficiario), ''), 'No identificada'),
      v_no_orden,
      t.no_cheque,
      to_char(p_fecha, 'YYYY-MM-DD'),
      p_cuenta,
      trim(p_descripcion_pago),
      to_char(t.monto_pago, 'FM999999999999990.00'),
      to_char(v_total_pago, 'FM999999999999990.00')
    ),
    'FALTANTE',
    p_usuario_registro
  from tmp_pago_cxps t
  join cuentas_por_pagar cp
    on cp.no_cxp = t.no_cxp
   and coalesce(cp.tipo_movimiento, '') = t.tipo_movimiento
  join documentos_cxp dc
    on dc.no_cxp = t.no_cxp
   and upper(trim(coalesce(dc.tipo_movimiento, ''))) =
       upper(trim(t.tipo_movimiento))
  left join beneficiarios b
    on b.id = cp.id_beneficiario
  where dc.estado = 'PENDIENTE';
$corregido$;
begin
  select pg_get_functiondef(
    'public.procesar_pago_multiple_cxp_con_compromiso(jsonb,date,integer,text,text,text,integer)'::regprocedure
  ) into v_definicion;

  if position(v_corregido in v_definicion) > 0 then
    return;
  end if;

  if position(v_anterior in v_definicion) = 0 then
    raise exception 'El bloque documental instalado no coincide con el revisado. Revisar antes de aplicar.';
  end if;

  execute replace(v_definicion, v_anterior, v_corregido);
end;
$correccion$;

commit;

