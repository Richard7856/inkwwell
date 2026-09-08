-- Calidad de tracking medida al activar.
-- Proyecto duzfvyfhsvhavptuxehi.
--
-- POR QUÉ SE GUARDA Y NO SOLO SE MUESTRA:
-- los umbrales del analizador (worker/analyzer.js) son heurísticas sin calibrar
-- — así lo dice su propio encabezado. Calibrarlas exige comparar el número que
-- predijo el analizador contra si el tatuaje funcionó de verdad en cámara.
-- Ese contraste solo es posible si el número queda escrito junto al tatuaje.
-- Sin esta tabla, cada activación tira a la basura el dato que necesitamos.

alter table public.tattoos
  add column if not exists quality_level text
    check (quality_level is null or quality_level in ('malo', 'aceptable', 'bueno', 'excelente'));

-- Fracción del techo teórico de puntos de seguimiento (0-1). Es el predictor
-- más directo de si el contenido se queda pegado al moverse la cámara.
-- Referencia medida: tatuaje de la huella 0.16, marcador generado 0.33.
alter table public.tattoos
  add column if not exists quality_tracking_fill numeric(4, 3);

-- Métricas completas del analizador, tal cual las devolvió.
-- Se guarda el objeto entero en vez de columnas sueltas porque todavía no
-- sabemos cuáles van a resultar predictivas: los puntos de detección ya se
-- descartaron como predictor (un candidato con 4279 rastreaba peor que uno con
-- 3440). Congelar hoy un esquema de columnas sería apostar a la métrica
-- equivocada; el jsonb deja abierta la pregunta hasta tener datos.
alter table public.tattoos
  add column if not exists quality_metrics jsonb;

-- El usuario vio la advertencia y activó de todos modos.
-- ES LA COLUMNA MÁS VALIOSA DE LAS CUATRO: marca exactamente los casos donde
-- el analizador dijo "malo" y el humano no estuvo de acuerdo. Si estos tatuajes
-- después funcionan bien, los umbrales están castigando de más y hay que
-- bajarlos; si generan quejas, están bien puestos.
alter table public.tattoos
  add column if not exists quality_overridden boolean not null default false;

-- Para revisar de un vistazo qué se activó pese a la advertencia
create index if not exists idx_tattoos_calidad_forzada
  on public.tattoos (created_at desc)
  where quality_overridden;

-- NOTA SOBRE RLS: no se agregan políticas. Las columnas viajan en el mismo
-- insert que ya cubre "tattoos_insert" y se leen con "tattoos_public_read".
-- Que el veredicto sea legible en público es deliberado: no es un dato
-- sensible y sirve para diagnosticar un escaneo que falla sin pedir sesión.
