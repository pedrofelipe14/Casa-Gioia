import { notifyError } from "./alert.ts"

// Respuestas JSON estándar para las edge functions. Cada función arma sus
// propios helpers con makeResponders(CORS, "nombre-funcion") para no repetir
// el shape de { error } + status + headers en cada endpoint. serverError()
// además avisa por Discord (si está configurado) — es la señal de que algo
// rompió de verdad, no un error de validación del usuario.
export function makeResponders(CORS: Record<string, string>, fnName = "") {
  const json = (data: unknown, status: number) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } })

  return {
    ok:   (data: unknown = { ok: true }) => json(data, 200),
    deny: (msg = "No autorizado") => json({ error: msg }, 401),
    bad:  (msg: string) => json({ error: msg }, 400),
    serverError: (detail?: unknown) => {
      notifyError(fnName, detail ?? "Error interno").catch(() => {})
      return json({ error: "Error interno" }, 500)
    },
  }
}
