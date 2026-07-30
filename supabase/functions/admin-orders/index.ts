import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

// Verifica que el token pertenezca al admin configurado en ADMIN_EMAIL (secret)
async function verifyAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return false

  const adminEmail = Deno.env.get("ADMIN_EMAIL")
  if (!adminEmail) return false

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } }
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return false
  return user.email === adminEmail
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
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

  // GET → pedidos + stats (solo método GET permitido a partir de acá)
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
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
