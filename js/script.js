if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

/* ── Aviso de seguridad en consola ── */
console.log('%c¡Alto!', 'color:#891A55;font-size:2rem;font-weight:bold;')
console.log('%cSi alguien te pidió que copies o pegues algo aquí, es un intento de robo de cuenta.\nCerrá esta ventana inmediatamente.', 'color:#2F2A28;font-size:14px;line-height:1.8;')

/* ── Prefetch de páginas al hacer hover en links internos ── */
;(function(){
  const seen = new Set()
  function prefetch(url) {
    if (seen.has(url)) return
    seen.add(url)
    const l = document.createElement('link')
    l.rel  = 'prefetch'
    l.href = url
    document.head.appendChild(l)
  }
  document.addEventListener('mouseover', function(e) {
    const a = e.target.closest('a[href]')
    if (!a) return
    const url = a.href
    if (!url || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('https://wa.me') || a.target === '_blank') return
    if (new URL(url).origin !== location.origin) return
    prefetch(url)
  })
})()

/* ── Escapa HTML antes de meter datos de un cliente en innerHTML (nombre,
   email de contacto, dirección, etc) — sin esto alguien podría guardar
   algo como "<img src=x onerror=...>" y ejecutarlo en el navegador de
   quien lo vea después. ── */
window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

/* ── Scroll con inercia (Lenis). Si el script del CDN no cargó, sigue
   funcionando el scroll nativo normal — es una mejora, no una
   dependencia dura. Solo afecta rueda/trackpad: el scroll táctil en
   celular queda nativo (Lenis no lo toca a menos que se le pida con
   syncTouch), y respeta "reducir movimiento" del sistema solo. ── */
if (window.Lenis) {
    new window.Lenis({ autoRaf: true, anchors: true })
}

const slides = document.querySelectorAll('.slide');

if (slides.length) {
    let current = 0;
    const heroSlides = document.querySelectorAll('.hero-slide');

    function showSlide(index){
        slides.forEach(slide => slide.classList.remove('active'));
        slides[index].classList.add('active');
        if (heroSlides.length) {
            heroSlides.forEach(s => s.classList.remove('active'));
            if (heroSlides[index]) heroSlides[index].classList.add('active');
        }
    }

    setInterval(() => {
        current = (current + 1) % slides.length;
        showSlide(current);
    }, 5000);
}

/* ── Throttle de scroll a un cálculo por frame: evita que el toggle
   de clases del header y de la luxury-band corran en cada pixel
   scrolleado (varias veces por frame en Windows/Firefox), que es lo
   que hace sentir el scroll entrecortado en equipos más lentos. ── */
function onScrollFrame(callback) {
    let ticking = false
    window.addEventListener('scroll', () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(() => {
            callback()
            ticking = false
        })
    }, { passive: true })
}

const navbar = document.getElementById("navbar");

onScrollFrame(() => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
});

/* ── Alto real del header: se usa para la luxury-band (donde existe)
   y para que los saltos de scroll (anclas, scrollIntoView) no dejen
   el destino tapado detrás del header sticky. Corre en todas las
   páginas, tengan luxury-band o no. ── */
;(function () {
    const header = document.querySelector('header')
    if (!header) return

    // ResizeObserver en vez de solo "resize": el header puede cambiar de
    // alto sin que la ventana cambie de tamaño (ej. la navbar pasa a dos
    // líneas si aparece/desaparece la barra de favoritos del navegador,
    // que achica el viewport y con eso el ancho disponible por la
    // scrollbar). Si --header-h queda desactualizado, tanto la
    // luxury-band como el scroll-padding apuntan a un punto viejo.
    const setHeaderHeight = () => {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px')
    }
    setHeaderHeight()
    if (window.ResizeObserver) {
        new ResizeObserver(setHeaderHeight).observe(header)
    } else {
        window.addEventListener('resize', setHeaderHeight)
    }
})()

/* ── Luxury band: pegada debajo del header, se oculta al bajar y
   reaparece al subir (solo aplica en la version con hamburguesa,
   ver CSS). ── */
;(function () {
    const band = document.querySelector('.luxury-band')
    if (!band) return

    let lastY = window.scrollY
    onScrollFrame(() => {
        const y = window.scrollY
        if (y > lastY && y > 80) {
            band.classList.add('luxury-hidden')
        } else if (y < lastY) {
            band.classList.remove('luxury-hidden')
        }
        lastY = y
    })
})()

const mobileToggle = document.getElementById("mobileToggle");
const menu = document.getElementById("menu");

