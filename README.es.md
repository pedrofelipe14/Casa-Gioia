# Casa Gioia — tienda online

[English](README.md) · **Español**

E-commerce desarrollado para **Casa Gioia**, tienda de diseño italiano, moda y hogar.
Incluye catálogo, cuentas de usuario, pagos con Mercado Pago, emails automáticos y un panel de administración.

**Sitio en vivo:** https://casa-gioia.vercel.app

![Portada de Casa Gioia](docs/home.jpg)

![Página de colección](docs/coleccion.jpg)

## Funcionalidades

**Para clientes**
- Catálogo con colecciones y páginas de producto.
- Carrito persistente con envío a domicilio o retiro.
- Cuentas de usuario: registro con confirmación por email, login, recuperación de contraseña y perfil.
- Pago con **Mercado Pago** y confirmación automática por webhook.
- Historial de pedidos con **seguimiento de envío**.
- Journal (artículos), newsletter, páginas legales y banner de cookies.

**Para la tienda**
- **Panel de administración**: productos, pedidos y artículos del journal.
- Descuento de **stock** automático al confirmarse un pago.
- **Emails transaccionales** (confirmación de pedido) y **recordatorio de carrito abandonado** con una tarea programada.
- **Alertas de errores a Discord** desde el backend.

## Arquitectura

```
Navegador (HTML/CSS/JS)  ──►  Supabase Auth + PostgreSQL
        │                            ▲
        └──►  Edge Functions (Deno/TypeScript) ──► Mercado Pago · Resend · Discord
```

- **Frontend:** HTML, CSS y JavaScript sin frameworks, desplegado en **Vercel**.
- **Backend:** **Supabase**: autenticación, PostgreSQL y Edge Functions en TypeScript (`supabase/functions/`) para crear pagos, procesar el webhook, administrar productos y pedidos, y enviar emails.
- **Seguridad:** las operaciones sensibles (pagos, panel admin) pasan siempre por Edge Functions que validan la sesión del usuario; el contenido dinámico se escapa antes de insertarse en el HTML.

## Tests

Tests end-to-end con **Playwright** (Chromium y WebKit) que corren en **GitHub Actions** en cada push:
carrito, checkout, acceso al panel de administración y que las Edge Functions rechacen pedidos sin sesión o con tokens inválidos.

```sh
cd tests
npm install
npx playwright test
```

## Stack

JavaScript · HTML · CSS · Supabase (Auth, PostgreSQL, Edge Functions) · TypeScript/Deno · Mercado Pago · Resend · Playwright · GitHub Actions · Vercel
