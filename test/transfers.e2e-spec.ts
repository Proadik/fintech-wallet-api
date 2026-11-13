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

  const body = (amount: unknown) => ({
    fromWalletId: '00000000-0000-4000-8000-000000000001',
    toWalletId: '00000000-0000-4000-8000-000000000002',
    amount,
    currency: 'KZT',
  });

  it.each([
    ['letters', 'abc'],
    ['a negative amount', '-10.00'],
    ['three decimal places', '10.001'],
    ['a comma', '10,50'],
    ['an empty string', ''],
    ['surrounding spaces', ' 10 '],
    ['a number instead of a string', 10],
    ['more than 15 digits', '1234567890123456'],
  ])('rejects amount with %s → 400', async (_, amount) => {
    const res = await createTransfer().set('Idempotency-Key', KEY).send(body(amount)).expect(400);

    expect(res.body.message).toContain('amount must be a positive decimal string');
  });

  it.each(['0', '0.00'])('rejects a zero amount %s → 400', async (amount) => {
    const res = await createTransfer().set('Idempotency-Key', KEY).send(body(amount)).expect(400);

    expect(res.body.message).toBe('amount must be greater than zero');
  });

  // The wallets do not exist, so reaching 404 means the amount passed validation
  it.each(['150', '150.5', '150.50', '0.01'])('accepts amount %s', async (amount) => {
    const res = await createTransfer().set('Idempotency-Key', KEY).send(body(amount)).expect(404);

    expect(res.body.message).toBe('Wallet not found. Check the wallet ids.');
  });

  it.each([
    ['the same id', '00000000-0000-4000-8000-00000000000a'],
    ['the same id in another case', '00000000-0000-4000-8000-00000000000A'],
  ])('rejects a transfer to the same wallet (%s) → 400', async (_, toWalletId) => {
    const res = await createTransfer()
      .set('Idempotency-Key', KEY)
      .send({ ...body('10.00'), fromWalletId: '00000000-0000-4000-8000-00000000000a', toWalletId })
      .expect(400);

    expect(res.body.message).toBe('Cannot transfer to the same wallet');
  });

  describe('GET /wallets/:walletId/transfers', () => {
    it('returns 404 for a missing wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallets/00000000-0000-4000-8000-000000000001/transfers')
        .expect(404);

      expect(res.body.message).toBe('Wallet not found');
    });

    it('rejects a wallet id that is not a UUID → 400', async () => {
      await request(app.getHttpServer()).get('/wallets/abc/transfers').expect(400);
    });
  });

  describe('GET /transfers/:id', () => {
    it('returns 404 for a missing transfer', async () => {
      const res = await request(app.getHttpServer())
        .get('/transfers/00000000-0000-4000-8000-000000000001')
        .expect(404);

      expect(res.body.message).toBe('Transfer not found');
    });

    it('rejects an id that is not a UUID → 400', async () => {
      const res = await request(app.getHttpServer()).get('/transfers/abc').expect(400);

      expect(res.body.message).toBe('Validation failed (uuid is expected)');
    });
  });
});
