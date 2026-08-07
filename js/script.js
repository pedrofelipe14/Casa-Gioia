/* ── Aviso de seguridad en consola ── */
console.log('%c¡Alto!', 'color:#891A55;font-size:2rem;font-weight:bold;')
console.log('%cSi alguien te pidió que copies o pegues algo aquí, es un intento de robo de cuenta.\nCerrá esta ventana inmediatamente.', 'color:#2F2A28;font-size:14px;line-height:1.8;')

const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');

if (slides.length) {
    let current = 0;

    function showSlide(index){
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));
        slides[index].classList.add('active');
        if (indicators[index]) indicators[index].classList.add('active');
    }

    setInterval(() => {
        current = (current + 1) % slides.length;
        showSlide(current);
    }, 6000);
}

const navbar = document.getElementById("navbar");

window.addEventListener("scroll",()=>{

    if(window.scrollY > 40){

        navbar.classList.add("scrolled");

    }else{

        navbar.classList.remove("scrolled");
    }

});

/* ── Luxury band: pegada debajo del header, se oculta al bajar y
   reaparece al subir (solo aplica en la version con hamburguesa,
   ver CSS). ── */
;(function () {
    const band   = document.querySelector('.luxury-band')
    const header = document.querySelector('header')
    if (!band || !header) return

    const setHeaderHeight = () => {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px')
    }
    setHeaderHeight()
    window.addEventListener('resize', setHeaderHeight)

    let lastY = window.scrollY
    window.addEventListener('scroll', () => {
        const y = window.scrollY
        if (y > lastY && y > 80) {
            band.classList.add('luxury-hidden')
        } else if (y < lastY) {
            band.classList.remove('luxury-hidden')
        }
        lastY = y
    }, { passive: true })
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

/* ── Filter pills ── */
function applyFilter(f) {
    document.querySelectorAll('.pill[data-filter]').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === f);
    });
    document.querySelectorAll('.filterable').forEach(card => {
        const show = f === 'all' || card.dataset.cat.includes(f);
        card.style.display = show ? '' : 'none';
    });
}

document.querySelectorAll('.pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => applyFilter(pill.dataset.filter));
});

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

/* ── Botón de cuenta (navbar): texto completo en desktop, avatar/inicial
   en círculo en la versión con hamburguesa. Usado por todas las páginas
   para no duplicar esta lógica en cada una. ── */
window.renderAccountBtn = (btn, user) => {
    // Invitado con sesión anónima (compró sin cuenta): a los ojos del
    // sitio no está "logueado", no tiene nombre/avatar que mostrar.
    if (user?.is_anonymous) user = null
    if (!user) {
        btn.classList.remove('btn-nav-logged')
        btn.innerHTML = 'Ingresar'
        btn.onclick   = () => { window.location.href = 'login' }
        btn.style.opacity = '1'
        return
    }
    const nombre  = user.user_metadata?.full_name || user.user_metadata?.name || user.email
    const primero = nombre.split(' ')[0]
    const avatar  = user.user_metadata?.avatar_url
    const inicial = primero.charAt(0).toUpperCase()

    btn.classList.add('btn-nav-logged')
    btn.innerHTML = `
        <span class="btn-nav-full">👤 ${primero}</span>
        <span class="btn-nav-avatar">${avatar ? `<img src="${avatar}" alt="">` : `<span class="btn-nav-initial">${inicial}</span>`}</span>
    `
    btn.onclick = () => { window.location.href = 'perfil' }
    btn.style.opacity = '1'
}

