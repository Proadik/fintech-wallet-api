import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Database } from '../src/database/database.module.js';
import { requireTestDatabaseUrl } from './test-database.js';

// The whole application on a real PostgreSQL, with the Drizzle repositories.
// It runs on TEST_DATABASE_URL only; the tables must already be migrated (`npm run db:migrate:test`)
export async function createDbApp(): Promise<{ app: INestApplication<App>; db: Database }> {
  const testUrl = requireTestDatabaseUrl();

  // The application reads DATABASE_URL; keep the original so the check above still has it next time
  process.env.MAIN_DATABASE_URL ??= process.env.DATABASE_URL ?? '';
  process.env.DATABASE_URL = testUrl;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();

  return { app, db: app.get<Database>(getDrizzleToken()) };
}
