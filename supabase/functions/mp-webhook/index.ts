import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const body = await req.json()

    // MP sends type:"payment" for payment events
    if (body.type !== "payment" || !body.data?.id) {
      return new Response("ok", { status: 200 })
    }

    const paymentId   = String(body.data.id)
    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!

    // Fetch full payment from MP
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

    // Find order by mp_payment_id
    const { data: pedido } = await admin
      .from("pedidos")
      .select("*")
      .eq("mp_payment_id", paymentId)
      .maybeSingle()

    if (!pedido) return new Response("ok", { status: 200 })

    // Only update if still pending (avoid double processing)
    if (pedido.estado !== "pendiente") return new Response("ok", { status: 200 })

    await admin.from("pedidos").update({ estado: "confirmado" }).eq("id", pedido.id)

    // Get user email
    const { data: userData } = await admin.auth.admin.getUserById(pedido.user_id)
    const userEmail = userData?.user?.email
    if (!userEmail) return new Response("ok", { status: 200 })

    // Send confirmation email
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
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

    return new Response("ok", { status: 200 })
  } catch (e) {
    console.error("mp-webhook error:", e)
    return new Response("ok", { status: 200 }) // Always 200 to MP
  }
})
