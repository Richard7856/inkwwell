import { supabase } from './supabase.js'

/**
 * Registra un correo en la lista de espera.
 *
 * El experimento completo vive en esta función: `priceRange` es lo que separa
 * "a la gente le pareció bonito" de "la gente pagaría". Los registros solos no
 * validan nada — todo mundo se apunta a lo que es gratis.
 *
 * @param {{ email: string, tattoo?: string, priceRange?: string, source?: string }} data
 * @returns {Promise<{ alreadyIn: boolean }>} alreadyIn true si el correo ya estaba
 */
export async function joinWaitlist({ email, tattoo, priceRange, source }) {
  if (!supabase) {
    throw new Error(
      'Todavía no podemos guardar tu registro. Escríbenos y te apuntamos a mano.'
    )
  }

  const { error } = await supabase.from('waitlist').insert({
    email: email.trim().toLowerCase(),
    tattoo_description: tattoo?.trim() || null,
    price_range: priceRange || null,
    source: source || null,
  })

  if (error) {
    // 23505 = unique_violation. No es un fallo: ya estaba en la lista.
    // Mostrarlo como error haría que la persona pensara que no quedó registrada.
    if (error.code === '23505') {
      return { alreadyIn: true }
    }
    throw new Error('No se pudo guardar tu registro. Intenta de nuevo en un momento.')
  }

  return { alreadyIn: false }
}

/**
 * Rangos de precio en pesos.
 *
 * "Solo curiosidad" existe a propósito. Sin una salida honesta, quien no pagaría
 * elige el rango más bajo por compromiso y el resultado sale inflado — que es
 * justo el error que este experimento intenta evitar.
 */
export const PRICE_RANGES = [
  { value: 'curioso',   label: 'Solo tengo curiosidad' },
  { value: '<300',      label: 'Menos de $300' },
  { value: '300-800',   label: '$300 a $800' },
  { value: '800-1500',  label: '$800 a $1,500' },
  { value: '>1500',     label: 'Más de $1,500' },
]
