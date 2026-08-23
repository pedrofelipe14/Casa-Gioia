// Avisa a un canal de Discord cuando pasa algo que realmente rompió un
// flujo (no un error de validación de usuario — esos son normales). Si
// DISCORD_WEBHOOK_URL no está configurado, no hace nada — nunca bloquea
// ni hace fallar el flujo real (pago, pedido, email) por un problema de
// notificación.
export async function notifyError(context: string, detail: unknown, extra?: Record<string, unknown>) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL")
  if (!webhookUrl) return

  const message = detail instanceof Error
    ? `${detail.message}\n${detail.stack ?? ""}`
    : JSON.stringify(detail, null, 2)

  const extraLines = extra
    ? Object.entries(extra).map(([k, v]) => `**${k}:** \`${String(v).slice(0, 300)}\``).join("\n")
    : ""

  const body = [
    `🔴 **Casa Gioia — error en \`${context}\`**`,
    extraLines,
    `\`\`\`${String(message).slice(0, 1200)}\`\`\``,
  ].filter(Boolean).join("\n")

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: body }),
    })
  } catch {
    // No hay mucho más que hacer si falla la notificación en sí.
  }
}
