import { supabase } from './supabase-client.js'

;(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  async function syncCart() {
    const items = window.cartGet()
    if (!items.length) {
      await supabase.from('carritos').delete().eq('user_id', user.id)
    } else {
      await supabase.from('carritos').upsert(
        { user_id: user.id, items, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }
  }

  window._cartSyncFn = syncCart
  syncCart()
})()