mobileToggle.addEventListener("click",()=>{

    menu.classList.toggle("active");

});
/* ── Fade in on scroll ── */
const fadeEls = document.querySelectorAll('.fade-in');
if(fadeEls.length){
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    fadeEls.forEach(el => io.observe(el));
}

/* ── Filter pills + búsqueda ──────────────────────────────────────────
   Las dos condiciones (categoría activa + texto buscado) se evalúan
   juntas en window.applyFilters(), que también llama coleccion.html
   cada vez que termina de renderizar los productos (recién ahí existen
   las tarjetas .filterable sobre las que filtrar). ── */
function _normalizarTexto(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

window.applyFilters = () => {
    const activeCat = document.querySelector('.pill[data-filter].active')?.dataset.filter || 'all';
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? _normalizarTexto(searchInput.value.trim()) : '';

    document.querySelectorAll('.filterable').forEach(card => {
        const matchesCat = activeCat === 'all' || card.dataset.cat.includes(activeCat);
        const matchesSearch = !query || _normalizarTexto(card.dataset.nombre).includes(query);
        card.style.display = (matchesCat && matchesSearch) ? '' : 'none';
    });
};

function applyFilter(f) {
    document.querySelectorAll('.pill[data-filter]').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === f);
    });
    window.applyFilters();
}

document.querySelectorAll('.pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => applyFilter(pill.dataset.filter));
});

document.getElementById('search-input')?.addEventListener('input', () => window.applyFilters());

/* ── Mobile submenu toggle ── */
document.querySelectorAll('.has-submenu > a').forEach(link => {
    link.addEventListener('click', e => {
        if (window.innerWidth <= 1200) {
            e.preventDefault();
            link.closest('.has-submenu').classList.toggle('submenu-open');
        }
    });
});

/* ── Submenu buttons → navigate to coleccion with filter param ── */
document.querySelectorAll('.submenu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const f = btn.textContent.trim().toLowerCase();
        window.location.href = `coleccion?filter=${f}`;
    });
});

/* ── On coleccion.html: read filter param, activate + scroll ── */
const _filterParam = new URLSearchParams(window.location.search).get('filter');
if (_filterParam && document.getElementById('catalogo')) {
    applyFilter(_filterParam);
    setTimeout(() => {
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}

// googleLogin is defined per-page where supabase is available (login.html)

/* ── Seamless marquee: clone each span so the loop never cuts ── */
document.querySelectorAll('.marquee span').forEach(span => {
    const clone = span.cloneNode(true)
    clone.setAttribute('aria-hidden', 'true')
    span.parentNode.appendChild(clone)
})

/* ── Cart: inject icon button grouped with #userBtn ── */
;(function () {
    const nav = document.getElementById('navbar')
    if (!nav) return
    const userBtnEl = nav.querySelector('#userBtn')
    if (!userBtnEl) return

    const cartBtn = document.createElement('button')
    cartBtn.className = 'cart-btn'
    cartBtn.id = 'cartBtn'
    cartBtn.setAttribute('aria-label', 'Ver carrito')
    cartBtn.onclick = () => { window.location.href = 'carrito' }
    cartBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="cart-badge"></span>`

    const wrap = document.createElement('div')
    wrap.className = 'navbar-actions'
    nav.insertBefore(wrap, userBtnEl)
    wrap.appendChild(cartBtn)
    wrap.appendChild(userBtnEl)
})()

/* ── Botón flotante de WhatsApp ── */
;(function () {
    const numero  = '5491155806377' // +54 11 5580-6377, formato wa.me (con el 9 de celular)
    const mensaje = encodeURIComponent('¡Hola! Tengo una consulta sobre Casa Gioia.')

    const link = document.createElement('a')
    link.className = 'whatsapp-float'
    link.href = `https://wa.me/${numero}?text=${mensaje}`
    link.target = '_blank'
    link.rel = 'noopener'
    link.setAttribute('aria-label', 'Hablar por WhatsApp')
    link.innerHTML = `<svg viewBox="0 0 32 32" fill="white"><path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.31.65 4.47 1.78 6.31L4 29l7.86-1.75A11.9 11.9 0 0 0 16.004 27C22.63 27 28 21.63 28 15S22.63 3 16.004 3zm0 21.7c-1.95 0-3.77-.55-5.32-1.5l-.38-.23-4.66 1.04 1-4.55-.25-.4A9.63 9.63 0 0 1 5.3 15c0-5.9 4.8-10.7 10.7-10.7S26.7 9.1 26.7 15 21.9 24.7 16.004 24.7zm5.87-8.02c-.32-.16-1.9-.94-2.19-1.05-.29-.1-.5-.16-.72.16-.21.32-.82 1.05-1.01 1.26-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.6-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.75-.99-2.4-.26-.62-.53-.54-.72-.55h-.62c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.23 3.4 5.4 4.77.75.32 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.9-.78 2.16-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37z"/></svg>`

    document.body.appendChild(link)
})()

/* ── Cookie banner ── */
;(function () {
    const KEY = 'casagioia_cookie_consent'
    if (localStorage.getItem(KEY)) return

    const bar = document.createElement('div')
    bar.className = 'cookie-banner'
    bar.innerHTML = `
        <p>Usamos cookies propias y de terceros para que el sitio funcione y para mejorar tu experiencia de compra. Podés ver más en nuestras <a href="politicas-de-privacidad">Políticas de privacidad</a>.</p>
        <button class="btn-primary" id="cookieAcceptBtn">Aceptar</button>
    `
    document.body.appendChild(bar)
    requestAnimationFrame(() => bar.classList.add('visible'))

    document.getElementById('cookieAcceptBtn').addEventListener('click', () => {
        localStorage.setItem(KEY, '1')
        bar.classList.remove('visible')
        setTimeout(() => bar.remove(), 400)
    })
})()

/* ── Cart: localStorage helpers (global) ── */
const _CART_KEY = 'casagioia_cart'
window.cartGet  = () => JSON.parse(localStorage.getItem(_CART_KEY) || '[]')
window.cartSave = (items) => { localStorage.setItem(_CART_KEY, JSON.stringify(items)); _cartBadge(); window._cartSyncFn?.() }

function _cartBadge() {
    const n = window.cartGet().reduce((s, i) => s + i.qty, 0)
    document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = n || ''
        b.style.display = n > 0 ? 'flex' : 'none'
    })
}
_cartBadge()

