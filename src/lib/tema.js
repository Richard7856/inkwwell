import { useEffect } from 'react'

/**
 * Tema claro u oscuro por pantalla.
 *
 * ── Por qué no un tema único ──
 * El visor AR dibuja el 3D SOBRE el video de la cámara. Una interfaz clara
 * encima compite con la imagen y lava el contraste del modelo, así que esa
 * pantalla tiene que ser oscura pase lo que pase. Las de marketing, en cambio,
 * piden el blanco de papel del tablero de marca.
 *
 * ── Por qué se marca el <html> y no un contenedor ──
 * El color de fondo del documento se ve al rebotar el scroll y detrás de las
 * barras del sistema. Pintar solo un div deja franjas del color equivocado en
 * los bordes, que es justo donde más se nota.
 *
 * @param {'claro'|'oscuro'} tema
 */
export function useTema(tema) {
  useEffect(() => {
    const raiz = document.documentElement
    const previo = raiz.dataset.tema
    raiz.dataset.tema = tema
    // Se restaura el anterior al salir: sin esto, volver del landing al visor
    // dejaría el fondo claro debajo de la cámara.
    return () => {
      if (previo) raiz.dataset.tema = previo
      else delete raiz.dataset.tema
    }
  }, [tema])
}
