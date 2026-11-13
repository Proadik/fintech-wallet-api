import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

// `npm run db:migrate:test` applies the same migrations to the test database
const forTests = process.env.DRIZZLE_TARGET === 'test'
const url = forTests ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL

if (!url) {
  throw new Error(`${forTests ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is not set`)
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url,
  },
})
