-- 1. Columna nueva para no mandar el mismo recordatorio dos veces
alter table carritos add column if not exists recordatorio_enviado boolean not null default false;

-- 2. Extensiones necesarias para programar tareas (si ya están activadas
--    esto no hace nada, es seguro correrlo igual)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 3. Tarea programada: corre cada hora, la función decide sola a quién
--    hay que recordarle (carritos de más de 24hs sin actividad)
select cron.schedule(
  'abandoned-cart-reminder',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://dzuymtiutglcyrdcxkaj.supabase.co/functions/v1/abandoned-cart-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PEGAR_SERVICE_ROLE_KEY_ACA'
    ),
    body := '{}'::jsonb
  );
  $$
);
