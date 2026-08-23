ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tracking_numero  text,
  ADD COLUMN IF NOT EXISTS tracking_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_url     text;
