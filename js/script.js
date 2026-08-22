/* ── Aviso de seguridad en consola ── */
console.log('%c¡Alto!', 'color:#891A55;font-size:2rem;font-weight:bold;')
console.log('%cSi alguien te pidió que copies o pegues algo aquí, es un intento de robo de cuenta.\nCerrá esta ventana inmediatamente.', 'color:#2F2A28;font-size:14px;line-height:1.8;')

window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

/* ── Prefetch al hacer hover en links internos ── */
;(function(){
  const seen = new Set()
  document.addEventListener('mouseover', function(e) {
    const a = e.target.closest('a[href]')
    if (!a || seen.has(a.href)) return
    const url = a.href
    if (!url || url.startsWith('mailto:') || url.startsWith('tel:') || a.target === '_blank') return
    try { if (new URL(url).origin !== location.origin) return } catch(e) { return }
    seen.add(url)
    const l = document.createElement('link'); l.rel = 'prefetch'; l.href = url
    document.head.appendChild(l)
  })
})()

/* ── Cart: helpers globales ── */
const _CART_KEY = 'casagioia_cart'
window.cartGet  = () => JSON.parse(localStorage.getItem(_CART_KEY) || '[]')
window.cartSave = (items) => { localStorage.setItem(_CART_KEY, JSON.stringify(items)); _cartBadge(); window._cartSyncFn?.() }
function _cartBadge() {
    const n = window.cartGet().reduce((s, i) => s + i.qty, 0)
    document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = n || ''; b.style.display = n > 0 ? 'flex' : 'none'
    })
}
window.cartAdd = (btn) => {
    const card = btn.closest('[data-id]'), items = window.cartGet()
    const ex = items.find(i => i.id === card.dataset.id)
    if (ex) { ex.qty++ } else { items.push({ id: card.dataset.id, nombre: card.dataset.nombre, precio: Number(card.dataset.precio), qty: 1 }) }
    window.cartSave(items)
    btn.textContent = '✓ Agregado'; btn.disabled = true
    setTimeout(() => { btn.textContent = '+ Agregar'; btn.disabled = false }, 1500)
}

/* ── Auth button: sessionStorage para render instantáneo ── */
window.renderAccountBtn = (btn, user) => {
    if (user?.is_anonymous) user = null
    if (!user) {
        sessionStorage.removeItem('cg_auth')
        btn.classList.remove('btn-nav-logged')
        btn.innerHTML = 'Ingresar'
        btn.onclick = () => { window.location.href = 'login' }
        btn.style.opacity = '1'
        return
    }
    const nombre  = user.user_metadata?.full_name || user.user_metadata?.name || user.email
    const primero = nombre.split(' ')[0]
    const avatar  = user.user_metadata?.avatar_url || null
    sessionStorage.setItem('cg_auth', JSON.stringify({ primero, avatar }))
    _renderLoggedBtn(btn, primero, avatar)
}
function _renderLoggedBtn(btn, primero, avatar) {
    btn.classList.add('btn-nav-logged')
    btn.innerHTML = `<span class="btn-nav-full">👤 ${primero}</span><span class="btn-nav-avatar">${avatar ? `<img src="${avatar}" alt="${primero}">` : `<span class="btn-nav-initial">${primero.charAt(0).toUpperCase()}</span>`}</span>`
    btn.onclick = () => { window.location.href = 'perfil' }
    btn.style.opacity = '1'
}

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
}

