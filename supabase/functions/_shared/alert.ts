// Avisa a un canal de Discord cuando pasa algo que realmente rompió un
// flujo (no un error de validación de usuario — esos son normales). Si
// DISCORD_WEBHOOK_URL no está configurado, no hace nada — nunca bloquea
// ni hace fallar el flujo real (pago, pedido, email) por un problema de
// notificación.
export async function notifyError(context: string, detail: unknown) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL")
  if (!webhookUrl) return

  const message = detail instanceof Error ? detail.message : JSON.stringify(detail)

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🔴 **Casa Gioia — error en \`${context}\`**\n\`\`\`${String(message).slice(0, 1500)}\`\`\``,
      }),
    })
  } catch {
    // No hay mucho más que hacer si falla la notificación en sí.
  }
}
