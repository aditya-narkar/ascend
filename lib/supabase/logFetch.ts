// supabase-js resolves failed queries as `{ error }` instead of throwing, so any call whose result
// isn't checked fails silently (missing column, missing function, RLS denial...). Passing this as
// `global.fetch` logs every failed database / RPC request once, in one place.
//
// - Only PostgREST (/rest/v1/) is logged; auth failures like a wrong password are expected.
// - 406 is skipped: that is `.single()` finding no row, which the app uses on purpose.
// - Logs the path and PostgREST's error body, never the query string or request body.
// supabase/functions/daily-reset/index.ts keeps a copy — keep them in sync.
export const loggingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  if (!res.ok && res.status !== 406) {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const { pathname } = new URL(href)
    if (pathname.startsWith('/rest/v1/')) {
      console.error(`[supabase] ${init?.method ?? 'GET'} ${pathname} -> ${res.status}`, await res.clone().text())
    }
  }
  return res
}
