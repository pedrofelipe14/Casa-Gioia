import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { makeResponders } from "../_shared/responses.ts"
import { getAdminClient, verifyAdmin } from "../_shared/supabase.ts"

const CORS = corsHeaders("GET, POST, PUT, DELETE, OPTIONS")
const { ok, deny, bad, serverError } = makeResponders(CORS, "admin-products")

const CATEGORIAS_VALIDAS = ["accesorios", "deco", "deli", "muebles"]

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (!await verifyAdmin(req)) return deny()

  const admin = getAdminClient()

  // GET — listar todos los productos (admin ve todos, incluso inactivos)
  if (req.method === "GET") {
    const { data, error } = await admin.from("productos").select("*").order("created_at", { ascending: false })
    if (error) { console.error(error); return serverError(error) }
    return ok({ productos: data })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return bad("Body inválido") }

  // POST — crear producto
  if (req.method === "POST") {
    const { nombre, precio, descripcion, categoria, imagen_url, imagen_focal, fotos, fotos_focal, activo, stock, dimensiones, peso, variantes } = body

    if (typeof nombre !== "string" || !nombre.trim()) return bad("Nombre requerido")
    if (!Number.isInteger(precio) || (precio as number) <= 0) return bad("Precio inválido")
    const cats = Array.isArray(categoria) ? categoria : []
    if (cats.some((c: unknown) => !CATEGORIAS_VALIDAS.includes(c as string))) return bad("Categoría inválida")
    if (stock !== null && stock !== undefined && (!Number.isInteger(stock) || (stock as number) < 0)) return bad("Stock inválido")
    const { data, error } = await admin.from("productos").insert({
      nombre:       nombre.trim(),
      precio:       Number(precio),
      descripcion:  typeof descripcion === "string" ? descripcion.trim() : null,
      categoria:    cats,
      imagen_url:   typeof imagen_url === "string" ? imagen_url.trim() : null,
      imagen_focal: typeof imagen_focal === "string" ? imagen_focal : null,
      fotos:        Array.isArray(fotos) ? fotos : [],
      fotos_focal:  Array.isArray(fotos_focal) ? fotos_focal : [],
      activo:       activo !== false,
      stock:        Number.isInteger(stock) ? Number(stock) : null,
      dimensiones:  typeof dimensiones === "string" ? dimensiones.trim() : null,
      peso:         typeof peso === "string" ? peso.trim() : null,
      variantes:    Array.isArray(variantes) ? variantes : [],
    }).select().single()

    if (error) { console.error(error); return serverError(error) }
    return ok({ producto: data })
  }

  // PUT — editar producto
  if (req.method === "PUT") {
    const { id, nombre, precio, descripcion, categoria, imagen_url, imagen_focal, fotos, fotos_focal, activo, stock, dimensiones, peso, variantes } = body

    if (typeof id !== "string" || !id) return bad("ID requerido")
    if (typeof nombre !== "string" || !nombre.trim()) return bad("Nombre requerido")
    if (!Number.isInteger(precio) || (precio as number) <= 0) return bad("Precio inválido")
    const cats = Array.isArray(categoria) ? categoria : []
    if (cats.some((c: unknown) => !CATEGORIAS_VALIDAS.includes(c as string))) return bad("Categoría inválida")
    if (stock !== null && stock !== undefined && (!Number.isInteger(stock) || (stock as number) < 0)) return bad("Stock inválido")

    const { data, error } = await admin.from("productos").update({
      nombre:       nombre.trim(),
      precio:       Number(precio),
      descripcion:  typeof descripcion === "string" ? descripcion.trim() : null,
      categoria:    cats,
      imagen_url:   typeof imagen_url === "string" ? imagen_url.trim() : null,
      imagen_focal: typeof imagen_focal === "string" ? imagen_focal : null,
      fotos:        Array.isArray(fotos) ? fotos : [],
      fotos_focal:  Array.isArray(fotos_focal) ? fotos_focal : [],
      activo:       activo !== false,
      stock:        Number.isInteger(stock) ? Number(stock) : null,
      dimensiones:  typeof dimensiones === "string" ? dimensiones.trim() : null,
      peso:         typeof peso === "string" ? peso.trim() : null,
      variantes:    Array.isArray(variantes) ? variantes : [],
      updated_at:   new Date().toISOString(),
    }).eq("id", id).select().single()

    if (error) { console.error(error); return serverError(error) }
    return ok({ producto: data })
  }

  // DELETE — eliminar producto definitivamente
  if (req.method === "DELETE") {
    const { id } = body
    if (typeof id !== "string" || !id) return bad("ID requerido")

    const { error } = await admin.from("productos").delete().eq("id", id)
    if (error) { console.error(error); return serverError(error) }
    return ok({ ok: true })
  }

  return new Response("Método no permitido", { status: 405, headers: CORS })
})
