const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');

let current = 0;

function showSlide(index){

    slides.forEach(slide=>{
        slide.classList.remove('active');
    });

    indicators.forEach(indicator=>{
        indicator.classList.remove('active');
    });

    slides[index].classList.add('active');
    indicators[index].classList.add('active');
}

setInterval(()=>{

    current++;

    if(current >= slides.length){
        current = 0;
    }

    showSlide(current);

},6000);

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
document.querySelectorAll('.pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
        const bar = pill.closest('.filter-bar');
        bar.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const f = pill.dataset.filter;
        document.querySelectorAll('.filterable').forEach(card => {
            const show = f === 'all' || card.dataset.cat.includes(f);
            card.style.display = show ? '' : 'none';
        });
    });
});

// googleLogin is defined per-page where supabase is available (login.html)