/* ════════════════════════════════════════════════════════════════════
   INICIO: corre una sola vez al cargar la página (setup persistente)
════════════════════════════════════════════════════════════════════ */
function _initOnce() {
    /* ── Inyectar carrito + pre-renderizar auth (header es permanente) ── */
    const nav = document.getElementById('navbar')
    if (nav && !nav.querySelector('.navbar-actions')) {
        const userBtnEl = nav.querySelector('#userBtn')
        if (userBtnEl) {
            const cartBtn = document.createElement('button')
            cartBtn.className = 'cart-btn'; cartBtn.id = 'cartBtn'
            cartBtn.setAttribute('aria-label', 'Ver carrito')
            cartBtn.onclick = () => { window.location.href = 'carrito' }
            cartBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="cart-badge"></span>`
            const wrap = document.createElement('div'); wrap.className = 'navbar-actions'
            nav.insertBefore(wrap, userBtnEl); wrap.appendChild(cartBtn); wrap.appendChild(userBtnEl)
        }
    }
    /* Auth desde sessionStorage */
    try {
        const u = JSON.parse(sessionStorage.getItem('cg_auth') || 'null')
        if (u?.primero) {
            const btn = document.getElementById('userBtn')
            if (btn) _renderLoggedBtn(btn, u.primero, u.avatar)
        }
    } catch(e) {}

    /* ── Navbar scroll ── */
    const navbar = document.getElementById('navbar')
    let _ticking = false
    window.addEventListener('scroll', () => {
        if (_ticking) return; _ticking = true
        requestAnimationFrame(() => {
            navbar?.classList.toggle('scrolled', window.scrollY > 40)
            _ticking = false
        })
    }, { passive: true })

    /* ── Header height CSS var ── */
    const header = document.querySelector('header')
    if (header) {
        const setH = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px')
        setH()
        ;(window.ResizeObserver ? new ResizeObserver(setH).observe(header) : window.addEventListener('resize', setH))
    }

    /* ── Mobile toggle ── */
    const mobileToggle = document.getElementById('mobileToggle')
    const menu = document.getElementById('menu')
    mobileToggle?.addEventListener('click', () => menu?.classList.toggle('active'))

    /* ── Mobile submenu ── */
    document.querySelectorAll('.has-submenu > a').forEach(link => {
        link.addEventListener('click', e => {
            if (window.innerWidth <= 1200) { e.preventDefault(); link.closest('.has-submenu').classList.toggle('submenu-open') }
        })
    })

    /* ── Submenu buttons → filtro en coleccion ── */
    document.querySelectorAll('.submenu-btn').forEach(btn => {
        btn.addEventListener('click', () => { window.location.href = `coleccion?filter=${btn.textContent.trim().toLowerCase()}` })
    })

    /* ── WhatsApp float ── */
    if (!document.querySelector('.whatsapp-float')) {
        const link = document.createElement('a')
        link.className = 'whatsapp-float'; link.id = 'whatsappFloat'
        link.href = `https://wa.me/5491155806377?text=${encodeURIComponent('¡Hola! Tengo una consulta sobre Casa Gioia.')}`
        link.target = '_blank'; link.rel = 'noopener'; link.setAttribute('aria-label', 'Hablar por WhatsApp')
        link.setAttribute('data-turbo-permanent', ''); link.setAttribute('id', 'whatsappFloat')
        link.innerHTML = `<svg viewBox="0 0 32 32" fill="white"><path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.31.65 4.47 1.78 6.31L4 29l7.86-1.75A11.9 11.9 0 0 0 16.004 27C22.63 27 28 21.63 28 15S22.63 3 16.004 3zm0 21.7c-1.95 0-3.77-.55-5.32-1.5l-.38-.23-4.66 1.04 1-4.55-.25-.4A9.63 9.63 0 0 1 5.3 15c0-5.9 4.8-10.7 10.7-10.7S26.7 9.1 26.7 15 21.9 24.7 16.004 24.7zm5.87-8.02c-.32-.16-1.9-.94-2.19-1.05-.29-.1-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.6-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.75-.99-2.4-.26-.62-.53-.54-.72-.55h-.62c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.23 3.4 5.4 4.77.75.32 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.9-.78 2.16-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37z"/></svg>`
        document.body.appendChild(link)
    }

    /* ── Cookie banner ── */
    const _CK = 'casagioia_cookie_consent'
    if (!localStorage.getItem(_CK) && !document.querySelector('.cookie-banner')) {
        const bar = document.createElement('div'); bar.className = 'cookie-banner'; bar.id = 'cookieBanner'
        bar.setAttribute('data-turbo-permanent', '')
        bar.innerHTML = `<p>Usamos cookies propias y de terceros para que el sitio funcione y para mejorar tu experiencia de compra. Podés ver más en nuestras <a href="politicas-de-privacidad">Políticas de privacidad</a>.</p><button class="btn-primary" id="cookieAcceptBtn">Aceptar</button>`
        document.body.appendChild(bar)
        requestAnimationFrame(() => bar.classList.add('visible'))
        document.getElementById('cookieAcceptBtn')?.addEventListener('click', () => {
            localStorage.setItem(_CK, '1'); bar.classList.remove('visible'); setTimeout(() => bar.remove(), 400)
        })
    }
}

/* ════════════════════════════════════════════════════════════════════
   POR PÁGINA: corre en cada navegación (contenido del body cambia)
════════════════════════════════════════════════════════════════════ */
function _initPage() {
    /* ── Lenis smooth scroll ── */
    if (window._lenis) { window._lenis.destroy(); window._lenis = null }
    if (window.Lenis) { window._lenis = new window.Lenis({ autoRaf: true, anchors: true }) }

    /* ── Luxury band: ocultar al bajar, mostrar al subir ── */
    ;(function() {
        const band = document.querySelector('.luxury-band')
        if (!band) return
        let lastY = window.scrollY, _t = false
        window.addEventListener('scroll', function luxScroll() {
            if (_t) return; _t = true
            requestAnimationFrame(() => {
                const y = window.scrollY
                if (y > lastY && y > 80) band.classList.add('luxury-hidden')
                else if (y < lastY) band.classList.remove('luxury-hidden')
                lastY = y; _t = false
            })
        }, { passive: true, once: false })
    })()

    /* ── Carousel / slides ── */
    const slides = document.querySelectorAll('.slide')
    const indicators = document.querySelectorAll('.indicator')
    if (slides.length) {
        let cur = 0
        const show = (i) => {
            slides.forEach(s => s.classList.remove('active'))
            indicators.forEach(ind => ind.classList.remove('active'))
            slides[i].classList.add('active')
            if (indicators[i]) indicators[i].classList.add('active')
        }
        if (window._slideInterval) clearInterval(window._slideInterval)
        window._slideInterval = setInterval(() => { cur = (cur + 1) % slides.length; show(cur) }, 6000)
    }

    /* ── Hero slideshow (panel derecho inicio) ── */
    const heroSlides = document.querySelectorAll('.hero-slide')
    if (heroSlides.length > 1) {
        if (window._heroInterval) clearInterval(window._heroInterval)
        let hi = 0
        window._heroInterval = setInterval(() => {
            heroSlides[hi].classList.remove('active'); hi = (hi + 1) % heroSlides.length; heroSlides[hi].classList.add('active')
        }, 4500)
    }

    /* ── Fade-in al hacer scroll ── */
    const fadeEls = document.querySelectorAll('.fade-in')
    if (fadeEls.length) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) } })
        }, { threshold: 0.1 })
        fadeEls.forEach(el => io.observe(el))
    }

    /* ── Marquee: clonar span para loop continuo ── */
    document.querySelectorAll('.marquee').forEach(m => {
        if (m.querySelector('[aria-hidden]')) return
        m.querySelectorAll('span').forEach(span => {
            const clone = span.cloneNode(true); clone.setAttribute('aria-hidden', 'true'); m.appendChild(clone)
        })
    })

    /* ── Cart badge ── */
    _cartBadge()

    /* ── Filter pills + búsqueda ── */
    function _normTexto(s) { return (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase() }
    window.applyFilters = () => {
        const cat = document.querySelector('.pill[data-filter].active')?.dataset.filter || 'all'
        const q   = _normTexto(document.getElementById('search-input')?.value.trim() || '')
        document.querySelectorAll('.filterable').forEach(c => {
            c.style.display = ((cat === 'all' || c.dataset.cat?.includes(cat)) && (!q || _normTexto(c.dataset.nombre).includes(q))) ? '' : 'none'
        })
    }
    function _applyFilter(f) {
        document.querySelectorAll('.pill[data-filter]').forEach(p => p.classList.toggle('active', p.dataset.filter === f))
        window.applyFilters()
    }
    document.querySelectorAll('.pill[data-filter]').forEach(pill => {
        pill.addEventListener('click', () => _applyFilter(pill.dataset.filter))
    })
    document.getElementById('search-input')?.addEventListener('input', () => window.applyFilters())

    /* ── Coleccion: leer param ?filter= ── */
    const _fp = new URLSearchParams(location.search).get('filter')
    if (_fp && document.getElementById('catalogo')) {
        _applyFilter(_fp)
        setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
}

/* ── turbo:load: corre en carga inicial Y en cada navegación ── */
let _initOnceDone = false
document.addEventListener('turbo:load', () => {
    if (!_initOnceDone) { _initOnceDone = true; _initOnce() }
    _initPage()
})
