import { isLoggedIn, json, type Env } from '../_lib/auth'

/** Endpoints reachable without a session cookie. */
const PUBLIC_PATHS = new Set(['/api/login', '/api/logout', '/api/me'])

/** n8n posts progress here; it authenticates with the shared secret header instead. */
const MACHINE_PATHS = new Set(['/api/progress-callback', '/api/status-callback', '/api/tulis-balik'])

// /api/run-aktif dan /api/pengaturan sengaja TIDAK masuk PUBLIC_PATHS atau MACHINE_PATHS —
// keduanya cuma dibuka lewat sesi login staf, sama seperti /api/promos dan /api/kirim.

export const onRequest: PagesFunction<Env> = async (context) => {
  const path = new URL(context.request.url).pathname

  if (PUBLIC_PATHS.has(path)) return context.next()

  if (MACHINE_PATHS.has(path)) {
    const secret = context.request.headers.get('X-BC-Secret') || ''
    if (secret !== context.env.N8N_SECRET) {
      return json({ error: 'unauthorized' }, { status: 401 })
    }
    return context.next()
  }

  if (!(await isLoggedIn(context.request, context.env))) {
    return json({ error: 'Sesi habis. Silakan masuk lagi.' }, { status: 401 })
  }

  return context.next()
}
