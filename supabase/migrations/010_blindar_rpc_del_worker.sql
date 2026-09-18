-- Cierra un agujero de créditos infinitos.
--
-- ── Qué estaba mal ──
-- `reservar_credito_generacion` y `reembolsar_generacion` son SECURITY DEFINER
-- —escriben en `credit_ledger`, que a propósito NO tiene política de INSERT— y
-- reciben `p_user` como PARÁMETRO en vez de leer `auth.uid()`. Eso está bien:
-- las llama el worker con la llave de servicio, en nombre de otro.
--
-- Lo que estaba mal es que además tenían EXECUTE para `anon` y `authenticated`,
-- que es el grant por omisión de Supabase para todo lo que vive en `public`.
-- La llave anónima viaja pública en el bundle de la app y en el sitio, así que
-- cualquiera podía:
--
--     POST /rest/v1/rpc/reembolsar_generacion
--     { "p_user": "<cualquier usuario>", "p_generacion": "<uuid al azar>" }
--
-- y quedarse con +1 crédito. El índice único (motivo, referencia) no lo frena:
-- basta inventar otro UUID para que la referencia sea distinta. Créditos
-- infinitos, gratis y sin cuenta.
--
-- La gemela permitía lo contrario —restarle un crédito a otro usuario si se
-- conocía su id— que no da dinero pero sí hace daño.
--
-- ── Por qué basta con revocar ──
-- El worker se autentica con `service_role`, que conserva su EXECUTE. Ninguna
-- pantalla de la app llama a estas dos: se buscó `reservar_credito` y
-- `reembolsar_generacion` en `src/` y no aparecen. El cliente usa
-- `saldo_creditos()` y `consumir_creditos()`, que sí leen `auth.uid()` y por eso
-- pueden seguir abiertas.
--
-- ── Por qué no se cambia la firma ──
-- Hacer que lean `auth.uid()` rompería al worker, que es justamente quien tiene
-- que poder actuar en nombre de otro. El problema nunca fue la firma: fue quién
-- podía llamarla.

revoke execute on function public.reservar_credito_generacion(uuid, uuid) from anon, authenticated;
revoke execute on function public.reembolsar_generacion(uuid, uuid)        from anon, authenticated;

-- Explícito, para que no dependa de un grant heredado que alguien pueda quitar
grant execute on function public.reservar_credito_generacion(uuid, uuid) to service_role;
grant execute on function public.reembolsar_generacion(uuid, uuid)        to service_role;
