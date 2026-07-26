import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabase = createClient(
    'https://dzuymtiutglcyrdcxkaj.supabase.co',
    'sb_publishable_D29AA8KYQ1pz2LCcqSJUGw_OyTvLAC9'
)

async function suscribir(input, btn, msgEl) {
    const email = input.value.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (msgEl) { msgEl.textContent = 'Ingresá un email válido.'; msgEl.style.color = '#c0392b' }
        return
    }

    const textoOriginal = btn.textContent
    btn.disabled = true
    btn.textContent = '…'
    if (msgEl) msgEl.textContent = ''

    const { error } = await supabase.from('newsletter').insert({ email })

    btn.disabled = false

    if (error) {
        if (error.code === '23505') {
            input.value = ''
            btn.textContent = textoOriginal
            if (msgEl) { msgEl.textContent = 'Ya estás suscripto con ese email ✓'; msgEl.style.color = 'var(--wine-soft)' }
        } else {
            btn.textContent = textoOriginal
            if (msgEl) { msgEl.textContent = 'Hubo un error. Intentá de nuevo.'; msgEl.style.color = '#c0392b' }
        }
        return
    }

    input.value = ''
    btn.textContent = '✓'
    if (msgEl) { msgEl.textContent = '¡Gracias! Pronto vas a recibir nuestras novedades.'; msgEl.style.color = 'var(--wine-soft)' }
    setTimeout(() => {
        btn.textContent = textoOriginal
        if (msgEl) msgEl.textContent = ''
    }, 5000)
}

// Footer
const footerForm = document.querySelector('.footer-form')
if (footerForm) {
    const input = footerForm.querySelector('input[type="email"]')
    const btn   = footerForm.querySelector('button')
    const msg   = document.createElement('p')
    msg.style.cssText = 'margin:8px 0 0;font-size:.72rem;letter-spacing:.5px;min-height:1em;'
    footerForm.parentNode.insertBefore(msg, footerForm.nextSibling)
    btn.addEventListener('click', () => suscribir(input, btn, msg))
    input.addEventListener('keydown', e => { if (e.key === 'Enter') suscribir(input, btn, msg) })
}

// Journal (Storia)
const journalForm = document.getElementById('journal-nl')
if (journalForm) {
    const input = journalForm.querySelector('input[type="email"]')
    const btn   = journalForm.querySelector('button')
    const msg   = document.getElementById('journal-nl-msg')
    btn.addEventListener('click', () => suscribir(input, btn, msg))
    input.addEventListener('keydown', e => { if (e.key === 'Enter') suscribir(input, btn, msg) })
}
