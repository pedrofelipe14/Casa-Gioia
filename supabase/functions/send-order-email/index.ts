import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const FROM       = Deno.env.get("EMAIL_FROM") ?? "Casa Gioia <onboarding@resend.dev>"

function deny(msg = "No autorizado") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401, headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function bad(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400, headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ))
}

function fmt(n: number) {
  return "$" + Number(n).toLocaleString("es-AR")
}

function itemsHtml(items: Array<{ nombre: string; qty: number; precio: number }>) {
  if (!items?.length) return ""
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0 8px;">
    ${items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;color:#5a5450;">${esc(i.nombre)} <span style="color:#a09890;">×${esc(i.qty)}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;color:#2F2A28;text-align:right;white-space:nowrap;">${fmt(i.precio * i.qty)}</td>
    </tr>`).join("")}
    <tr>
      <td style="padding:14px 0 0;font-size:15px;font-weight:600;color:#891A55;">Total</td>
      <td style="padding:14px 0 0;font-size:15px;font-weight:600;color:#891A55;text-align:right;"></td>
    </tr>
  </table>`
}

function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EFE5;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#2F2A28;padding:28px 40px;text-align:center;">
    <span style="color:#c9a96e;font-family:Georgia,serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;">◆ &nbsp;Casa Gioia</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:44px 40px;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#2F2A28;padding:24px 40px;text-align:center;">
    <p style="margin:0;color:rgba(244,239,229,.45);font-size:12px;font-family:Georgia,serif;line-height:1.8;">
      Casa Gioia · Alsina 3364, Mar del Plata<br>
      <a href="mailto:casagioia@gmail.com" style="color:rgba(244,239,229,.45);text-decoration:none;">casagioia@gmail.com</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

function btnLink(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#891A55;color:#ffffff;text-decoration:none;padding:13px 32px;font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:24px 0;">${label}</a>`
}

function orderBox(numero: string) {
  return `<div style="background:#F4EFE5;border-left:3px solid #891A55;padding:18px 22px;margin:24px 0;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#891A55;margin-bottom:4px;">Número de pedido</div>
    <div style="font-size:18px;color:#2F2A28;">${esc(numero)}</div>
  </div>`
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  try {
    // ── 1. Autorizar: llamada interna (service role) o usuario dueño del pedido ──
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
    if (!token) return deny()

    const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!
    const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!
    const SUPABASE_ADMIN = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    let { type, email, data } = await req.json()

    if (token === SUPABASE_ADMIN) {
      // admin-orders y mp-webhook llaman server-to-server con la service role key —
      // ya validaron el pedido y el email del lado del servidor.
    } else {
      if (token === SUPABASE_ANON) return deny("Se requiere sesión de usuario")

      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
      const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
      if (authError || !user) return deny("Sesión inválida")

      const numeroPedido = data?.numero_pedido
      if (typeof numeroPedido !== "string" || !numeroPedido) return bad("Falta numero_pedido")

      const adminClient = createClient(SUPABASE_URL, SUPABASE_ADMIN, { auth: { persistSession: false } })
      const { data: pedido } = await adminClient
        .from("pedidos")
        .select("id")
        .eq("numero_pedido", numeroPedido)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!pedido) return deny("Pedido no encontrado")

      // Ignorar el email que mande el cliente — usar el de la sesión verificada
      email = user.email
    }

    if (!RESEND_KEY) {
      console.error("RESEND_API_KEY not set")
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 200, // Don't fail the order
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    let subject = ""
    let html    = ""

    if (type === "efectivo_created") {
      subject = `Pedido ${data.numero_pedido} — Completá tu pago en efectivo`
      html = wrap(`
        <h1 style="font-size:26px;font-weight:400;color:#2F2A28;margin:0 0 12px;line-height:1.3;">Ya casi.<br>Completá tu pago.</h1>
        <p style="font-size:14px;color:#5a5450;line-height:1.8;margin:0 0 8px;">Tu pedido está reservado. Tenés <strong>3 días</strong> para pagar con el código en cualquier sucursal de <strong>Rapipago</strong> o <strong>Pago Fácil</strong>.</p>
        ${orderBox(data.numero_pedido)}
        ${itemsHtml(data.items ?? [])}
        <p style="font-size:15px;font-weight:600;color:#891A55;text-align:right;margin:0 0 8px;">Total: ${fmt(data.total)}</p>
        ${data.ticket_url ? btnLink(data.ticket_url, "Ver código de pago") : ""}
        <p style="font-size:12px;color:#a09890;margin:16px 0 0;line-height:1.7;">Una vez acreditado el pago te avisamos por email.</p>
      `)

    } else if (type === "payment_confirmed") {
      subject = `¡Pago confirmado! Pedido ${data.numero_pedido} — Casa Gioia`
      const envioInfo = data.envio?.tipo === "retiro"
        ? `<p style="font-size:14px;color:#5a5450;line-height:1.8;margin:16px 0 0;">📍 <strong>Retiro en tienda</strong><br>Alsina 3364, Mar del Plata · Te avisamos cuando esté listo.</p>`
        : `<p style="font-size:14px;color:#5a5450;line-height:1.8;margin:16px 0 0;">📦 <strong>Envío a domicilio</strong><br>${esc(data.envio?.calle)} ${esc(data.envio?.numero)}, ${esc(data.envio?.ciudad)}, ${esc(data.envio?.provincia)}</p>`
      html = wrap(`
        <h1 style="font-size:26px;font-weight:400;color:#2F2A28;margin:0 0 12px;line-height:1.3;">¡Gracias<br>por tu compra!</h1>
        <p style="font-size:14px;color:#5a5450;line-height:1.8;margin:0;">Tu pago fue confirmado. Ya estamos preparando tu pedido.</p>
        ${orderBox(data.numero_pedido)}
        ${itemsHtml(data.items ?? [])}
        <p style="font-size:15px;font-weight:600;color:#891A55;text-align:right;margin:0 0 16px;">Total: ${fmt(data.total)}</p>
        ${envioInfo}
        ${btnLink("https://casagioia.com.ar/pedidos.html", "Ver mis pedidos")}
      `)

    } else if (type === "status_update") {
      const labels: Record<string, string> = {
        confirmado: "confirmado",
        preparando: "en preparación",
        en_camino:  "en camino",
        entregado:  "entregado",
        cancelado:  "cancelado",
      }
      const label = labels[data.estado] ?? data.estado
      subject = `Tu pedido ${data.numero_pedido} está ${label} — Casa Gioia`

      const msgs: Record<string, string> = {
        confirmado: "Tu pago fue confirmado y ya estamos preparando tu pedido.",
        preparando: "Tu pedido está siendo preparado con cuidado.",
        en_camino:  "Tu pedido ya salió. ¡Pronto llega!",
        entregado:  "Tu pedido fue entregado. ¡Esperamos que lo disfrutes!",
        cancelado:  "Tu pedido fue cancelado. Si tenés dudas, escribinos.",
      }
      html = wrap(`
        <h1 style="font-size:26px;font-weight:400;color:#2F2A28;margin:0 0 12px;line-height:1.3;">Actualización<br>de tu pedido.</h1>
        <p style="font-size:14px;color:#5a5450;line-height:1.8;margin:0;">${msgs[data.estado] ?? ""}</p>
        ${orderBox(data.numero_pedido)}
        <div style="background:#F4EFE5;padding:14px 22px;margin:0 0 24px;display:inline-block;">
          <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#891A55;">Estado: </span>
          <span style="font-size:14px;color:#2F2A28;text-transform:capitalize;">${label}</span>
        </div>
        ${btnLink("https://casagioia.com.ar/pedidos.html", "Ver mis pedidos")}
      `)
    }

    if (!subject) {
      return new Response(JSON.stringify({ error: "Unknown type" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: email, subject, html }),
    })
    const result = await res.json()
    if (!res.ok) console.error("Resend error:", result)

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
