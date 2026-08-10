-- Inkwell AR — Buckets de Storage
--
-- Antes estos buckets se creaban a mano en el Dashboard (así lo dicen los
-- comentarios de src/lib/storage.js). El problema de eso es que no queda
-- registro: quien levante el proyecto en otra cuenta no sabe que existen
-- hasta que el upload falla con "Bucket not found".

-- === BUCKETS ===

-- Fotos de tatuajes subidas por el usuario.
-- public = true porque el ARViewer y el thumbnail de confirmación las leen
-- sin sesión; son fotos de un tatuaje, no datos sensibles.
insert into storage.buckets (id, name, public)
values ('tattoo-images', 'tattoo-images', true)
on conflict (id) do nothing;

-- Archivos .mind compilados. Los lee MindAR desde el navegador de cualquiera
-- que escanee, así que también públicos.
insert into storage.buckets (id, name, public)
values ('mind-files', 'mind-files', true)
on conflict (id) do nothing;

-- === POLICIES ===
--
-- storage.objects trae RLS activo por defecto. Que el bucket sea `public`
-- resuelve la LECTURA por CDN, pero la SUBIDA desde el cliente con la anon key
-- necesita policy explícita de insert — sin ella el upload falla con un
-- "new row violates row-level security policy" bastante opaco.
--
-- Phase 1 sin auth: cualquiera puede subir. Igual que las policies de la
-- tabla `tattoos` (ver 002), en Phase 2 esto se ata a auth.uid().

drop policy if exists "tattoo_images_anon_insert" on storage.objects;
create policy "tattoo_images_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'tattoo-images');

drop policy if exists "tattoo_images_anon_read" on storage.objects;
create policy "tattoo_images_anon_read"
  on storage.objects for select
  using (bucket_id = 'tattoo-images');

drop policy if exists "mind_files_anon_insert" on storage.objects;
create policy "mind_files_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'mind-files');

drop policy if exists "mind_files_anon_read" on storage.objects;
create policy "mind_files_anon_read"
  on storage.objects for select
  using (bucket_id = 'mind-files');
