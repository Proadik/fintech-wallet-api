import { randomUUID } from 'node:crypto';
import { ConflictException, INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Database } from '../src/database/database.module.js';
import { userSchema, walletSchema } from '../src/database/schema/index.js';
import { WalletsService } from '../src/wallets/wallets.service.js';
import { createDbApp } from './create-db-app.js';

describe('Wallets concurrency (e2e, PostgreSQL)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let userId: string;

  beforeAll(async () => {
    ({ app, db } = await createDbApp());

    // A user of its own, so the test never touches rows it did not create
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: `concurrency-${randomUUID()}@example.com`,
        firstName: 'Concurrency',
        lastName: 'Test',
      })
      .expect(201);

    userId = res.body.id;
  });

  afterAll(async () => {
    if (userId) {
      // await db.delete(walletSchema).where(eq(walletSchema.userId, userId));
      // await db.delete(userSchema).where(eq(userSchema.id, userId));
    }

    await app?.close();
  });

  it('should create only one USD wallet', async () => {
    const requests = Array.from(
      { length: 1000 },
      () =>
        request(app.getHttpServer())
          .post('/wallets')
          .send({
            userId,
            currency: 'USD',
          }),
    );

    const responses = await Promise.all(requests);

    const created = responses.filter(
      (response) => response.status === 201,
    );

    const conflicts = responses.filter(
      (response) => response.status === 409,
    );

    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(999);

    const rows = await db.select().from(walletSchema).where(eq(walletSchema.userId, userId));

    expect(rows).toHaveLength(1);
  });

  // Over HTTP on a fast local database the requests above can finish one after another,
  // so the duplicate check in the service catches them. Calling the service directly
  // issues all 50 checks before any insert, so 49 of them reach the unique constraint
  it('should turn the unique constraint violation into a conflict', async () => {
    const service = app.get(WalletsService);

    const results = await Promise.allSettled(
      Array.from({ length: 1000 }, () => service.create({ userId, currency: 'EUR' })),
    );

    const created = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(999);

    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(ConflictException);
      expect(result.reason.message).toBe('User already has a EUR wallet');
    }

    const rows = await db.select().from(walletSchema).where(eq(walletSchema.userId, userId));

    expect(rows.filter((row) => row.currency === 'EUR')).toHaveLength(1);
  });
});
