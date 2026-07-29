// Small client-side cache for /api/me so navigating between pages doesn't
// re-run the (heavy) resolver on every mount. Simultaneous callers share one
// request (in-flight dedup). Call clearMe() after any change to org/accounts/
// teams/members so the next read refetches.

let cache: { at: number; data: any } | null = null
let inflight: Promise<any> | null = null
const TTL = 60_000 // 1 minute

export async function getMe(force = false): Promise<any> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data
  if (!force && inflight) return inflight
  inflight = fetch('/api/me')
    .then(r => r.json())
    .then(data => { cache = { at: Date.now(), data }; inflight = null; return data })
    .catch(e => { inflight = null; throw e })
  return inflight
}

export function clearMe() { cache = null; inflight = null }