window.cartAdd = (btn) => {
    const card  = btn.closest('[data-id]')
    const items = window.cartGet()
    const ex    = items.find(i => i.id === card.dataset.id)
    if (ex) { ex.qty++ } else { items.push({ id: card.dataset.id, nombre: card.dataset.nombre, precio: Number(card.dataset.precio), qty: 1 }) }
    window.cartSave(items)
    btn.textContent = '✓ Agregado'
    btn.disabled    = true
    setTimeout(() => { btn.textContent = '+ Agregar'; btn.disabled = false }, 1500)
}

/* ── Botón de cuenta (navbar): pre-renderizar desde sessionStorage para
   evitar el flash de "Ingresar" mientras llega la respuesta de Supabase ── */
;(function () {
    try {
        const u = JSON.parse(sessionStorage.getItem('cg_auth') || 'null')
        if (!u?.primero) return
        const btn = document.getElementById('userBtn')
        if (!btn) return
        btn.classList.add('btn-nav-logged')
        btn.innerHTML = `
            <span class="btn-nav-full">👤 ${u.primero}</span>
            <span class="btn-nav-avatar">${u.avatar ? `<img src="${u.avatar}" alt="${u.primero}">` : `<span class="btn-nav-initial">${u.primero.charAt(0).toUpperCase()}</span>`}</span>
        `
        btn.onclick = () => { window.location.href = 'perfil' }
        btn.style.opacity = '1'
    } catch (e) {}
})()

window.renderAccountBtn = (btn, user) => {
    if (user?.is_anonymous) user = null
    if (!user) {
        sessionStorage.removeItem('cg_auth')
        btn.classList.remove('btn-nav-logged')
        btn.innerHTML = 'Ingresar'
        btn.onclick   = () => { window.location.href = 'login' }
        btn.style.opacity = '1'
        return
    }
    const nombre  = user.user_metadata?.full_name || user.user_metadata?.name || user.email
    const primero = nombre.split(' ')[0]
    const avatar  = user.user_metadata?.avatar_url || null
    sessionStorage.setItem('cg_auth', JSON.stringify({ primero, avatar }))

    btn.classList.add('btn-nav-logged')
    btn.innerHTML = `
        <span class="btn-nav-full">👤 ${primero}</span>
        <span class="btn-nav-avatar">${avatar ? `<img src="${avatar}" alt="${primero}">` : `<span class="btn-nav-initial">${primero.charAt(0).toUpperCase()}</span>`}</span>
    `
    btn.onclick = () => { window.location.href = 'perfil' }
    btn.style.opacity = '1'
}

/* ── Service Worker: cachea HTML, CSS, JS e imágenes para que las
   páginas carguen instantáneamente en visitas repetidas ── */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
}

