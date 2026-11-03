# Casa Gioia — online store

**English** · [Español](README.es.md)

E-commerce site built for **Casa Gioia**, a store selling Italian design, fashion and homeware.
It includes a product catalog, user accounts, Mercado Pago payments, automated emails and an admin panel.

**Live site:** https://casa-gioia.vercel.app

![Casa Gioia home page](docs/home.jpg)

![Collection page](docs/coleccion.jpg)

## Features

**For customers**
- Catalog with collections and product pages.
- Persistent cart with home delivery or in-store pickup.
- User accounts: sign-up with email confirmation, login, password recovery and profile.
- Checkout with **Mercado Pago**, confirmed automatically by webhook.
- Order history with **shipment tracking**.
- Journal (articles), newsletter, legal pages and cookie banner.

**For the store**
- **Admin panel** for products, orders and journal articles.
- Automatic **stock** decrement once a payment is confirmed.
- **Transactional emails** (order confirmation) and **abandoned-cart reminders** sent by a scheduled job.
- **Error alerts to Discord** from the backend.

## Architecture

```
Browser (HTML/CSS/JS)  ──►  Supabase Auth + PostgreSQL
        │                          ▲
        └──►  Edge Functions (Deno/TypeScript) ──► Mercado Pago · Resend · Discord
```

- **Frontend:** framework-free HTML, CSS and JavaScript, deployed on **Vercel**.
- **Backend:** **Supabase** provides authentication and PostgreSQL. TypeScript Edge Functions (`supabase/functions/`) create payments, handle the webhook, manage products and orders, and send emails.
- **Security:** sensitive operations (payments, admin panel) always go through Edge Functions that validate the user's session. Dynamic content is escaped before it's inserted into the HTML.

## Tests

End-to-end tests with **Playwright** (Chromium and WebKit) run on **GitHub Actions** on every push. They cover the cart, checkout, admin panel access, and that Edge Functions reject requests with no session or an invalid token.

```sh
cd tests
npm install
npx playwright test
```

## Stack

JavaScript · HTML · CSS · Supabase (Auth, PostgreSQL, Edge Functions) · TypeScript/Deno · Mercado Pago · Resend · Playwright · GitHub Actions · Vercel
