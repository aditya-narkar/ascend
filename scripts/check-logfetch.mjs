// Run: node --experimental-strip-types scripts/check-logfetch.mjs
// Guards the rules in lib/supabase/logFetch.ts: log real PostgREST failures, stay quiet otherwise.
import assert from 'node:assert/strict'
import { loggingFetch } from '../lib/supabase/logFetch.ts'

const logs = []
console.error = (...args) => logs.push(args)

const respond = (status, body = '') => {
  globalThis.fetch = async () => new Response(body, { status })
}
const run = async (path, status, body, init) => {
  respond(status, body)
  logs.length = 0
  const res = await loggingFetch(`https://x.supabase.co${path}`, init)
  return { res, logged: logs.length }
}

// a failed update is logged, with the PostgREST message, and the body stays readable
let r = await run('/rest/v1/users?id=eq.123', 400, '{"message":"column does not exist"}', { method: 'PATCH' })
assert.equal(r.logged, 1)
assert.match(logs[0][0], /PATCH \/rest\/v1\/users -> 400/)
assert.ok(!logs[0][0].includes('123'), 'query string must not be logged')
assert.match(logs[0][1], /column does not exist/)
assert.equal(await r.res.text(), '{"message":"column does not exist"}')

// failed RPC (e.g. function missing) is logged
assert.equal((await run('/rest/v1/rpc/decrement_stat', 404, '{}', { method: 'POST' })).logged, 1)

// quiet cases: success, .single() with no row (406), auth failures
assert.equal((await run('/rest/v1/users', 200, '[]')).logged, 0)
assert.equal((await run('/rest/v1/users', 406, '{"code":"PGRST116"}')).logged, 0)
assert.equal((await run('/auth/v1/token', 400, '{"error":"invalid_grant"}', { method: 'POST' })).logged, 0)

console.log('logFetch checks passed')
