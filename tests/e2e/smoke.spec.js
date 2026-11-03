// Chequeo básico: cada página carga sin errores de JS. Esto es lo que
// hubiera agarrado el bug de pedidos.html (Cannot read properties of null)
// antes de que llegara a producción.
const { test, expect } = require('@playwright/test')

// El widget de Cloudflare Turnstile no puede resolverse en localhost (el
// dominio no está en la lista blanca, y encima local es http mientras que
// el iframe de Turnstile es https) — es ruido conocido de este entorno de
// test, no un bug real del sitio. Se filtra explícitamente en vez de
// ignorarlo a ciegas.
// "ResizeObserver loop completed with undelivered notifications" es un aviso
// benigno del navegador (aparece en el viewport mobile cuando un layout se
// reacomoda dentro del mismo frame): no rompe nada ni lo genera nuestro código.
const KNOWN_NOISE = /Cloudflare Turnstile|challenges\.cloudflare\.com|ResizeObserver loop/

const PAGES = [
  '404.html', 'auth.html', 'coleccion.html', 'contacto.html',
  'email-confirmado.html', 'index.html', 'interiorismo.html', 'novita.html',
  'login.html', 'storia.html', 'pago-exitoso.html', 'pago-fallido.html',
  'pedidos.html', 'perfil.html', 'politicas-de-privacidad.html',
  'reset-password.html', 'terminos-y-condiciones.html', 'carrito.html',
]

for (const page of PAGES) {
  test(`${page} carga sin errores de JS`, async ({ page: p }) => {
    const errors = []
    p.on('pageerror', (e) => {
      if (!KNOWN_NOISE.test(e.message)) errors.push(e.message)
    })
    await p.addInitScript(() => localStorage.setItem('casagioia_cookie_consent', '1'))
    await p.goto(`/${page}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(800)
    expect(errors, `Errores inesperados en ${page}: ${errors.join(', ')}`).toEqual([])
  })
}

test('el banner de cookies aparece una vez y no vuelve a mostrarse', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cookie-banner')).toBeVisible({ timeout: 5000 })

  await page.click('#cookieAcceptBtn')
  await expect(page.locator('.cookie-banner')).toBeHidden()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.cookie-banner')).toHaveCount(0)
})

test('la página 404 muestra el mensaje esperado', async ({ page }) => {
  // Nota: esto solo verifica el archivo 404.html en sí — el rewrite real
  // de Vercel para rutas rotas no se puede probar contra el server local.
  await page.goto('/404.html', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.result-code')).toContainText('404')
})
