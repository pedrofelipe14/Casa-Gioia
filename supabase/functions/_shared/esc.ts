// Escapa HTML para interpolar datos que puede haber tipeado un cliente
// (nombre, dirección, etc) dentro de un template de email sin arriesgar
// que se inyecte una etiqueta.
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ))
}
