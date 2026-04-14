-- Inkwell AR — Row Level Security policies (Phase 1)
-- Ejecutar en Supabase SQL Editor después de la migración 001

-- ¿Por qué habilitar RLS y luego crear políticas permisivas?
-- Supabase tiene RLS deshabilitado por defecto, lo que permite acceso total.
-- Es mejor práctica: habilitar RLS siempre y definir explícitamente qué se permite.
-- Estas políticas son permisivas para Phase 1 (sin auth).
-- En Phase 2 se reemplazan por políticas basadas en auth.uid().

-- === TABLA: tattoos ===

alter table tattoos enable row level security;

-- Cualquiera puede leer tatuajes activos — necesario para el ARViewer (Flujo B)
-- El escaneo funciona sin login: targetLoader consulta por tattoo_id público
create policy "tattoos_public_read"
  on tattoos for select
  using (true);

-- Cualquiera puede insertar tatuajes — Flujo A sin auth (Phase 1)
-- Phase 2: cambiar a `with check (auth.uid() = user_id)` cuando se agregue auth
create policy "tattoos_public_insert"
  on tattoos for insert
  with check (true);

-- === TABLA: designs ===

alter table designs enable row level security;

-- Solo lectura pública — el catálogo lo administra el equipo desde Dashboard
create policy "designs_public_read"
  on designs for select
  using (true);

-- No permitir inserts por API desde el cliente — solo desde Dashboard o service role
-- (no se crea policy de insert, lo que bloquea inserts con anon key)
