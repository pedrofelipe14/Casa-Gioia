// Funciones del carrito (localStorage), compartidas por js/script.js en
// todas las páginas. Si esto se rompe, se rompe toda la tienda.
const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('casagioia_cookie_consent', '1'))
  await page.goto('/coleccion.html', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => window.cartSave([]))
})

test('agregar un producto lo guarda en localStorage y actualiza el badge', async ({ page }) => {
  await page.evaluate(() => window.cartSave([{ id: 'p1', nombre: 'Sillón Firenze', precio: 349990, qty: 1 }]))

  const cart = await page.evaluate(() => window.cartGet())
  expect(cart).toEqual([{ id: 'p1', nombre: 'Sillón Firenze', precio: 349990, qty: 1 }])

  const badge = page.locator('.cart-badge').first()
  await expect(badge).toHaveText('1')
})

test('agregar el mismo producto dos veces incrementa la cantidad, no duplica la fila', async ({ page }) => {
  await page.evaluate(() => {
    const card = document.createElement('div')
    card.dataset.id = 'p2'
    card.dataset.nombre = 'Mesa Siena'
    card.dataset.precio = '589990'
    const btn = document.createElement('button')
    card.appendChild(btn)
    document.body.appendChild(card)
    window.cartAdd(btn)
    window.cartAdd(btn)
  })

  const cart = await page.evaluate(() => window.cartGet())
  expect(cart).toHaveLength(1)
  expect(cart[0]).toMatchObject({ id: 'p2', qty: 2 })
})

test('el badge muestra la suma de cantidades de todos los productos', async ({ page }) => {
  await page.evaluate(() => window.cartSave([
    { id: 'p1', nombre: 'A', precio: 100, qty: 2 },
    { id: 'p2', nombre: 'B', precio: 200, qty: 3 },
  ]))
  const badge = page.locator('.cart-badge').first()
  await expect(badge).toHaveText('5')
})

test('vaciar el carrito oculta el badge', async ({ page }) => {
  await page.evaluate(() => window.cartSave([{ id: 'p1', nombre: 'A', precio: 100, qty: 1 }]))
  await page.evaluate(() => window.cartSave([]))
  const badge = page.locator('.cart-badge').first()
  await expect(badge).toBeHidden()
})

test('el carrito persiste entre navegaciones (localStorage, no memoria)', async ({ page }) => {
  await page.evaluate(() => window.cartSave([{ id: 'p1', nombre: 'Sillón Firenze', precio: 349990, qty: 1 }]))
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' })
  const cart = await page.evaluate(() => window.cartGet())
  expect(cart).toHaveLength(1)
})
