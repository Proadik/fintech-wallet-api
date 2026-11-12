import { existsSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Database } from '../src/database/database.module.js';

// The whole application on a real PostgreSQL, with the Drizzle repositories.
// Uses TEST_DATABASE_URL when set, otherwise DATABASE_URL; the tables must already be migrated
export async function createDbApp(): Promise<{ app: INestApplication<App>; db: Database }> {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();

  return { app, db: app.get<Database>(getDrizzleToken()) };
}
