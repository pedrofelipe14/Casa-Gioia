-- Descuenta stock de forma atómica (bloquea la fila mientras decide) para
-- que dos compras concurrentes de la última unidad no puedan vender de más.
-- Devuelve true si se pudo descontar (o si el producto no tiene stock
-- limitado, stock = null), false si no alcanzaba.
create or replace function descontar_stock(p_id uuid, p_qty int)
returns boolean
language plpgsql
as $$
declare
  v_stock int;
begin
  select stock into v_stock from productos where id = p_id for update;

  if v_stock is null then
    return true; -- sin límite de stock controlado
  end if;

  if v_stock < p_qty then
    return false; -- no alcanza
  end if;

  update productos set stock = stock - p_qty where id = p_id;
  return true;
end;
$$;
