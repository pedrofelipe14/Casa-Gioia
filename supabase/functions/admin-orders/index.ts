import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "marchioripedro1@gmail.com"

async function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  )
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
  if (!token) return false
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await anonClient.auth.getUser(token)
  return user?.email === ADMIN_EMAIL
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (!await verifyAdmin(req)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  const admin = await getAdminClient()

  // POST → actualizar estado
  if (req.method === "POST") {
    const { id, estado } = await req.json()
    const { error } = await admin.from("pedidos").update({ estado }).eq("id", id)
    if (error) return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })

    // Enviar email de actualización (fire & forget)
    try {
      const { data: pedido } = await admin.from("pedidos").select("*").eq("id", id).single()
      if (pedido) {
        const { data: userData } = await admin.auth.admin.getUserById(pedido.user_id)
        const userEmail = userData?.user?.email
        if (userEmail) {
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
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
        }
      }
    } catch (_) { /* no bloquear la respuesta si el email falla */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }

  // GET → listar todos los pedidos + stats
  const [pedidosRes, usersRes] = await Promise.all([
    admin.from("pedidos").select("*").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (pedidosRes.error) return new Response(JSON.stringify({ error: pedidosRes.error.message }), {
    status: 500, headers: { ...CORS, "Content-Type": "application/json" },
  })

  const pedidos = pedidosRes.data ?? []
  const userCount = usersRes.data?.users?.length ?? 0

  // Enriquecer con email del cliente
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
