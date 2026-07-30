import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// Storage con fallback: localStorage → sessionStorage → memoria
// Necesario para navegadores con Tracking Prevention (Edge, Firefox Strict)
function makeStorage() {
  const mem = {}
  const tryLocal = () => {
    try { localStorage.setItem('_cg_test', '1'); localStorage.removeItem('_cg_test'); return true } catch { return false }
  }
  const trySession = () => {
    try { sessionStorage.setItem('_cg_test', '1'); sessionStorage.removeItem('_cg_test'); return true } catch { return false }
  }
  const store = tryLocal() ? localStorage : trySession() ? sessionStorage : { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v }, removeItem: k => { delete mem[k] } }
  return store
}

export const supabase = createClient(
  'https://dzuymtiutglcyrdcxkaj.supabase.co',
  'sb_publishable_D29AA8KYQ1pz2LCcqSJUGw_OyTvLAC9',
  { auth: { storage: makeStorage(), persistSession: true, detectSessionInUrl: true } }
)
