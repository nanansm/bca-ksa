import type { Env } from './auth'

/** Panggil webhook n8n. Browser tidak pernah melihat URL maupun secret ini. */
export async function callN8n<T>(
  env: Env,
  path: 'ksa-bc-promos' | 'ksa-bc-run',
  body: unknown,
  timeoutMs = 120_000,
): Promise<T> {
  const response = await fetch(`${env.N8N_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BC-Secret': env.N8N_SECRET,
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(timeoutMs),
  })

  const text = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Balasan n8n tidak terbaca.')
  }

  const data = parsed as { ok?: boolean; error?: string }
  if (!response.ok || data.error || data.ok !== true) {
    throw new Error(data.error || 'n8n menolak permintaan.')
  }
  return parsed as T
}
