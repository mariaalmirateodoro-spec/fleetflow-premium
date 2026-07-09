// One-off connectivity check for the new direct-Postgres setup (Phase 1 of
// the PostgREST-bypass migration). Run with: npx tsx scripts/test-db.ts
// Safe to delete once Phase 1 is confirmed working — it only reads.
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { db, schema } from '../lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookings)
  console.log(`OK — connected directly to Postgres. bookings table has ${count} rows.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
