// Lógica del checkout que no depende de completar un pago real (eso no se
// puede automatizar: Cloudflare Turnstile rechaza navegadores headless a
// propósito). Lo que sí se puede — y vale la pena — probar es todo lo que
// pasa ANTES de tocar Turnstile: validación de email, toggle de tipo de
// envío, cálculo del resumen. Ahí fue donde se coló el bug de la regex
// de email débil que dejaba pasar HTML.
const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('casagioia_cookie_consent', '1'))
  await page.goto('/carrito.html', { waitUntil: 'domcontentloaded' })
  // Salteamos el paso "carrito → envío" (que requiere Turnstile para
  // invitados) mostrando la sección directamente, como si ya se hubiera
  // pasado ese paso. Es la misma sección que ve cualquier usuario logueado.
  await page.evaluate(() => {
    document.getElementById('shipping-section').style.display = 'block'
  })
})

test('el toggle de tipo de envío cambia la clase activa', async ({ page }) => {
  const retiro = page.locator('#btnRetiro')
  const envio  = page.locator('#btnEnvio')

  await expect(retiro).toHaveClass(/active-retiro/)
  await expect(envio).not.toHaveClass(/active-envio/)

  await envio.click()
  await expect(envio).toHaveClass(/active-envio/)
  await expect(retiro).not.toHaveClass(/active-retiro/)
})

test('el formulario de dirección aparece solo con "envío a domicilio"', async ({ page }) => {
  await expect(page.locator('#envio-form')).toBeHidden()
  await page.locator('#btnEnvio').click()
  await expect(page.locator('#envio-form')).toBeVisible()
})

test.describe('validación de email de contacto', () => {
  const casosInvalidos = [
    '<img src=x onerror=alert(1)>@a.com',
    'sin-arroba.com',
    'con espacio@a.com',
    'a"b@a.com',
  ]

  for (const email of casosInvalidos) {
    test(`rechaza "${email}"`, async ({ page }) => {
      await page.fill('#s-email', email)
      await page.click('#continuePayBtn')
      await expect(page.locator('#shipping-error')).toBeVisible()
    })
  }

  test('acepta un email real', async ({ page }) => {
    await page.fill('#s-email', 'cliente@gmail.com')
    await page.click('#continuePayBtn')
    // Con "retiro" (modo por defecto) no hace falta más que el email
    // válido para avanzar — si la validación fallara, el error quedaría
    // visible en vez de pasar al paso de pago.
    await expect(page.locator('#shipping-error')).toBeHidden()
  })
})

test('el resumen del carrito muestra el total correcto', async ({ page }) => {
  await page.goto('/coleccion.html', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.cartSave([
    { id: 'p1', nombre: 'Sillón Firenze', precio: 100000, qty: 2 },
    { id: 'p2', nombre: 'Mesa Siena', precio: 50000, qty: 1 },
  ]))
  await page.goto('/carrito.html', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#carrito-total')).toHaveText('$250.000')
})
