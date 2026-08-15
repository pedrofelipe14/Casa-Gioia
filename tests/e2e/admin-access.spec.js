// El admin es la superficie más sensible del sitio (datos de clientes,
// pedidos, capacidad de borrar cosas). Estos tests verifican que sigue
// bloqueado para cualquiera que no sea admin — tanto del lado del
// navegador (redirect) como del servidor (401 en cada endpoint), que es
// donde realmente importa que esté bien.
const { test, expect } = require('@playwright/test')

const FN_URL = 'https://dzuymtiutglcyrdcxkaj.supabase.co/functions/v1'

test('sin sesión, admin.html redirige al login', async ({ page }) => {
  await page.goto('/admin.html', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
})

test('las edge functions de admin rechazan requests sin token', async ({ request }) => {
  const endpoints = [
    { url: `${FN_URL}/admin-orders`, method: 'GET' },
    { url: `${FN_URL}/admin-products`, method: 'GET' },
  ]
  for (const { url, method } of endpoints) {
    const res = await request.fetch(url, { method })
    expect(res.status(), url).toBe(401)
  }
})

test('las edge functions de admin rechazan un token inválido', async ({ request }) => {
  const res = await request.get(`${FN_URL}/admin-orders`, {
    headers: { Authorization: 'Bearer token-falso-de-prueba' },
  })
  expect(res.status()).toBe(401)
})

test('whoami nunca revela la lista de admins, solo true/false', async ({ request }) => {
  const res = await request.get(`${FN_URL}/admin-orders?scope=whoami`, {
    headers: { Authorization: 'Bearer token-falso-de-prueba' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body).toEqual({ isAdmin: false })
})

test('crear una preferencia de pago requiere sesión real', async ({ request }) => {
  const res = await request.post(`${FN_URL}/create-preference`, {
    data: { items: [] },
  })
  expect(res.status()).toBe(401)
})

test('process-payment requiere sesión real, no alcanza con la anon key', async ({ request }) => {
  const res = await request.post(`${FN_URL}/process-payment`, {
    headers: { Authorization: 'Bearer sb_publishable_D29AA8KYQ1pz2LCcqSJUGw_OyTvLAC9' },
    data: { items: [] },
  })
  expect(res.status()).toBe(401)
  const body = await res.json()
  expect(body.error).toContain('sesión')
})
