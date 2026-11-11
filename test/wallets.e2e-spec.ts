import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp } from './create-app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Wallets (e2e)', () => {
  let app: INestApplication<App>;
  let userId: string;

  beforeEach(async () => {
    app = await createApp();

    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'adil@example.com', firstName: 'Adil', lastName: 'Kim' })
      .expect(201);

    userId = res.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  const createWallet = (body: object) =>
    request(app.getHttpServer()).post('/wallets').send(body);

  it('creates a USD wallet for an existing user → 201', async () => {
    const res = await createWallet({ userId, currency: 'USD' }).expect(201);

    expect(res.body).toMatchObject({ userId, currency: 'USD' });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('returns 404 when creating a wallet for a missing user', async () => {
    const res = await createWallet({ userId: MISSING_ID, currency: 'USD' }).expect(404);

    expect(res.body.message).toBe('User not found');
  });

  it('rejects a second USD wallet → 409', async () => {
    await createWallet({ userId, currency: 'USD' }).expect(201);

    const res = await createWallet({ userId, currency: 'USD' }).expect(409);

    expect(res.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'User already has a USD wallet',
      path: '/wallets',
    });
  });

  it('creates a EUR wallet for a user who has USD → 201', async () => {
    const usd = await createWallet({ userId, currency: 'USD' }).expect(201);
    const eur = await createWallet({ userId, currency: 'EUR' }).expect(201);

    expect(eur.body.currency).toBe('EUR');
    expect(eur.body.id).not.toBe(usd.body.id);
  });

  it.each(['BTC', 'usd'])('rejects currency %s → 400', async (currency) => {
    await createWallet({ userId, currency }).expect(400);
  });

  it('rejects balance in the request → 400', async () => {
    const res = await createWallet({ userId, currency: 'USD', balance: '1000.00' }).expect(400);

    expect(res.body.message).toContain('property balance should not exist');
  });

  it('starts a new wallet with balance exactly "0.00"', async () => {
    const res = await createWallet({ userId, currency: 'USD' }).expect(201);

    expect(res.body.balance).toBe('0.00');
  });

  it('gets a wallet by ID → 200', async () => {
    const created = await createWallet({ userId, currency: 'USD' }).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/wallets/${created.body.id}`)
      .expect(200);

    expect(res.body).toEqual(created.body);
  });

  it('lists wallets of an existing user → 200', async () => {
    const usd = await createWallet({ userId, currency: 'USD' }).expect(201);
    const eur = await createWallet({ userId, currency: 'EUR' }).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/users/${userId}/wallets`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body).toEqual(expect.arrayContaining([usd.body, eur.body]));
  });

  it('returns 404 when listing wallets of a missing user', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${MISSING_ID}/wallets`)
      .expect(404);

    expect(res.body.message).toBe('User not found');
  });
});
