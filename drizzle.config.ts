import { defineConfig } from 'drizzle-kit'
import { config as loadEnv } from 'dotenv'

// Loads DATABASE_URL from .env.local (drizzle-kit doesn't read it automatically
// the way Next.js does).
loadEnv({ path: '.env.local' })

export default defineConfig({
  out: './lib/db/generated',
  schema: './lib/db/generated/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // The DB has other schemas besides `public` (staging/sandbox/production —
  // leftovers from the PostgREST schema-cache saga). We only ever want to
  // read/write the real `public` tables the app actually uses.
  schemaFilter: ['public'],
})
