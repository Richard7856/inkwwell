/**
 * Borrado de cuenta — exigido por Google Play para publicar.
 *
 * ── Por qué una Edge Function y no el worker de Railway ──
 * Eliminar de `auth.users` requiere la llave de servicio, que jamás puede viajar
 * en el bundle del cliente. Supabase inyecta esa llave aquí automáticamente y la
 * función vive junto a la base. El worker de Railway es un servicio de
 * compilación con endpoints abiertos sin auth (registrado como riesgo en
 * DECISIONS.md); agregarle privilegios de administrador ampliaría el radio de
 * daño de algo que ya está expuesto.
 *
 * ── Cómo se prueba la identidad ──
 * Se borra SIEMPRE al dueño del token, nunca un correo recibido en el cuerpo de
 * la petición. Quien llega por web sin la app obtiene su token con el mismo
 * código de 6 dígitos del login normal. Así nadie puede borrar la cuenta de otro
 * tecleando su correo.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Buckets donde InkAR guarda archivos del usuario */
const PREFIJO_PUBLICO = '/storage/v1/object/public/'

/**
 * Traduce una URL pública de Storage a {bucket, ruta}, que es lo que pide la API
 * de borrado. Devuelve null si la URL no es de Storage — así una fila con datos
 * corruptos no aborta el borrado completo.
 */
