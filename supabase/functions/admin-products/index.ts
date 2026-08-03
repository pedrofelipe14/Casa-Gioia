import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

const CATEGORIAS_VALIDAS = ["accesorios", "deco", "deli", "muebles"]

function deny()         { return new Response(JSON.stringify({ error: "No autorizado" }),  { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }) }
function bad(m: string) { return new Response(JSON.stringify({ error: m }),                { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }) }
function err()          { return new Response(JSON.stringify({ error: "Error interno" }),  { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }) }
function ok(d: unknown) { return new Response(JSON.stringify(d),                           { headers: { ...CORS, "Content-Type": "application/json" } }) }

async function verifyAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return false
  const adminEmail = Deno.env.get("ADMIN_EMAIL")
  if (!adminEmail) return false
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } })
  const { data: { user }, error } = await client.auth.getUser(token)
  return !error && user?.email === adminEmail
}

function getAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (!await verifyAdmin(req)) return deny()

  const admin = getAdmin()

  // GET — listar todos los productos (admin ve todos, incluso inactivos)
  if (req.method === "GET") {
    const { data, error } = await admin.from("productos").select("*").order("created_at", { ascending: false })
    if (error) { console.error(error); return err() }
    return ok({ productos: data })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return bad("Body inválido") }

  // POST — crear producto
  if (req.method === "POST") {
    const { nombre, precio, descripcion, categoria, imagen_url, fotos, activo, stock, dimensiones, peso } = body

    if (typeof nombre !== "string" || !nombre.trim()) return bad("Nombre requerido")
    if (!Number.isInteger(precio) || (precio as number) <= 0) return bad("Precio inválido")
    const cats = Array.isArray(categoria) ? categoria : []
    if (cats.some((c: unknown) => !CATEGORIAS_VALIDAS.includes(c as string))) return bad("Categoría inválida")
    if (stock !== null && stock !== undefined && (!Number.isInteger(stock) || (stock as number) < 0)) return bad("Stock inválido")

    const { data, error } = await admin.from("productos").insert({
      nombre:      nombre.trim(),
      precio:      Number(precio),
      descripcion: typeof descripcion === "string" ? descripcion.trim() : null,
      categoria:   cats,
      imagen_url:  typeof imagen_url === "string" ? imagen_url.trim() : null,
      fotos:       Array.isArray(fotos) ? fotos : [],
      activo:      activo !== false,
      stock:       Number.isInteger(stock) ? Number(stock) : null,
      dimensiones: typeof dimensiones === "string" ? dimensiones.trim() : null,
      peso:        typeof peso === "string" ? peso.trim() : null,
    }).select().single()

    if (error) { console.error(error); return err() }
    return ok({ producto: data })
  }

  // PUT — editar producto
  if (req.method === "PUT") {
    const { id, nombre, precio, descripcion, categoria, imagen_url, fotos, activo, stock, dimensiones, peso } = body

    if (typeof id !== "string" || !id) return bad("ID requerido")
    if (typeof nombre !== "string" || !nombre.trim()) return bad("Nombre requerido")
    if (!Number.isInteger(precio) || (precio as number) <= 0) return bad("Precio inválido")
    const cats = Array.isArray(categoria) ? categoria : []
    if (cats.some((c: unknown) => !CATEGORIAS_VALIDAS.includes(c as string))) return bad("Categoría inválida")
    if (stock !== null && stock !== undefined && (!Number.isInteger(stock) || (stock as number) < 0)) return bad("Stock inválido")

    const { data, error } = await admin.from("productos").update({
      nombre:      nombre.trim(),
      precio:      Number(precio),
      descripcion: typeof descripcion === "string" ? descripcion.trim() : null,
      categoria:   cats,
      imagen_url:  typeof imagen_url === "string" ? imagen_url.trim() : null,
      fotos:       Array.isArray(fotos) ? fotos : [],
      activo:      activo !== false,
      stock:       Number.isInteger(stock) ? Number(stock) : null,
      dimensiones: typeof dimensiones === "string" ? dimensiones.trim() : null,
      peso:        typeof peso === "string" ? peso.trim() : null,
      updated_at:  new Date().toISOString(),
    }).eq("id", id).select().single()

    if (error) { console.error(error); return err() }
    return ok({ producto: data })
  }

  // DELETE — eliminar producto definitivamente
  if (req.method === "DELETE") {
    const { id } = body
    if (typeof id !== "string" || !id) return bad("ID requerido")

    const { error } = await admin.from("productos").delete().eq("id", id)
    if (error) { console.error(error); return err() }
    return ok({ ok: true })
  }

  return new Response("Método no permitido", { status: 405, headers: CORS })
})
