import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const { formData, total } = await req.json()
    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!

    const payment = {
      transaction_amount: Number(total),
      token: formData.token,
      description: "Casa Gioia — Pedido",
      installments: Number(formData.installments),
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer: {
        email: formData.payer.email,
        identification: formData.payer.identification,
      },
    }

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payment),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const data = await res.json()
    return new Response(
      JSON.stringify({ id: data.id, status: data.status, status_detail: data.status_detail }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
