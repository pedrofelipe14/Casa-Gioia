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
        window.location.href = `coleccion.html?filter=${f}`;
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
    cartBtn.onclick = () => { window.location.href = 'carrito.html' }
    cartBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="cart-badge"></span>`

    const wrap = document.createElement('div')
    wrap.className = 'navbar-actions'
    nav.insertBefore(wrap, userBtnEl)
    wrap.appendChild(cartBtn)
    wrap.appendChild(userBtnEl)
})()

/* ── Cart: localStorage helpers (global) ── */
const _CART_KEY = 'casagioia_cart'
window.cartGet  = () => JSON.parse(localStorage.getItem(_CART_KEY) || '[]')
window.cartSave = (items) => { localStorage.setItem(_CART_KEY, JSON.stringify(items)); _cartBadge() }

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

