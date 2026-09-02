import { clearSessionCookie, json, type Env } from '../_lib/auth'

export const onRequestPost: PagesFunction<Env> = async () =>
  json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
