import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { makeResponders } from "../_shared/responses.ts"
import { getAdminClient, getAnonClient, verifyAdmin } from "../_shared/supabase.ts"
import { notifyError } from "../_shared/alert.ts"

const CORS = corsHeaders("GET, POST, DELETE, OPTIONS")
const { ok, deny, bad, serverError } = makeResponders(CORS, "admin-orders")

const ALLOWED_ESTADOS = ["pendiente", "confirmado", "preparando", "en_camino", "entregado", "cancelado"]

// Validación de UUID v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  // GET ?scope=whoami — cualquier usuario logueado puede preguntar si es
  // admin (para mostrar/ocultar el botón al panel en el perfil). No es
  // información sensible: la autorización real sigue en cada endpoint.
  if (req.method === "GET" && new URL(req.url).searchParams.get("scope") === "whoami") {
    const isAdmin = await verifyAdmin(req)
    return ok({ isAdmin })
  }

  if (!await verifyAdmin(req)) return deny()

  const admin = getAdminClient()

  if (req.method === "POST") {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return bad("Cuerpo inválido")
    }

    const action = new URL(req.url).searchParams.get("action")

    // POST ?action=venta_presencial — registrar una venta hecha en el local,
    // fuera del checkout online, para que cuente en las estadisticas.
    if (action === "venta_presencial") {
      const { items } = body
      if (!Array.isArray(items) || items.length === 0) return bad("Sin productos")
      if (items.some((i: Record<string, unknown>) => typeof i.id !== "string" || !i.id)) {
        return bad("IDs de productos inválidos")
      }
      if (items.some((i: Record<string, unknown>) => !Number.isInteger(i.qty) || (i.qty as number) < 1 || (i.qty as number) > 999)) {
        return bad("Cantidades inválidas")
      }

      const productIds = (items as Array<{ id: string }>).map((i) => i.id)
      const { data: productos, error: dbError } = await admin
        .from("productos")
        .select("id, nombre, precio, stock")
        .in("id", productIds)
      if (dbError || !productos?.length) return bad("Productos no encontrados")

      let total = 0
      const resolvedItems: Array<{ id: string; nombre: string; precio: number; qty: number }> = []
      for (const item of items as Array<{ id: string; qty: number }>) {
        const producto = productos.find((p: { id: string; nombre: string; precio: number }) => p.id === item.id)
        if (!producto) return bad(`Producto desconocido: ${item.id}`)
        total += producto.precio * item.qty
        resolvedItems.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, qty: item.qty })
      }

      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
      const anonClient = getAnonClient()
      const { data: { user: adminUser } } = await anonClient.auth.getUser(token)
      if (!adminUser) return deny()

      const numero = "CG" + Date.now().toString(36).toUpperCase()

      const { error: insertError } = await admin.from("pedidos").insert({
        user_id:       adminUser.id,
        numero_pedido: numero,
        total,
        estado:        "entregado",
        items:         resolvedItems,
        envio:         { tipo: "presencial" },
        origen:        "presencial",
      })
      if (insertError) {
        console.error("insert venta presencial error:", insertError)
        return serverError(insertError)
      }

      // Descontar stock de forma atómica, igual que una venta online aprobada
      // (ver descontar_stock: bloquea la fila para no pisarse con otra venta
      // concurrente).
      for (const item of resolvedItems) {
        const { error: stockErr } = await admin.rpc("descontar_stock", { p_id: item.id, p_qty: item.qty })
        if (stockErr) {
          console.error("descontar_stock error:", stockErr)
          notifyError("admin-orders/descontar_stock", stockErr).catch(() => {})
        }
      }

      return ok({ ok: true, numero_pedido: numero, total })
    }

    // POST (sin action) → actualizar estado de un pedido
    const { id, estado, tracking_numero, tracking_carrier, tracking_url } = body

    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return bad("ID inválido")
    }
    if (typeof estado !== "string" || !ALLOWED_ESTADOS.includes(estado)) {
      return bad("Estado inválido")
    }

    const updateData: Record<string, unknown> = { estado }
    if (typeof tracking_numero === "string" && tracking_numero.trim())
      updateData.tracking_numero = tracking_numero.trim()
    if (typeof tracking_carrier === "string" && tracking_carrier.trim())
      updateData.tracking_carrier = tracking_carrier.trim()
    if (typeof tracking_url === "string" && tracking_url.trim())
      updateData.tracking_url = tracking_url.trim()

    const { error } = await admin.from("pedidos").update(updateData).eq("id", id)
    if (error) {
      console.error("update estado error:", error)
      return serverError(error)
    }

    // Email de actualización (fire & forget — no bloquea la respuesta)
    ;(async () => {
      try {
        const { data: pedido } = await admin.from("pedidos").select("*").eq("id", id).single()
        if (!pedido) return
        if (pedido.origen === "presencial") return // no hay cliente real a quien avisarle
        // El email guardado en el pedido cubre cuentas registradas e invitados
        // (sesion anonima) por igual; auth.users solo tiene email para las primeras.
        let userEmail = pedido.email as string | null
        if (!userEmail) {
          const { data: userData } = await admin.auth.admin.getUserById(pedido.user_id)
          userEmail = userData?.user?.email ?? null
        }
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
            data: {
              numero_pedido:    pedido.numero_pedido,
              estado,
              tracking_numero:  pedido.tracking_numero  ?? null,
              tracking_carrier: pedido.tracking_carrier ?? null,
              tracking_url:     pedido.tracking_url     ?? null,
            },
          }),
        })
      } catch (e) {
        console.error("email on status update:", e)
      }
    })()

    return ok({ ok: true })
  }

  // DELETE → eliminar un pedido definitivamente
  if (req.method === "DELETE") {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return bad("Cuerpo inválido")
    }

    const { id } = body
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return bad("ID inválido")
    }

    const { error, count } = await admin.from("pedidos").delete({ count: "exact" }).eq("id", id)
    if (error) {
      console.error("delete pedido error:", error)
      return serverError(error)
    }
    if (!count) return bad("Pedido no encontrado")

    return ok({ ok: true })
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

    if (error) { console.error("fetch carritos error:", error); return serverError(error) }

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

    return ok({ carritos: abandonados })
  }

  // GET ?scope=usuarios — cuentas registradas (excluye sesiones anónimas
  // de invitados) con su actividad de compra.
  if (scope === "usuarios") {
    const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (usersErr) { console.error("fetch users error:", usersErr); return serverError(usersErr) }

    const users = (usersData?.users ?? []).filter((u) => !u.is_anonymous)
    const uids = users.map((u) => u.id)

    type Stats = { count: number; total: number; last: string | null }
    const statsMap: Record<string, Stats> = {}
    if (uids.length) {
      const { data: pedidosUsuarios, error: pedidosErr } = await admin
        .from("pedidos")
        .select("user_id, total, created_at, estado")
        .in("user_id", uids)

      if (pedidosErr) console.error("fetch pedidos for usuarios error:", pedidosErr)
      for (const p of pedidosUsuarios ?? []) {
        const uid = p.user_id as string
        if (!statsMap[uid]) statsMap[uid] = { count: 0, total: 0, last: null }
        if (p.estado !== "cancelado") {
          statsMap[uid].count += 1
          statsMap[uid].total += Number(p.total ?? 0)
        }
        const created = p.created_at as string
        if (!statsMap[uid].last || created > statsMap[uid].last!) statsMap[uid].last = created
      }
    }

    const usuarios = users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "—",
        nombre: (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || null,
        creado: u.created_at,
        ultimo_login: u.last_sign_in_at ?? null,
        pedidos_count: statsMap[u.id]?.count ?? 0,
        total_gastado: statsMap[u.id]?.total ?? 0,
        ultima_compra: statsMap[u.id]?.last ?? null,
      }))
      .sort((a, b) => (a.creado < b.creado ? 1 : -1))

    return ok({ usuarios })
  }

  const [pedidosRes, usersRes] = await Promise.all([
    admin.from("pedidos").select("*").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (pedidosRes.error) {
    console.error("fetch pedidos error:", pedidosRes.error)
    return serverError(pedidosRes.error)
  }

  const pedidos = pedidosRes.data ?? []
  // No contar las sesiones anonimas de invitados como "usuarios" registrados
  const userCount = usersRes.data?.users?.filter((u) => !u.is_anonymous).length ?? 0

  // Pedidos sin email guardado (ordenes viejas, de antes de esta columna) —
  // para esos, buscamos el email de la cuenta como fallback
  const uidsSinEmail = [...new Set(
    pedidos.filter((p: Record<string, unknown>) => !p.email).map((p: Record<string, unknown>) => p.user_id as string)
  )]
  const emailMap: Record<string, string> = {}
  await Promise.all(uidsSinEmail.map(async (uid) => {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user) emailMap[uid] = data.user.email ?? "—"
  }))

  const enriched = pedidos.map((p: Record<string, unknown>) => ({
    ...p,
    cliente_email: p.origen === "presencial"
      ? "Venta en local"
      : (p.email as string) || emailMap[p.user_id as string] || "—",
  }))

  return ok({ pedidos: enriched, user_count: userCount })
})
