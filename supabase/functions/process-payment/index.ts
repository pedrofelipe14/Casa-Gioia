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
    const { formData, total, selectedPaymentMethod } = await req.json()
    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!

    const isCard = selectedPaymentMethod === "credit_card" || selectedPaymentMethod === "debit_card"

    // Base payment object
    const payment: Record<string, unknown> = {
      transaction_amount: Number(total),
      description: "Casa Gioia — Pedido",
      payment_method_id: formData.payment_method_id,
      payer: {
        email: formData.payer?.email,
        ...(formData.payer?.identification && { identification: formData.payer.identification }),
        ...(formData.payer?.first_name && { first_name: formData.payer.first_name }),
        ...(formData.payer?.last_name  && { last_name:  formData.payer.last_name }),
      },
    }

    // Card-only fields
    if (isCard && formData.token) {
      payment.token        = formData.token
      payment.installments = Number(formData.installments) || 1
      if (formData.issuer_id) payment.issuer_id = formData.issuer_id
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
      JSON.stringify({
        id:           data.id,
        status:       data.status,
        status_detail: data.status_detail,
        ticket_url:   data.transaction_details?.external_resource_url ?? null,
      }),
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
