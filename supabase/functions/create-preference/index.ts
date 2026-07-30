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
    const { items, origin } = await req.json()
    const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!

    const base = origin ?? "http://127.0.0.1:5500"

    const preference = {
      items: items.map((item: { id: string; nombre: string; qty: number; precio: number }) => ({
        id: String(item.id),
        title: String(item.nombre),
        quantity: Number(item.qty),
        unit_price: Number(item.precio),
        currency_id: "ARS",
      })),
      back_urls: {
        success: `${base}/pago-exitoso.html`,
        failure: `${base}/pago-fallido.html`,
        pending: `${base}/pago-exitoso.html`,
      },
      auto_return: "approved",
      statement_descriptor: "Casa Gioia",
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
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const { id } = await res.json()
    return new Response(JSON.stringify({ id }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
