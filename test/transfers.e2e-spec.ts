import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createDbApp } from './create-db-app.js';

const KEY = '7b0c1c1e-5a53-4a52-9d0b-6f0e2f4f8a11';

describe('Transfers (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createDbApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const createTransfer = () => request(app.getHttpServer()).post('/transfers');

  it('rejects a request without Idempotency-Key → 400', async () => {
    const res = await createTransfer().send({}).expect(400);

    expect(res.body.message).toBe('Idempotency-Key header is required');
  });

  it('rejects an Idempotency-Key that is not a UUID → 400', async () => {
    const res = await createTransfer().set('Idempotency-Key', 'abc').send({}).expect(400);

    expect(res.body.message).toBe('Idempotency-Key header must be a UUID');
  });

  it('checks the key before the body: an invalid body with no key reports the key', async () => {
    const res = await createTransfer().send({ fromWalletId: 'not-a-uuid' }).expect(400);

    expect(res.body.message).toBe('Idempotency-Key header is required');
  });

  it('validates the body once the key is accepted', async () => {
    const res = await createTransfer().set('Idempotency-Key', KEY).send({}).expect(400);

    expect(res.body.message).not.toContain('Idempotency-Key');
  });
});
