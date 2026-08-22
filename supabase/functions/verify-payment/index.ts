import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': 'https://casagioia.com.ar',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Verificar que el usuario está autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: CORS })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: CORS })

    const { payment_id, items, envio, email } = await req.json()
    if (!payment_id || !items?.length) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), { status: 400, headers: CORS })
    }

    // Verificar el pago con MercadoPago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` }
    })
    if (!mpRes.ok) return new Response(JSON.stringify({ error: 'No se pudo verificar el pago' }), { status: 502, headers: CORS })

    const mp = await mpRes.json()

    if (mp.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Pago no aprobado', mp_status: mp.status }), { status: 402, headers: CORS })
    }

    // Verificar que el monto coincide (tolerancia de $1 por redondeos)
    const total = items.reduce((s: number, i: { precio: number; qty: number }) => s + i.precio * i.qty, 0)
    if (Math.abs(mp.transaction_amount - total) > 1) {
      return new Response(JSON.stringify({ error: 'Monto no coincide' }), { status: 422, headers: CORS })
    }

    // Evitar pedidos duplicados para el mismo payment_id
    const { data: existing } = await supabase
      .from('pedidos')
      .select('id')
      .eq('mp_payment_id', String(payment_id))
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers: CORS })
    }

    // Guardar el pedido
    const numero = 'CG' + Date.now().toString(36).toUpperCase()
    const { error: insertErr } = await supabase.from('pedidos').insert({
      user_id:       user.id,
      numero_pedido: numero,
      total,
      estado:        'confirmado',
      mp_payment_id: String(payment_id),
      items,
      envio:         envio ?? {},
      email:         email ?? null,
    })
    if (insertErr) throw insertErr

    // Email de confirmación
    if (email) {
      await supabase.functions.invoke('send-order-email', {
        body: { type: 'payment_confirmed', email, data: { numero_pedido: numero, total, items, envio: envio ?? {} } }
      })
    }

    return new Response(JSON.stringify({ ok: true, numero_pedido: numero }), { headers: CORS })

  } catch (err) {
    console.error('verify-payment error:', err)
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: CORS })
  }
})
