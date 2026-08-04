import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

const ALLOWED_ESTADOS = ["pendiente", "confirmado", "preparando", "en_camino", "entregado", "cancelado"]

// Validación de UUID v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function deny() {
  return new Response(JSON.stringify({ error: "No autorizado" }), {
    status: 401,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function serverError() {
  return new Response(JSON.stringify({ error: "Error interno" }), {
    status: 500,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

async function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  )
}

// Verifica que el token pertenezca a alguno de los admins configurados
// en ADMIN_EMAILS (secret, separado por comas). Mantiene ADMIN_EMAIL
// (singular) como fallback por compatibilidad.
async function verifyAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return false

  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? Deno.env.get("ADMIN_EMAIL") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!adminEmails.length) return false

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } }
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user?.email) return false
  return adminEmails.includes(user.email.toLowerCase())
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  // GET ?scope=whoami — cualquier usuario logueado puede preguntar si es
  // admin (para mostrar/ocultar el botón al panel en el perfil). No es
  // información sensible: la autorización real sigue en cada endpoint.
  if (req.method === "GET" && new URL(req.url).searchParams.get("scope") === "whoami") {
    const isAdmin = await verifyAdmin(req)
    return new Response(JSON.stringify({ isAdmin }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  if (!await verifyAdmin(req)) return deny()

  const admin = await getAdminClient()

  // POST → actualizar estado de un pedido
  if (req.method === "POST") {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return badRequest("Cuerpo inválido")
    }

    const { id, estado } = body

    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return badRequest("ID inválido")
    }
    if (typeof estado !== "string" || !ALLOWED_ESTADOS.includes(estado)) {
      return badRequest("Estado inválido")
    }

    const { error } = await admin.from("pedidos").update({ estado }).eq("id", id)
    if (error) {
      console.error("update estado error:", error)
      return serverError()
    }

    // Email de actualización (fire & forget — no bloquea la respuesta)
    ;(async () => {
      try {
        const { data: pedido } = await admin.from("pedidos").select("*").eq("id", id).single()
        if (!pedido) return
        const { data: userData } = await admin.auth.admin.getUserById(pedido.user_id)
        const userEmail = userData?.user?.email
        if (!userEmail) return
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({
            type: "status_update",
            email: userEmail,
            data: { numero_pedido: pedido.numero_pedido, estado },
          }),
        })
      } catch (e) {
        console.error("email on status update:", e)
      }
    })()

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  // DELETE → eliminar un pedido definitivamente
  if (req.method === "DELETE") {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return badRequest("Cuerpo inválido")
    }

    const { id } = body
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return badRequest("ID inválido")
    }

    const { error, count } = await admin.from("pedidos").delete({ count: "exact" }).eq("id", id)
    if (error) {
      console.error("delete pedido error:", error)
      return serverError()
    }
    if (!count) return badRequest("Pedido no encontrado")

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  // GET → pedidos + stats (solo método GET permitido a partir de acá)
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const url = new URL(req.url)
  const scope = url.searchParams.get("scope")

  // GET ?scope=carritos — carritos abandonados (nunca se borra nada acá,
  // solo se descartan del reporte los que ya se convirtieron en compra)
  if (scope === "carritos") {
    const { data: carritos, error } = await admin
      .from("carritos")
      .select("*")
      .order("updated_at", { ascending: false })

    if (error) { console.error("fetch carritos error:", error); return serverError() }

    const uids = [...new Set((carritos ?? []).map((c: Record<string, unknown>) => c.user_id as string))]

    const emailMap: Record<string, string> = {}
    await Promise.all(uids.map(async (uid: string) => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user) emailMap[uid] = data.user.email ?? "—"
    }))

    // Última compra de cada usuario, para descartar los que ya convirtieron
    const lastPurchaseMap: Record<string, string> = {}
    if (uids.length) {
      const { data: pedidosUsuarios, error: pedidosErr } = await admin
        .from("pedidos")
        .select("user_id, created_at")
        .in("user_id", uids)

      if (pedidosErr) console.error("fetch pedidos for carritos error:", pedidosErr)
      for (const p of pedidosUsuarios ?? []) {
        const prev = lastPurchaseMap[p.user_id as string]
        if (!prev || (p.created_at as string) > prev) lastPurchaseMap[p.user_id as string] = p.created_at as string
      }
    }

    const abandonados = (carritos ?? [])
      .filter((c: Record<string, unknown>) => {
        const lastPurchase = lastPurchaseMap[c.user_id as string]
        // Si compró después de la última vez que tocó el carrito, ya no está "abandonado"
        return !lastPurchase || lastPurchase < (c.updated_at as string)
      })
      .map((c: Record<string, unknown>) => ({
        ...c,
        cliente_email: emailMap[c.user_id as string] ?? "—",
      }))

    return new Response(JSON.stringify({ carritos: abandonados }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const [pedidosRes, usersRes] = await Promise.all([
    admin.from("pedidos").select("*").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (pedidosRes.error) {
    console.error("fetch pedidos error:", pedidosRes.error)
    return serverError()
  }

  const pedidos = pedidosRes.data ?? []
  const userCount = usersRes.data?.users?.length ?? 0

  const uids = [...new Set(pedidos.map((p: Record<string, unknown>) => p.user_id as string))]
  const emailMap: Record<string, string> = {}
  await Promise.all(uids.map(async (uid) => {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user) emailMap[uid] = data.user.email ?? "—"
  }))

  const enriched = pedidos.map((p: Record<string, unknown>) => ({
    ...p,
    cliente_email: emailMap[p.user_id as string] ?? "—",
  }))

  return new Response(JSON.stringify({ pedidos: enriched, user_count: userCount }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  })
})
