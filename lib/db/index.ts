import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Direct Postgres connection — bypasses Supabase's PostgREST layer entirely,
// which has repeatedly lost track of columns/functions that provably exist
// in the database (ticket SU-415685: feedback FK, email_verifications table,
// is_draft column, and the RPC functions written as workarounds for all
// three). Queries made through this client talk straight to Postgres over
// the connection pooler, so that whole class of bug cannot happen here,
// regardless of what PostgREST's cache does or doesn't know about.
//
// `prepare: false` is required for Supabase's "Transaction" pooler (port
// 6543) — it round-robins each query across different underlying
// connections, so server-side prepared statements (which are tied to one
// physical connection) aren't supported.
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Get it from Supabase Dashboard > Connect > Direct > Transaction pooler, and add it to .env.local (and to Vercel env vars for production).'
  )
}

const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
export { schema }
