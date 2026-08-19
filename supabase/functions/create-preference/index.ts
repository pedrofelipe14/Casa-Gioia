import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
import { makeResponders } from "../_shared/responses.ts"
import { notifyError } from "../_shared/alert.ts"

const CORS = corsHeaders("POST, OPTIONS")
const { ok, deny, bad } = makeResponders(CORS, "create-preference")

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    // ── 1. Verificar sesión de usuario ──────────────────────────────────────
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
    if (!token) return deny()

    const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!
    const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!
    const SUPABASE_ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    // No aceptar el anon key como token de usuario
    if (token === SUPABASE_ANON) return deny("Se requiere sesión de usuario")

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) return deny("Sesión inválida")

    // ── 2. Parsear y validar el body ────────────────────────────────────────
    const { items, origin } = await req.json()
    if (!Array.isArray(items) || items.length === 0)        return bad("Sin productos")
    if (items.some((i: { id: unknown }) => typeof i.id !== "string" || !i.id)) return bad("IDs de productos inválidos")
    if (items.some((i: { qty: unknown }) => !Number.isInteger(i.qty) || (i.qty as number) < 1 || (i.qty as number) > 99)) {
      return bad("Cantidades inválidas")
    }

    // ── 3. Recalcular precios server-side contra la tabla productos ──────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_ADMIN, { auth: { persistSession: false } })
    const productIds = (items as Array<{ id: string }>).map(i => i.id)

    const { data: productos, error: dbError } = await adminClient
      .from("productos")
      .select("id, nombre, precio")
      .in("id", productIds)

    if (dbError || !productos?.length) return bad("Productos no encontrados")

    const preferenceItems: Array<{ id: string; title: string; quantity: number; unit_price: number; currency_id: string }> = []
    for (const item of items as Array<{ id: string; qty: number }>) {
      const producto = productos.find((p: { id: string; nombre: string; precio: number }) => p.id === item.id)
      if (!producto) return bad(`Producto desconocido: ${item.id}`)
      preferenceItems.push({
        id:          String(producto.id),
        title:       String(producto.nombre),
        quantity:    Number(item.qty),
        unit_price:  Number(producto.precio),
        currency_id: "ARS",
      })
    }

    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!
    const base = origin ?? "http://127.0.0.1:5500"

    const preference = {
      items: preferenceItems,
      back_urls: {
        success: `${base}/pago-exitoso`,
        failure: `${base}/pago-fallido`,
        pending: `${base}/pago-exitoso`,
      },
      auto_return: "approved",
      statement_descriptor: "Casa Gioia",
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
    }

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(preference),
    })

    if (!res.ok) {
      const err = await res.text()
      notifyError("create-preference/mercadopago", err).catch(() => {})
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const { id } = await res.json()
    return ok({ id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    notifyError("create-preference", e).catch(() => {})
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
