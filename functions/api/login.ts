import { createSessionCookie, json, loginThrottle, safeEqual, type Env } from '../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const throttle = await loginThrottle(request, env)
  if (throttle.locked) {
    return json(
      { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' },
      { status: 429 },
    )
  }

  let user = ''
  let pass = ''
  try {
    const body = (await request.json()) as { user?: string; pass?: string }
    user = String(body.user ?? '')
    pass = String(body.pass ?? '')
  } catch {
    return json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }

  const ok = safeEqual(user, env.APP_USER) && safeEqual(pass, env.APP_PASS)
  if (!ok) {
    await throttle.fail()
    return json({ error: 'Username atau password salah.' }, { status: 401 })
  }

  await throttle.reset()
  return json({ ok: true }, { headers: { 'Set-Cookie': await createSessionCookie(env) } })
}
