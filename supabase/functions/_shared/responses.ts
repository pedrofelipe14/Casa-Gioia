// Respuestas JSON estándar para las edge functions. Cada función arma sus
// propios helpers con makeResponders(CORS) para no repetir el shape de
// { error } + status + headers en cada endpoint.
export function makeResponders(CORS: Record<string, string>) {
  const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } })

  return {
    ok:          (data: unknown = { ok: true }) => json(data, 200),
    deny:        (msg = "No autorizado") => json({ error: msg }, 401),
    bad:         (msg: string) => json({ error: msg }, 400),
    serverError: () => json({ error: "Error interno" }, 500),
  }
}
