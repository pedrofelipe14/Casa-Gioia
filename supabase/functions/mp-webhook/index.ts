import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

async function verifyMPSignature(req: Request, bodyText: string): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET")
  if (!secret) {
    // Si no está configurado el secret, logueamos pero no bloqueamos
    // (para no romper en entornos sin el secret)
    console.warn("MP_WEBHOOK_SECRET no configurado — verificación de firma omitida")
    return true
  }

  const signature  = req.headers.get("x-signature") ?? ""
  const requestId  = req.headers.get("x-request-id") ?? ""

  // Formato: "ts=<timestamp>,v1=<hash>"
  const parts = Object.fromEntries(signature.split(",").map(p => p.split("=")))
  const ts = parts["ts"] ?? ""
  const v1 = parts["v1"] ?? ""
  if (!ts || !v1) return false

  // MercadoPago firma el manifest: "id:{data.id};request-id:{requestId};ts:{ts};"
  let dataId = ""
  try {
    const parsed = JSON.parse(bodyText)
    dataId = String(parsed?.data?.id ?? "")
  } catch { return false }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sigBytes  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest))
  const expected  = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, "0")).join("")

  return expected === v1
}

serve(async (req) => {
  const bodyText = await req.text()

  try {
    // ── 1. Verificar firma de MercadoPago ────────────────────────────────────
    if (!await verifyMPSignature(req, bodyText)) {
      console.error("mp-webhook: firma inválida")
      return new Response("ok", { status: 200 }) // siempre 200 a MP
    }

    const body = JSON.parse(bodyText)

    if (body.type !== "payment" || !body.data?.id) {
      return new Response("ok", { status: 200 })
    }

    const paymentId   = String(body.data.id)
    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!

    // ── 2. Verificar el pago directamente con MP (no confiar en el body) ─────
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    })
    if (!mpRes.ok) return new Response("ok", { status: 200 })

    const payment = await mpRes.json()
    if (payment.status !== "approved") return new Response("ok", { status: 200 })

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    )

    // ── 3. Buscar pedido y actualizar estado ──────────────────────────────────
    const { data: pedido } = await admin
      .from("pedidos")
      .select("*")
      .eq("mp_payment_id", paymentId)
      .maybeSingle()

    if (!pedido || pedido.estado !== "pendiente") return new Response("ok", { status: 200 })

    await admin.from("pedidos").update({ estado: "confirmado" }).eq("id", pedido.id)

    // ── 4. Enviar email de confirmación ───────────────────────────────────────
    // pedido.email cubre cuentas registradas e invitados (sesion anonima) por
    // igual; auth.users solo tiene email para las primeras.
    let userEmail: string | null = pedido.email ?? null
    if (!userEmail) {
      const { data: userData } = await admin.auth.admin.getUserById(pedido.user_id)
      userEmail = userData?.user?.email ?? null
    }
    if (userEmail) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        },
        body: JSON.stringify({
          type: "payment_confirmed",
          email: userEmail,
          data: {
            numero_pedido: pedido.numero_pedido,
            total:         pedido.total,
            items:         pedido.items ?? [],
            envio:         pedido.envio ?? {},
          },
        }),
      })
    }

    return new Response("ok", { status: 200 })
  } catch (e) {
    console.error("mp-webhook error:", e)
    return new Response("ok", { status: 200 }) // siempre 200 a MP
  }
})
