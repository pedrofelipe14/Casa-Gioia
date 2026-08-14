import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
import { makeResponders } from "../_shared/responses.ts"

const CORS = corsHeaders("POST, OPTIONS")
const { deny, bad } = makeResponders(CORS)

// Mismas zonas que el cliente — fuente de verdad para el costo de envío
const CP_ZONES = [
  { min: 1000, max: 1499, precio: 4500  },
  { min: 1500, max: 1999, precio: 5200  },
  { min: 2000, max: 2999, precio: 6500  },
  { min: 3000, max: 3499, precio: 7500  },
  { min: 3500, max: 3999, precio: 9500  },
  { min: 4000, max: 4999, precio: 9000  },
  { min: 5000, max: 5999, precio: 7000  },
  { min: 6000, max: 6999, precio: 6000  },
  { min: 7000, max: 7599, precio: 5500  },
  { min: 7600, max: 7699, precio: 2500  },
  { min: 7700, max: 7999, precio: 6500  },
  { min: 8000, max: 8999, precio: 11000 },
  { min: 9000, max: 9419, precio: 14500 },
  { min: 9420, max: 9999, precio: 16000 },
]

function getShippingCost(cp: string | null): number {
  if (!cp) return 0
  const num = parseInt(cp, 10)
  if (isNaN(num)) return 0
  return CP_ZONES.find(z => num >= z.min && num <= z.max)?.precio ?? 0
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  // ── 1. Verificar sesión de usuario ──────────────────────────────────────────
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return deny()

  const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!
  const SUPABASE_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!
  const SUPABASE_ADMIN  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // No aceptar el anon key como token de usuario
  if (token === SUPABASE_ANON) return deny("Se requiere sesión de usuario")

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) return deny("Sesión inválida")

  // ── 2. Parsear y validar el body ────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return bad("Body inválido") }

  const { formData, items, cpEnvio, selectedPaymentMethod } = body as {
    formData:              Record<string, unknown>
    items:                 Array<{ id: string; qty: number }>
    cpEnvio:               string | null
    selectedPaymentMethod: string
  }

  if (!Array.isArray(items) || items.length === 0)         return bad("Sin productos")
  if (items.some(i => typeof i.id !== "string" || !i.id))  return bad("IDs de productos inválidos")
  if (items.some(i => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99)) return bad("Cantidades inválidas")

  // ── 3. Calcular total server-side consultando precios autoritativos ──────────
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ADMIN, { auth: { persistSession: false } })
  const productIds = items.map(i => i.id)

  const { data: productos, error: dbError } = await adminClient
    .from("productos")
    .select("id, precio, stock")
    .in("id", productIds)

  if (dbError || !productos?.length) {
    console.error("productos fetch error:", dbError)
    return bad("Productos no encontrados")
  }

  let productTotal = 0
  for (const item of items) {
    const producto = productos.find((p: { id: string; precio: number; stock: number | null }) => p.id === item.id)
    if (!producto) return bad(`Producto desconocido: ${item.id}`)
    if (producto.stock !== null && producto.stock < item.qty) {
      return bad(`Stock insuficiente para uno de los productos`)
    }
    productTotal += producto.precio * item.qty
  }

  const shippingCost = getShippingCost(cpEnvio ?? null)
  const total = productTotal + shippingCost  // total calculado en el servidor

  if (total < 100) return bad("Monto inválido")

  // ── 4. Procesar pago con MercadoPago ────────────────────────────────────────
  const ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!
  const isCard = selectedPaymentMethod === "credit_card" || selectedPaymentMethod === "debit_card"

  const payment: Record<string, unknown> = {
    transaction_amount: total,
    description: "Casa Gioia — Pedido",
    payment_method_id: formData.payment_method_id,
    payer: {
      email: formData.payer && (formData.payer as Record<string,unknown>).email,
      ...((formData.payer as Record<string,unknown>)?.identification && {
        identification: (formData.payer as Record<string,unknown>).identification,
      }),
      ...((formData.payer as Record<string,unknown>)?.first_name && {
        first_name: (formData.payer as Record<string,unknown>).first_name,
        last_name:  (formData.payer as Record<string,unknown>).last_name,
      }),
    },
  }

  if (isCard && formData.token) {
    payment.token        = formData.token
    payment.installments = Number(formData.installments) || 1
    if (formData.issuer_id) payment.issuer_id = formData.issuer_id
  }

  if (!isCard) {
    const exp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const y = exp.getUTCFullYear()
    const m = String(exp.getUTCMonth() + 1).padStart(2, "0")
    const d = String(exp.getUTCDate()).padStart(2, "0")
    payment.date_of_expiration = `${y}-${m}-${d}T23:59:59.000-03:00`
  }

  try {
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
      console.error("MP API error", res.status, err)
      return new Response(JSON.stringify({ error: "Error procesando el pago" }), {
        status: res.status, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const data = await res.json()

    // Descontar stock si el pago fue aprobado
    if (data.status === "approved") {
      for (const item of items) {
        const producto = productos.find((p: { id: string; precio: number; stock: number | null }) => p.id === item.id)
        if (producto?.stock !== null && producto?.stock !== undefined) {
          await adminClient
            .from("productos")
            .update({ stock: Math.max(0, producto.stock - item.qty) })
            .eq("id", item.id)
        }
      }
    }

    return new Response(JSON.stringify({
      id:            data.id,
      status:        data.status,
      status_detail: data.status_detail,
      ticket_url:    data.transaction_details?.external_resource_url ?? null,
      total,
    }), { headers: { ...CORS, "Content-Type": "application/json" } })

  } catch (e: unknown) {
    console.error("process-payment exception:", e)
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
