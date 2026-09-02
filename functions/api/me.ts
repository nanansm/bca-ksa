import { isLoggedIn, json, type Env } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  json({ loggedIn: await isLoggedIn(request, env) })
