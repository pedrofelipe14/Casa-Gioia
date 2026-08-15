import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAdminClient } from "../_shared/supabase.ts"
import { notifyError } from "../_shared/alert.ts"

// No la llama el navegador — la dispara pg_cron una vez por hora. Por eso
// el único "auth" que necesita es la service role key en el header, que
// solo puede poner quien programa el cron job (nadie del lado del cliente).
function verifyInternal(req: Request): boolean {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  return !!token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
}

const VENTANA_HORAS = 24

serve(async (req) => {
  if (!verifyInternal(req)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 })
  }

  const admin = getAdminClient()

  try {
    const corte = new Date(Date.now() - VENTANA_HORAS * 60 * 60 * 1000).toISOString()

    // Carritos que cruzaron las 24hs sin actividad y todavía no recibieron
    // el recordatorio. La ventana de abajo (48hs) evita que el cron siga
    // revisando carritos viejísimos para siempre.
    const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: carritos, error } = await admin
      .from("carritos")
      .select("*")
      .eq("recordatorio_enviado", false)
      .lte("updated_at", corte)
      .gte("updated_at", hace48h)

    if (error) {
      notifyError("abandoned-cart-reminder/fetch", error).catch(() => {})
      return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 })
    }
    if (!carritos?.length) return new Response(JSON.stringify({ enviados: 0 }), { status: 200 })

    const uids = [...new Set(carritos.map((c) => c.user_id as string))]

    // Descartar los que ya compraron desde que tocaron el carrito por
    // última vez — no tiene sentido "recordarles" algo que ya compraron.
    const { data: pedidosUsuarios } = await admin
      .from("pedidos")
      .select("user_id, created_at")
      .in("user_id", uids)
    const lastPurchaseMap: Record<string, string> = {}
    for (const p of pedidosUsuarios ?? []) {
      const prev = lastPurchaseMap[p.user_id as string]
      if (!prev || (p.created_at as string) > prev) lastPurchaseMap[p.user_id as string] = p.created_at as string
    }

    let enviados = 0
    for (const carrito of carritos) {
      const lastPurchase = lastPurchaseMap[carrito.user_id as string]
      const yaConvertido = lastPurchase && lastPurchase > (carrito.updated_at as string)

      if (yaConvertido) {
        // No le mandamos nada, pero igual lo marcamos para no re-evaluarlo
        // cada hora — ya está resuelto (compró).
        await admin.from("carritos").update({ recordatorio_enviado: true }).eq("id", carrito.id)
        continue
      }

      // Solo cuentas registradas tienen email — las sesiones anónimas de
      // invitados que abandonaron antes de llegar al checkout no tienen
      // ningún email asociado, no hay a quién escribirle.
      const { data: userData } = await admin.auth.admin.getUserById(carrito.user_id as string)
      const email = userData?.user?.email
      const items = Array.isArray(carrito.items) ? carrito.items : []

      if (email && items.length) {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({ type: "carrito_abandonado", email, data: { items } }),
        })
        if (res.ok) enviados++
        else notifyError("abandoned-cart-reminder/send-order-email", await res.text()).catch(() => {})
      }

      await admin.from("carritos").update({ recordatorio_enviado: true }).eq("id", carrito.id)
    }

    return new Response(JSON.stringify({ enviados, revisados: carritos.length }), { status: 200 })
  } catch (e: unknown) {
    notifyError("abandoned-cart-reminder", e).catch(() => {})
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 })
  }
})
