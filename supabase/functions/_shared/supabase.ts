import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Cliente con service role: bypassea RLS, solo para uso server-side después
// de haber verificado autorización (usuario dueño del recurso, o admin).
export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  )
}

// Cliente con anon key: para validar el JWT de quien llama via auth.getUser(token).
export function getAnonClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } }
  )
}

// Verifica que el token pertenezca a alguno de los admins configurados en
// ADMIN_EMAILS (secret, separado por comas). Mantiene ADMIN_EMAIL (singular)
// como fallback por compatibilidad.
export async function verifyAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim()
  if (!token) return false

  const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? Deno.env.get("ADMIN_EMAIL") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!adminEmails.length) return false

  const client = getAnonClient()
  const { data: { user }, error } = await client.auth.getUser(token)
  return !error && !!user?.email && adminEmails.includes(user.email.toLowerCase())
}
