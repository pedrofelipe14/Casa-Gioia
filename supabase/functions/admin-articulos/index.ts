import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { makeResponders } from "../_shared/responses.ts"
import { getAdminClient, verifyAdmin } from "../_shared/supabase.ts"

const CORS = corsHeaders("GET, POST, PUT, DELETE, OPTIONS")
const { ok, deny, bad, serverError } = makeResponders(CORS, "admin-articulos")

const CATEGORIAS_VALIDAS = ["deco", "moda", "viaje", "receta"]

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (!await verifyAdmin(req)) return deny()

  const admin = getAdminClient()

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("articulos")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) { console.error(error); return serverError(error) }
    return ok({ articulos: data })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return bad("Body inválido") }

  if (req.method === "POST") {
    const { titulo, extracto, contenido, categoria, imagen_url, autor, activo } = body
    if (typeof titulo !== "string" || !titulo.trim()) return bad("Título requerido")
    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria as string)) return bad("Categoría inválida")

    const { data, error } = await admin.from("articulos").insert({
      titulo:     titulo.trim(),
      extracto:   typeof extracto   === "string" ? extracto.trim()   || null : null,
      contenido:  typeof contenido  === "string" ? contenido.trim()  || null : null,
      categoria:  typeof categoria  === "string" ? categoria         : null,
      imagen_url: typeof imagen_url === "string" ? imagen_url.trim() || null : null,
      autor:      typeof autor      === "string" ? autor.trim() || "Casa Gioia" : "Casa Gioia",
      activo:     activo !== false,
    }).select().single()

    if (error) { console.error(error); return serverError(error) }
    return ok({ articulo: data })
  }

  if (req.method === "PUT") {
    const { id, titulo, extracto, contenido, categoria, imagen_url, autor, activo } = body
    if (typeof id !== "string" || !id) return bad("ID requerido")
    if (typeof titulo !== "string" || !titulo.trim()) return bad("Título requerido")
    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria as string)) return bad("Categoría inválida")

    const { data, error } = await admin.from("articulos").update({
      titulo:     titulo.trim(),
      extracto:   typeof extracto   === "string" ? extracto.trim()   || null : null,
      contenido:  typeof contenido  === "string" ? contenido.trim()  || null : null,
      categoria:  typeof categoria  === "string" ? categoria         : null,
      imagen_url: typeof imagen_url === "string" ? imagen_url.trim() || null : null,
      autor:      typeof autor      === "string" ? autor.trim() || "Casa Gioia" : "Casa Gioia",
      activo:     activo !== false,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single()

    if (error) { console.error(error); return serverError(error) }
    return ok({ articulo: data })
  }

  if (req.method === "DELETE") {
    const { id } = body
    if (typeof id !== "string" || !id) return bad("ID requerido")
    const { error } = await admin.from("articulos").delete().eq("id", id)
    if (error) { console.error(error); return serverError(error) }
    return ok({ ok: true })
  }

  return new Response("Método no permitido", { status: 405, headers: CORS })
})
