import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabase = createClient(
    'https://dzuymtiutglcyrdcxkaj.supabase.co',
    'sb_publishable_D29AA8KYQ1pz2LCcqSJUGw_OyTvLAC9'
)

const form = document.querySelector('.footer-form')
if (!form) throw 0

const input = form.querySelector('input[type="email"]')
const btn   = form.querySelector('button')

const msg = document.createElement('p')
msg.style.cssText = 'margin:8px 0 0;font-size:.72rem;letter-spacing:.5px;min-height:1em;'
form.parentNode.insertBefore(msg, form.nextSibling)

function setMsg(texto, color) {
    msg.textContent = texto
    msg.style.color = color || 'var(--wine-soft)'
}

async function suscribir() {
    const email = input.value.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMsg('Ingresá un email válido.', '#c0392b')
        return
    }
    btn.disabled = true
    btn.textContent = '…'
    setMsg('')

    const { error } = await supabase.from('newsletter').insert({ email })

    btn.disabled = false

    if (error) {
        if (error.code === '23505') {
            input.value = ''
            btn.textContent = 'OK'
            setMsg('Ya estás suscripto con ese email ✓')
        } else {
            btn.textContent = 'OK'
            setMsg('Hubo un error. Intentá de nuevo.', '#c0392b')
        }
        return
    }

    input.value = ''
    btn.textContent = '✓'
    setMsg('¡Gracias! Pronto vas a recibir nuestras novedades.')
    setTimeout(() => {
        btn.textContent = 'OK'
        setMsg('')
    }, 5000)
}

btn.addEventListener('click', suscribir)
input.addEventListener('keydown', e => { if (e.key === 'Enter') suscribir() })