function rutaDeStorage(url: string | null): { bucket: string; ruta: string } | null {
  if (!url) return null
  const i = url.indexOf(PREFIJO_PUBLICO)
  if (i === -1) return null
  const resto = url.slice(i + PREFIJO_PUBLICO.length)
  const corte = resto.indexOf('/')
  if (corte <= 0) return null
  return { bucket: resto.slice(0, corte), ruta: decodeURIComponent(resto.slice(corte + 1)) }
}

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  /*
    Verificación explícita del usuario, y no confianza en `verify_jwt`.

    La pasarela de Supabase acepta la llave anónima como JWT válido: con
    verify_jwt sola, cualquiera con esa llave (que va pública en el bundle)
    llegaría hasta acá. getUser() exige un token de sesión de una persona real.
  */
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: { user }, error: errorAuth } = await admin.auth.getUser(jwt)
  if (errorAuth || !user) {
    return json(401, { error: 'Sesión inválida o vencida. Vuelve a entrar con tu código.' })
  }

  // ── 1. Reunir los archivos ANTES de tocar las filas ──
  // Las llaves foráneas son `on delete cascade`, así que borrar primero las
  // filas destruiría las URLs y dejaría las fotos huérfanas y públicas para
  // siempre: una fuga de datos permanente disfrazada de borrado exitoso.
  const { data: perfil } = await admin
    .from('users').select('mind_url').eq('id', user.id).maybeSingle()

  const { data: tatuajes, error: errorLectura } = await admin
    .from('tattoos').select('id, image_url, mind_url').eq('user_id', user.id)

  if (errorLectura) {
    return json(500, { error: `No se pudieron leer tus datos: ${errorLectura.message}` })
  }

  const porBucket = new Map<string, string[]>()
  const urls = [
    perfil?.mind_url ?? null,
    ...(tatuajes ?? []).flatMap((t) => [t.image_url, t.mind_url]),
  ]
  for (const url of urls) {
    const destino = rutaDeStorage(url)
    if (!destino) continue
    const rutas = porBucket.get(destino.bucket) ?? []
    rutas.push(destino.ruta)
    porBucket.set(destino.bucket, rutas)
  }

  // ── 2. Borrar los archivos ──
  // Si algo falla acá se aborta SIN tocar las filas: conservarlas deja las URLs
  // localizables para reintentar. Borrar un archivo ya inexistente no es error,
  // así que reintentar es seguro.
  let archivosBorrados = 0
  for (const [bucket, rutas] of porBucket) {
    const { data, error } = await admin.storage.from(bucket).remove(rutas)
    if (error) {
      return json(500, {
        error: `No se pudieron borrar tus archivos (${bucket}): ${error.message}. ` +
               'No se borró nada más; vuelve a intentarlo.',
      })
    }
    archivosBorrados += data?.length ?? 0
  }

  // ── 3. Borrar los datos de InkAR ──
  // Explícito y no por cascada, porque el paso 4 puede no llegar a ejecutarse.
  const { error: errorTatuajes } = await admin.from('tattoos').delete().eq('user_id', user.id)
  if (errorTatuajes) {
    return json(500, { error: `No se pudieron borrar tus tatuajes: ${errorTatuajes.message}` })
  }
  const { error: errorPerfil } = await admin.from('users').delete().eq('id', user.id)
  if (errorPerfil) {
    return json(500, { error: `No se pudo borrar tu perfil: ${errorPerfil.message}` })
  }

  /*
    ── 4. La identidad de acceso, solo si otra aplicación la está usando ──

    Este proyecto de Supabase está compartido con otra app, que cuelga su tabla
    `profiles` del mismo `auth.users`. Borrar la identidad de alguien que
    también usa esa app tendría uno de dos finales, ambos malos: destruir la
    cuenta que esa persona tiene allá sin haberlo pedido, o fallar con un error
    de llave foránea incomprensible (`spaces_owner_id_fkey` es RESTRICT).

    OJO — aquí antes se preguntaba si EXISTE la fila de `profiles`, y estaba
    mal: esa app tiene un disparador (`on_auth_user_created`) que crea la fila
    para TODO usuario nuevo, incluidos los que solo vienen de InkAR. Con esa
    comprobación, nadie habría podido borrar su identidad jamás — el usuario
    pedía borrar su cuenta y su login seguía funcionando. Se detectó probando
    el borrado de punta a punta, no leyendo el código.

    Lo que sí distingue a un usuario real de esa app es tener ACTIVIDAD: es una
    app de espacios, y sin pertenecer a uno no se puede hacer nada allá.

    El arreglo de fondo es separar los proyectos de Supabase — ver DECISIONS.md.
  */
  const [membresias, espacios] = await Promise.all([
    admin.from('space_members').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('spaces').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])
  const usaLaOtraApp = (membresias.count ?? 0) > 0 || (espacios.count ?? 0) > 0

  if (usaLaOtraApp) {
    return json(200, {
      alcance: 'solo_inkar',
      tatuajes: tatuajes?.length ?? 0,
      archivos: archivosBorrados,
      mensaje: 'Se borraron todos tus datos de InkAR. Tu correo sigue dando acceso ' +
               'a otra aplicación que comparte esta cuenta, así que no se eliminó.',
    })
  }

  const { error: errorBorrado } = await admin.auth.admin.deleteUser(user.id)
  if (errorBorrado) {
    /*
      Red de seguridad: si la otra app agrega mañana una tabla que referencie al
      usuario con RESTRICT, este borrado fallará por llave foránea. Antes que
      devolver un error crudo, se reporta lo que SÍ pasó — los datos de InkAR ya
      no existen — para no dejar al usuario creyendo que no se borró nada.
    */
    console.error('[eliminar-cuenta] identidad no borrada', user.id, errorBorrado.message)
    return json(200, {
      alcance: 'solo_inkar',
      tatuajes: tatuajes?.length ?? 0,
      archivos: archivosBorrados,
      mensaje: 'Se borraron todos tus datos de InkAR. Tu cuenta de acceso no se ' +
               'pudo eliminar porque otra aplicación la está usando. Escribe a ' +
               'contacto@inkar.app si necesitas eliminarla por completo.',
    })
  }

  return json(200, {
    alcance: 'completo',
    tatuajes: tatuajes?.length ?? 0,
    archivos: archivosBorrados,
    mensaje: 'Tu cuenta y todos tus datos fueron eliminados.',
  })
})
