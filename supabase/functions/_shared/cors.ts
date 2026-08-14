// Headers CORS compartidos por las edge functions llamadas desde el navegador.
// Cada función pasa los métodos que expone; el resto es siempre igual.
export function corsHeaders(methods: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  }
}
