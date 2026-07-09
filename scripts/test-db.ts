// One-off connectivity check for the new direct-Postgres setup (Phase 1 of
// the PostgREST-bypass migration). Run with: npx tsx scripts/test-db.ts
// Safe to delete once Phase 1 is confirmed working — it only reads.
//
// dotenv config must run BEFORE lib/db is loaded (top-level code there reads
// process.env.DATABASE_URL immediately) — static `import` statements are
// hoisted ahead of regular statements in ESM, so lib/db has to be loaded via
// a dynamic import() after config() runs, not a static import at the top.
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const { db, schema } = await import('../lib/db')
  const { sql } = await import('drizzle-orm')

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookings)
  console.log(`OK — connected directly to Postgres. bookings table has ${count} rows.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
